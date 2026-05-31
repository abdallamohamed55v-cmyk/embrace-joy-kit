// supabase/functions/cloudflare-deploy/index.ts
// Publish a user project to Cloudflare Pages.
//
// Flow:
//   1. Verify caller JWT and ownership of the project.
//   2. Fetch all source files from ai_project_files.
//   3. Bundle JS + CSS with esbuild-wasm (see ./bundler.ts).
//   4. Compose index.html (Tailwind Play CDN + bundled assets + SEO).
//   5. Upload to Cloudflare Pages via Direct Upload (see ./cf-pages.ts).
//   6. Persist published_url on the project row.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { bundleProject, BuildFile } from "./bundler.ts";
import { deployToPages, PageFile } from "./cf-pages.ts";

// ─── Helpers ─────────────────────────────────────────────────────────
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function projectNameFor(projectId: string): string {
  // Cloudflare Pages: lowercase, [a-z0-9-], must start with a letter, ≤58 chars.
  return `megsy-${projectId.replace(/-/g, "").toLowerCase()}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]
  );
}

// Standard shadcn-style Tailwind theme tokens injected into the Play CDN config.
// This makes classes like `bg-primary`, `text-muted-foreground`, `border-border`
// work without us having to evaluate the user's tailwind.config.ts in Deno.
const TAILWIND_CONFIG = `
tailwind.config = {
  darkMode: ['class'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};
`;

interface DeploySettings {
  slug?: string;
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
}

function composeIndexHtml(opts: {
  userHtml: string | undefined;
  settings: DeploySettings;
  jsHref: string;
  cssHref: string;
}): string {
  const title = escapeHtml(opts.settings.title || "App");
  const desc = escapeHtml(opts.settings.description || "");
  const og = escapeHtml(opts.settings.ogImage || "");
  const favicon = escapeHtml(opts.settings.favicon || "/favicon.ico");

  const head = `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${desc ? `<meta name="description" content="${desc}" />` : ""}
    ${og ? `<meta property="og:image" content="${og}" />` : ""}
    <meta property="og:title" content="${title}" />
    ${desc ? `<meta property="og:description" content="${desc}" />` : ""}
    <link rel="icon" href="${favicon}" />
    <link rel="stylesheet" href="${opts.cssHref}" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script>${TAILWIND_CONFIG}</script>
  `;
  return `<!DOCTYPE html>
<html lang="en">
  <head>${head}</head>
  <body>
    <div id="root"></div>
    <script type="module" src="${opts.jsHref}"></script>
  </body>
</html>
`;
}

// ─── Main handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  if (!cfToken || !accountId) {
    return json(503, {
      error: "Publishing isn't configured. Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID.",
    });
  }

  // Auth.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.slice("Bearer ".length),
  );
  if (claimsErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
  const userId = claims.claims.sub as string;

  // Body.
  let body: { project_id?: string; mode?: string; settings?: DeploySettings } = {};
  try { body = await req.json(); } catch { return json(400, { error: "Bad JSON body" }); }
  const projectId = body.project_id;
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return json(400, { error: "Invalid project_id" });
  }
  const settings = body.settings || {};

  // Service-role client for trusted reads/writes after we've verified ownership.
  const admin = createClient(supaUrl, svcKey);

  // Ownership check.
  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("id, user_id, name")
    .eq("id", projectId)
    .single();
  if (pErr || !project) return json(404, { error: "Project not found" });
  if (project.user_id !== userId) return json(403, { error: "Forbidden" });

  // Pull all files (Supabase caps at 1000 rows per query; paginate to be safe).
  const files: BuildFile[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ai_project_files")
      .select("path, content")
      .eq("project_id", projectId)
      .range(from, from + PAGE - 1);
    if (error) return json(500, { error: `db: ${error.message}` });
    if (!data || data.length === 0) break;
    for (const r of data) files.push({ path: r.path as string, content: (r.content as string) ?? "" });
    if (data.length < PAGE) break;
  }
  if (files.length === 0) return json(400, { error: "Project has no files" });

  // Bundle.
  let js: string, css: string, warnings: string[];
  try {
    const result = await bundleProject(files);
    js = result.js; css = result.css; warnings = result.warnings;
  } catch (e) {
    return json(500, { error: `Bundle failed: ${(e as Error).message}` });
  }
  if (!js || js.length < 50) return json(500, { error: "Bundler produced empty output" });

  // Compose index.html.
  const userHtml = files.find((f) => f.path === "index.html")?.content;
  const html = composeIndexHtml({
    userHtml,
    settings,
    jsHref: "/app.js",
    cssHref: "/app.css",
  });

  // Build the set of Pages files. V1: just html/js/css. Any /public/* assets
  // from the user are forwarded as-is.
  const enc = new TextEncoder();
  const pageFiles: PageFile[] = [
    { path: "/index.html", content: enc.encode(html), contentType: "text/html; charset=utf-8" },
    { path: "/app.js", content: enc.encode(js), contentType: "application/javascript; charset=utf-8" },
    { path: "/app.css", content: enc.encode(css || "/* no css */"), contentType: "text/css; charset=utf-8" },
  ];
  for (const f of files) {
    if (!f.path.startsWith("public/")) continue;
    const rel = "/" + f.path.slice("public/".length);
    const ct = guessContentType(rel);
    pageFiles.push({ path: rel, content: enc.encode(f.content), contentType: ct });
  }

  // Deploy.
  const name = projectNameFor(projectId);
  let deploy;
  try {
    deploy = await deployToPages({
      apiToken: cfToken,
      accountId,
      projectName: name,
      files: pageFiles,
      production: true,
    });
  } catch (e) {
    return json(500, { error: `Cloudflare deploy: ${(e as Error).message}` });
  }

  // Persist URL.
  await admin
    .from("projects")
    .update({ published_url: deploy.url, preview_url: deploy.url })
    .eq("id", projectId);

  return json(200, {
    ok: true,
    url: deploy.url,
    subdomain: deploy.subdomain,
    deploymentId: deploy.deploymentId,
    uploaded: deploy.uploaded,
    reused: deploy.reused,
    warnings,
  });
});

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    txt: "text/plain; charset=utf-8",
    xml: "application/xml",
    pdf: "application/pdf",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext] || "application/octet-stream";
}

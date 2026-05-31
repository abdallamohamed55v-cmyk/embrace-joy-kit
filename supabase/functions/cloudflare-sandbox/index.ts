/**
 * cloudflare-sandbox edge function
 *
 * Bundles a code project (React + TS files from DB) with esbuild-wasm,
 * uploads to Cloudflare Pages via Direct Upload API, and returns the
 * preview URL.
 *
 * Required env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import * as esbuild from "https://deno.land/x/esbuild@v0.21.5/wasm.js";

const ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CF = "https://api.cloudflare.com/client/v4";

let esbuildReady: Promise<void> | null = null;
async function initEsbuild() {
  if (!esbuildReady) {
    esbuildReady = esbuild.initialize({ worker: false });
  }
  return esbuildReady;
}

// In-memory esbuild plugin: resolve files from project map, externalize bare imports to esm.sh
function projectPlugin(files: Map<string, string>): esbuild.Plugin {
  return {
    name: "project-files",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        // Entry point: always treat as project file
        if (args.kind === "entry-point") {
          const p = args.path.replace(/^\.?\//, "");
          if (files.has(p)) return { path: p, namespace: "proj" };
          return { errors: [{ text: `Entry ${p} not found` }] };
        }
        // Bare module → externalize through esm.sh
        if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
          return { path: `https://esm.sh/${args.path}?bundle&target=es2022`, external: true };
        }
        const base = args.importer ? args.importer.split("/").slice(0, -1).join("/") : "";
        const p = normalize(base + "/" + args.path);
        for (const ext of ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"]) {
          if (files.has(p + ext)) return { path: p + ext, namespace: "proj" };
        }
        // Gracefully skip missing CSS/asset imports (Tailwind is loaded via CDN in index.html)
        if (/\.(css|scss|svg|png|jpe?g|gif|webp)$/.test(args.path)) {
          return { path: args.path, namespace: "stub" };
        }
        return { errors: [{ text: `Cannot resolve ${args.path} from ${args.importer}` }] };
      });
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "", loader: "js" }));
      build.onLoad({ filter: /.*/, namespace: "proj" }, (args) => {
        const contents = files.get(args.path) ?? "";
        const loader: esbuild.Loader = args.path.endsWith(".tsx") ? "tsx"
          : args.path.endsWith(".ts") ? "ts"
          : args.path.endsWith(".jsx") ? "jsx"
          : args.path.endsWith(".css") ? "css"
          : "js";
        return { contents, loader };
      });
    },
  };
}

function normalize(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

async function bundleProject(files: Array<{ path: string; content: string }>, entry: string): Promise<string> {
  await initEsbuild();
  const map = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f.content]));
  const entryPath = entry.replace(/^\/+/, "");
  if (!map.has(entryPath)) throw new Error(`entry file ${entryPath} not found`);
  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: "esm",
    target: "es2022",
    jsx: "automatic",
    write: false,
    plugins: [projectPlugin(map)],
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

function buildIndexHtml(projectName: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(projectName)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body,#root{height:100%;margin:0;background:#0a0a0a;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}</style>
</head>
<body>
<div id="root"></div>
<script type="module">
import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import App from "./app.js";
createRoot(document.getElementById("root")).render(React.createElement(App));
</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// --- Cloudflare API helpers ---
async function cf(path: string, init: RequestInit = {}, token = API_TOKEN) {
  const r = await fetch(`${CF}${path}`, {
    ...init,
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!r.ok || body?.success === false) {
    throw new Error(`CF ${path} ${r.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 400)}`);
  }
  return body;
}

async function ensurePagesProject(name: string) {
  try {
    return await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${name}`);
  } catch {
    return await cf(`/accounts/${ACCOUNT_ID}/pages/projects`, {
      method: "POST",
      body: JSON.stringify({ name, production_branch: "main" }),
    });
  }
}

async function deployToPages(projectName: string, assets: Record<string, string>): Promise<string> {
  // 1. Get upload JWT
  const jwtRes = await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/upload-token`);
  const jwt = jwtRes.result.jwt;

  // 2. Hash each asset (SHA256 of content + extension, first 32 hex chars)
  const enc = new TextEncoder();
  const manifest: Record<string, string> = {};
  const payloadByHash: Record<string, { key: string; value: string; metadata: { contentType: string }; base64: boolean }> = {};
  for (const [path, content] of Object.entries(assets)) {
    const ext = path.includes(".") ? path.slice(path.lastIndexOf(".")) : "";
    const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(content + ext));
    const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    manifest["/" + path] = hash;
    payloadByHash[hash] = {
      key: hash,
      value: btoa(unescape(encodeURIComponent(content))),
      metadata: { contentType: ctFor(path) },
      base64: true,
    };
  }

  // 3. Check missing
  const missingRes = await fetch(`${CF}/pages/assets/check-missing`, {
    method: "POST",
    headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ hashes: Object.keys(payloadByHash) }),
  }).then((r) => r.json());
  const missing: string[] = missingRes.result ?? Object.keys(payloadByHash);

  // 4. Upload missing — Cloudflare expects the array directly as the body
  if (missing.length > 0) {
    const payload = missing.map((h) => payloadByHash[h]);
    const up = await fetch(`${CF}/pages/assets/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!up.ok) {
      const t = await up.text();
      throw new Error(`upload failed: ${up.status} ${t.slice(0, 200)}`);
    }
  }

  // 5. Create deployment via multipart with manifest
  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  const depRes = await fetch(`${CF}/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/deployments`, {
    method: "POST",
    headers: { authorization: `Bearer ${API_TOKEN}` },
    body: form,
  });
  const depJson = await depRes.json();
  if (!depRes.ok || depJson?.success === false) {
    throw new Error(`deployment failed: ${JSON.stringify(depJson.errors ?? depJson).slice(0, 400)}`);
  }
  return depJson.result.url as string;
}

function ctFor(p: string): string {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function pagesNameFor(projectId: string): string {
  // ≤58 chars, lowercase alphanumeric+hyphens
  return ("megsy-" + projectId.replace(/-/g, "").slice(0, 24)).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const J = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "content-type": "application/json" } });

  try {
    if (!ACCOUNT_ID || !API_TOKEN) return J({ error: "cloudflare_not_configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return J({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return J({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json() as { action: "sync" | "destroy" | "preview"; projectId: string };
    const { action, projectId } = body;
    if (!projectId) return J({ error: "missing_projectId" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: project } = await admin
      .from("code_projects")
      .select("id, owner_id, name, entry_file")
      .eq("id", projectId)
      .maybeSingle();
    if (!project || project.owner_id !== userId) return J({ error: "forbidden" }, 403);

    const pagesName = pagesNameFor(projectId);

    const upsert = (patch: Record<string, unknown>) =>
      admin.from("code_project_sandboxes")
        .upsert({ project_id: projectId, sandbox_id: pagesName, ...patch }, { onConflict: "project_id" });

    if (action === "destroy") {
      try { await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${pagesName}`, { method: "DELETE" }); } catch {}
      await admin.from("code_project_sandboxes").delete().eq("project_id", projectId);
      return J({ ok: true });
    }

    if (action === "preview") {
      const { data } = await admin.from("code_project_sandboxes").select("preview_url, status").eq("project_id", projectId).maybeSingle();
      return J(data ?? {});
    }

    // sync (build + deploy)
    await upsert({ status: "building", last_error: null });

    const { data: rows } = await admin
      .from("code_project_files")
      .select("path, content")
      .eq("project_id", projectId);
    const files = (rows ?? []) as { path: string; content: string }[];
    if (files.length === 0) {
      await upsert({ status: "error", last_error: "no_files" });
      return J({ error: "no_files" }, 400);
    }

    const entry = project.entry_file || "src/App.tsx";

    let bundled: string;
    try {
      bundled = await bundleProject(files, entry);
    } catch (e) {
      await upsert({ status: "error", last_error: `bundle: ${(e as Error).message}` });
      return J({ error: "bundle_failed", message: (e as Error).message }, 500);
    }

    await ensurePagesProject(pagesName);

    let previewUrl: string;
    try {
      previewUrl = await deployToPages(pagesName, {
        "index.html": buildIndexHtml(project.name),
        "app.js": bundled,
      });
    } catch (e) {
      await upsert({ status: "error", last_error: `deploy: ${(e as Error).message}` });
      return J({ error: "deploy_failed", message: (e as Error).message }, 500);
    }

    await upsert({
      status: "ready",
      preview_url: previewUrl,
      last_synced_at: new Date().toISOString(),
    });

    return J({ ok: true, preview_url: previewUrl });
  } catch (e) {
    console.error("cloudflare-sandbox error", e);
    return J({ error: "server_error", message: (e as Error).message }, 500);
  }
});

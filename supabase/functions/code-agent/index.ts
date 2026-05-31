// supabase/functions/code-agent/index.ts
// AI agent that edits Megsy Code projects via tool calls.
// Uses Lovable AI Gateway (google/gemini-2.5-flash) for tool-calling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";


const SYSTEM_PROMPT = `You are Megsy Code, an AI that builds React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion web apps.

You edit project files via tool calls. Always:
- Write idiomatic, production-quality TSX
- Default to Tailwind utility classes (no inline styles unless necessary)
- Support RTL when content is Arabic
- Keep components small and composable
- Use lucide-react for icons, framer-motion for animation
- Entry file is src/App.tsx and renders a default export

When the user asks for changes, plan briefly then call tools to write files. After editing, return a short Arabic summary of what changed. Never wrap code in markdown fences in tool arguments.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file in the project.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to project root, e.g. src/App.tsx" },
          content: { type: "string", description: "Full file contents." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the current contents of a file.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all file paths currently in the project.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the project.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
];

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function userFromRequest(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await sb.auth.getUser();
  return data.user;
}

async function executeTool(sb: ReturnType<typeof admin>, projectId: string, name: string, args: any) {
  if (name === "list_files") {
    const { data } = await sb.from("code_project_files").select("path").eq("project_id", projectId);
    return { files: (data ?? []).map((r) => r.path) };
  }
  if (name === "read_file") {
    const { data } = await sb
      .from("code_project_files")
      .select("content")
      .eq("project_id", projectId)
      .eq("path", args.path)
      .maybeSingle();
    if (!data) return { error: "not_found" };
    return { path: args.path, content: data.content };
  }
  if (name === "write_file") {
    const path = String(args.path || "");
    const content = String(args.content ?? "");
    if (!path) return { error: "path_required" };
    const { error } = await sb
      .from("code_project_files")
      .upsert({ project_id: projectId, path, content }, { onConflict: "project_id,path" });
    if (error) return { error: error.message };
    return { ok: true, path, bytes: content.length };
  }
  if (name === "delete_file") {
    await sb.from("code_project_files").delete().eq("project_id", projectId).eq("path", args.path);
    return { ok: true };
  }
  return { error: "unknown_tool" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await userFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "auth_required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const projectId = String(body.projectId || "");
    const userMessage = String(body.message || "").trim();
    if (!projectId || !userMessage) {
      return new Response(JSON.stringify({ error: "projectId and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = admin();

    // Verify ownership
    const { data: project } = await sb
      .from("code_projects")
      .select("id, owner_id, name, initial_prompt")
      .eq("id", projectId)
      .maybeSingle();
    if (!project || project.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist user message
    await sb.from("code_messages").insert({
      project_id: projectId,
      role: "user",
      content: userMessage,
    });

    // Load history (last 30)
    const { data: history } = await sb
      .from("code_messages")
      .select("role, content, tool_calls, tool_results")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(30);

    // Load file index for context
    const { data: filesList } = await sb
      .from("code_project_files")
      .select("path")
      .eq("project_id", projectId);
    const fileIndex = (filesList ?? []).map((r) => r.path).join("\n") || "(empty project)";

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "no_llm_key_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build OpenAI-compatible messages
    type Msg = { role: string; content: string | null; tool_calls?: any; tool_call_id?: string; name?: string };

    // Load user's "Megsy" skill — grouped by category
    const { data: megsyItems } = await sb
      .from("megsy_code_skills")
      .select("title, content, category")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const CAT_LABEL: Record<string, string> = {
      templates: "TEMPLATES", components: "COMPONENTS", assets: "ASSETS",
      design: "DESIGN.MD", skills: "SKILLS", landing: "LANDING",
      backgrounds: "BACKGROUNDS",
    };
    let megsyBlock = "";
    if (megsyItems && megsyItems.length) {
      const groups: Record<string, string[]> = {};
      for (const it of megsyItems as any[]) {
        const k = it.category || "skills";
        (groups[k] ||= []).push(`### ${it.title}\n${it.content}`);
      }
      const order = ["templates", "components", "assets", "design", "skills", "landing", "backgrounds"];
      const sections = order
        .filter((k) => groups[k]?.length)
        .map((k) => `## ${CAT_LABEL[k]}\n${groups[k].join("\n\n")}`)
        .join("\n\n");
      megsyBlock = `\n\n# مهارة ميغسي (Megsy Skill) — قواعد أساسية يجب اتباعها في كل رد:\n${sections}`;
    }

    const messages: Msg[] = [
      { role: "system", content: `${SYSTEM_PROMPT}${megsyBlock}\n\nCurrent project files:\n${fileIndex}` },
    ];
    for (const m of history ?? []) {
      if (m.role === "assistant" && m.tool_calls) {
        messages.push({ role: "assistant", content: m.content || null, tool_calls: m.tool_calls as any });
      } else if (m.role === "tool" && m.tool_results) {
        const tr = m.tool_results as any;
        messages.push({ role: "tool", content: JSON.stringify(tr.result ?? {}), tool_call_id: tr.tool_call_id, name: tr.name });
      } else if (m.content) {
        messages.push({ role: m.role, content: m.content });
      }
    }

    const MAX_STEPS = 12;
    const editedFiles = new Set<string>();
    let finalText = "";

    for (let step = 0; step < MAX_STEPS; step++) {
      const r = await fetch(LOVABLE_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Lovable-API-Key": lovableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!r.ok) {
        const t = await r.text();
        console.error("[code-agent] llm error", r.status, t);
        return new Response(JSON.stringify({ error: "llm_error", status: r.status, detail: t.slice(0, 500) }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = await r.json();
      const choice = j.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls as any[] | undefined;
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: toolCalls });

      if (toolCalls && toolCalls.length) {
        // Persist assistant tool-call turn
        await sb.from("code_messages").insert({
          project_id: projectId,
          role: "assistant",
          content: msg.content || "",
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
          const result = await executeTool(sb, projectId, tc.function?.name, args);
          if (tc.function?.name === "write_file" || tc.function?.name === "delete_file") {
            if (args.path) editedFiles.add(String(args.path));
          }
          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: tc.id,
            name: tc.function?.name,
          });
          await sb.from("code_messages").insert({
            project_id: projectId,
            role: "tool",
            content: null,
            tool_results: { tool_call_id: tc.id, name: tc.function?.name, args, result },
          });
        }
        continue;
      }

      // No more tool calls — final message
      finalText = msg.content || "تم.";
      await sb.from("code_messages").insert({
        project_id: projectId,
        role: "assistant",
        content: finalText,
      });
      break;
    }

    // Bump project updated_at
    await sb.from("code_projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);

    // Sync edited files to the live Cloudflare sandbox (if configured)
    let previewUrl: string | null = null;
    if (Deno.env.get("CLOUDFLARE_MANAGER_URL") && editedFiles.size > 0) {
      try {
        const { data: rows } = await sb
          .from("code_project_files")
          .select("path, content")
          .in("path", Array.from(editedFiles))
          .eq("project_id", projectId);
        const syncRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cloudflare-sandbox`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: req.headers.get("Authorization") ?? "",
          },
          body: JSON.stringify({ action: "sync", projectId, files: rows ?? [] }),
        });
        const sj = await syncRes.json().catch(() => ({}));
        previewUrl = sj.preview_url ?? null;
      } catch (e) {
        console.error("[code-agent] sandbox sync failed", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, message: finalText, editedFiles: Array.from(editedFiles), previewUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[code-agent] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileCode, Loader2, RefreshCw, Send, Sparkles, Trash2, Globe, Cloud } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { buildPreviewHtml, type ProjectFile } from "@/lib/codeRuntime";
import { toast } from "sonner";

type Project = { id: string; name: string; entry_file: string; owner_id: string; initial_prompt: string | null };
type Message = { id: string; role: string; content: string | null; created_at: string };


export default function CodeWorkspacePage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"preview" | "files">("preview");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [sandbox, setSandbox] = useState<{ preview_url: string | null; status: string } | null>(null);
  const [bootingSandbox, setBootingSandbox] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  // Load project + files + messages + sandbox row
  const reload = useCallback(async () => {
    const [{ data: p }, { data: f }, { data: m }, { data: s }] = await Promise.all([
      supabase.from("code_projects").select("id,name,entry_file,owner_id,initial_prompt").eq("id", projectId).maybeSingle(),
      supabase.from("code_project_files").select("path,content").eq("project_id", projectId).order("path"),
      supabase.from("code_messages").select("id,role,content,created_at").eq("project_id", projectId).order("created_at").limit(200),
      supabase.from("code_project_sandboxes").select("preview_url,status").eq("project_id", projectId).maybeSingle(),
    ]);
    if (!p) {
      toast.error("Project not found");
      navigate("/code");
      return;
    }
    setProject(p as Project);
    setFiles((f ?? []) as ProjectFile[]);
    setMessages((m ?? []).filter((x) => x.role !== "tool") as Message[]);
    setSandbox(s as { preview_url: string | null; status: string } | null);
    setLoading(false);
  }, [projectId, navigate]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const previewHtml = useMemo(() => buildPreviewHtml(files, project?.entry_file || "src/App.tsx"), [files, project?.entry_file, previewKey]);

  const bootSandbox = useCallback(async () => {
    setBootingSandbox(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cloudflare-sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "sync", projectId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || "boot_failed");
      toast.success("Preview environment ready");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to start preview environment");
    } finally {
      setBootingSandbox(false);
    }
  }, [projectId, reload]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    // Optimistic add
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: trimmed, created_at: new Date().toISOString() }]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/code-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, message: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "agent_error");
      // Reload everything to get the persisted messages + updated files
      await reload();
      setPreviewKey((k) => k + 1);
      if (json.editedFiles?.length) {
        toast.success(`Edited ${json.editedFiles.length} file(s)`);
        try { const { triggerAha } = await import("@/lib/ahaTracker"); triggerAha("code"); } catch { /* noop */ }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "An error occurred during build");
    } finally {
      setSending(false);
    }
  }, [projectId, sending, reload]);

  // Auto-send initial prompt once
  useEffect(() => {
    if (!loading && project && params.get("autosend") === "1" && project.initial_prompt && !autoSentRef.current) {
      autoSentRef.current = true;
      const np = new URLSearchParams(params);
      np.delete("autosend");
      setParams(np, { replace: true });
      sendMessage(project.initial_prompt);
    }
  }, [loading, project, params, setParams, sendMessage]);

  const deleteProject = async () => {
    if (!confirm("Delete this project permanently?")) return;
    await supabase.from("code_projects").delete().eq("id", projectId);
    toast.success("Deleted");
    navigate("/code");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      <Helmet><title>{project?.name} · Megsy Code</title></Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>

      {/* Top bar */}
      <header className="border-b border-white/10 px-3 md:px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/code" className="text-white/50 hover:text-white shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0"><div className="w-3 h-3 bg-black rotate-45" /></div>
          <div className="min-w-0">
            <div className="font-display text-sm md:text-base font-bold truncate">{project?.name}</div>
            <div className="text-[10px] text-white/40 font-mono truncate">{project?.id.slice(0, 8)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewKey((k) => k + 1)} className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 hover:border-white/30">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button className="text-xs text-black bg-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold hover:bg-white/90">
            <Globe className="w-3.5 h-3.5" /> Publish
          </button>
          <button onClick={deleteProject} className="text-white/40 hover:text-red-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0 flex-col md:flex-row">
        {/* Chat */}
        <aside className="w-full md:w-[380px] border-l border-white/10 flex flex-col min-h-0 max-h-[50vh] md:max-h-none">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-white/40 text-sm py-10">
                <Sparkles className="w-5 h-5 mx-auto mb-3 text-white/30" />
                Describe what you want to build or change.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-white text-black" : "bg-[#111] border border-white/10 text-white/90"
                }`}>{m.content}</div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-end">
                <div className="bg-[#111] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Megsy is building…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-white/10 p-3 flex-shrink-0">
            <div className="bg-[#111] border border-white/10 rounded-xl p-2 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                }}
                placeholder="Request a change or a new feature…"
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-white/30 h-16 max-h-32"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={sending || !input.trim()}
                className="bg-white text-black rounded-lg p-2 disabled:opacity-30 active:scale-95"
              ><Send className="w-4 h-4 -scale-x-100" /></button>
            </div>
          </div>
        </aside>

        {/* Preview / Files */}
        <section className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
          <div className="flex border-b border-white/10 flex-shrink-0">
            <button onClick={() => setTab("preview")} className={`px-4 py-2 text-xs font-medium ${tab === "preview" ? "text-white border-b border-white" : "text-white/40 hover:text-white/70"}`}>Preview</button>
            <button onClick={() => setTab("files")} className={`px-4 py-2 text-xs font-medium ${tab === "files" ? "text-white border-b border-white" : "text-white/40 hover:text-white/70"}`}>Files ({files.length})</button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "preview" ? (
              sandbox?.preview_url ? (
                <iframe
                  key={previewKey}
                  title="preview"
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                  src={sandbox.preview_url}
                  className="w-full h-full bg-white"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-4 text-white/70">
                  <Cloud className="w-10 h-10 text-white/30" />
                  <div className="text-sm max-w-sm">
                    The live preview environment hasn't started on Cloudflare yet.
                    Press the button to start it (first run takes 20–40 seconds).
                  </div>
                  <button
                    onClick={bootSandbox}
                    disabled={bootingSandbox}
                    className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {bootingSandbox ? <><Loader2 className="w-4 h-4 animate-spin" /> Booting…</> : <><Cloud className="w-4 h-4" /> Start preview environment</>}
                  </button>
                  {sandbox?.status === "error" && (
                    <div className="text-xs text-red-400">Last attempt failed — please try again.</div>
                  )}
                </div>
              )
            ) : (
              <div className="h-full flex">
                <div className="w-56 border-l border-white/10 overflow-y-auto">
                  {files.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFile(f.path)}
                      className={`w-full text-left px-3 py-2 text-xs font-mono truncate flex items-center gap-2 ${
                        activeFile === f.path ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5"
                      }`}
                    >
                      <FileCode className="w-3 h-3 shrink-0" /> {f.path}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto bg-[#050505]">
                  <pre className="p-4 text-xs font-mono text-white/80 leading-relaxed whitespace-pre-wrap" dir="ltr">
                    {activeFile ? files.find((f) => f.path === activeFile)?.content : "Select a file from the list"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

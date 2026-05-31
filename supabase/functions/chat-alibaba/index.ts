import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const DASHSCOPE_SERVICES = new Set([
  "alibaba",
  "alibabacloud",
  "dashscope",
  "qwen",
  "aliyun",
  "ali",
  "qwendashscope",
  "alibabaqwen",
]);

type ChatMessage = {
  role?: string;
  content?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeService(value: unknown) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

async function getDashscopeKey(): Promise<string | null> {
  const envKey = Deno.env.get("DASHSCOPE_API_KEY") || Deno.env.get("QWEN_API_KEY") || Deno.env.get("ALIBABA_API_KEY");
  if (envKey) return envKey;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("api_keys")
    .select("service, api_key, is_active, is_blocked")
    .limit(200);

  if (error) {
    console.error("[chat-alibaba] api_keys lookup failed", error.message);
    return null;
  }

  const row = (data || []).find((item: any) => (
    DASHSCOPE_SERVICES.has(normalizeService(item.service)) &&
    item.api_key &&
    item.is_active !== false &&
    item.is_blocked !== true
  ));

  return row?.api_key || null;
}

function hasImage(messages: ChatMessage[]) {
  return messages.some((message) => Array.isArray(message.content) && message.content.some((part: any) => part?.type === "image_url" || part?.image_url));
}

function pickQwenModel(rawModel: unknown, tier: unknown, messages: ChatMessage[]) {
  if (hasImage(messages)) return "qwen-vl-max";
  const raw = String(rawModel || tier || "").toLowerCase();
  if (raw.includes("qwen-turbo")) return "qwen-turbo";
  if (raw.includes("qwen-plus")) return "qwen-plus";
  if (raw.includes("qwen-max")) return "qwen-max";
  if (raw.includes("qwen3-coder")) return raw.includes("/") ? raw.split("/").pop() || "qwen3-coder-plus" : raw;
  if (raw.includes("lite") || raw.includes("nano")) return "qwen-turbo";
  if (raw.includes("pro") || raw.includes("max")) return "qwen-max";
  return "qwen-plus";
}

function normalizeMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => ["system", "user", "assistant"].includes(String(message.role || "")))
    .map((message) => ({ role: message.role, content: message.content || "" }))
    .filter((message) => !(message.role === "assistant" && typeof message.content === "string" && !message.content.trim()));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => null);

  // --- Action: transcribe (Qwen ASR) ---
  if (body && body.action === "transcribe") {
    const apiKey = await getDashscopeKey();
    if (!apiKey) return json({ error: "Alibaba/DashScope key is not configured" }, 503);
    const audio: string = body.audio || "";
    if (!audio) return json({ error: "Missing 'audio' (base64)" }, 400);
    const mime = String(body.mimeType || "").toLowerCase();
    let format = "wav";
    if (mime.includes("mp3") || mime.includes("mpeg")) format = "mp3";
    else if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) format = "mp3";
    else if (mime.includes("ogg") || mime.includes("opus")) format = "ogg";
    else if (mime.includes("webm")) format = "webm";
    else if (mime.includes("wav")) format = "wav";
    const b64 = audio.includes(",") ? audio.split(",", 2)[1] : audio;
    const asrBody = {
      model: "qwen3-asr-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: `data:audio/${format};base64,${b64}`, format } },
            { type: "text", text: body.language ? `Transcribe in ${body.language}.` : "Transcribe the audio verbatim. Output ONLY the transcript, no commentary." },
          ],
        },
      ],
    };
    const r = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(asrBody),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[chat-alibaba/transcribe] upstream", r.status, JSON.stringify(data).slice(0, 400));
      return json({ error: data?.error?.message || "Transcription failed", details: data }, r.status);
    }
    const content = data?.choices?.[0]?.message?.content;
    let text = "";
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) text = content.map((p: any) => p?.text || "").join("");
    return json({ text: text.trim() });
  }

  const messages = Array.isArray(body?.messages) ? normalizeMessages(body.messages) : [];
  if (messages.length === 0) return json({ error: "messages are required" }, 400);

  const apiKey = await getDashscopeKey();
  if (!apiKey) return json({ error: "Alibaba/DashScope key is not configured" }, 503);

  const systemPrompt = [
    "You are Megsy, an AI assistant by Megsy AI.",
    "Be helpful, accurate, and concise. Answer naturally without canned scripts.",
    "Match the user's language and dialect exactly.",
    "If a request cannot be answered, explain the concrete reason briefly.",
  ].join("\n");

  const chosenModel = pickQwenModel(body?.model, body?.tier, messages);
  const searchEnabled = body?.searchEnabled === true || body?.deepResearch === true;

  const upstreamBody: Record<string, unknown> = {
    model: chosenModel,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: true,
    temperature: 0.6,
    max_tokens: body?.deepResearch ? 4096 : 2048,
    // Built-in Alibaba web search (no extra infra; supported by qwen-plus/max/turbo).
    enable_search: searchEnabled,
  };

  const upstream = await fetch(DASHSCOPE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(upstreamBody),
  }).catch((error) => {
    console.error("[chat-alibaba] fetch failed", error);
    return null;
  });

  if (!upstream) return json({ error: "Alibaba/DashScope request failed" }, 502);
  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => "");
    console.error("[chat-alibaba] upstream error", upstream.status, errorText.slice(0, 500));
    return json({ error: `Alibaba/DashScope error ${upstream.status}: ${errorText.slice(0, 500)}` }, upstream.status === 429 ? 429 : 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
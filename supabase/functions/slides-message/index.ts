import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getRouter, ROUTER_MODELS } from "../_shared/llm-router.ts";
import { getAuthUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const {
      mode = "plan",
      topic = "",
      kind = "slides",
      slideCount,
      title = "",
    } = await req.json();

    const router = await getRouter();
    if (!router) {
      return new Response(JSON.stringify({ error: "OpenRouter key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kindLabel = kind === "slides-images" ? "image-designed slides deck (PDF)" : "slides deck";

    const sys = mode === "plan"
      ? `You are the presenter, talking to the user in chat right BEFORE you start building their ${kindLabel}.
Write a SHORT, natural message describing your plan for this exact deck.
HARD RULES:
- Reply in EXACTLY the same language and dialect as the user's request below. Mirror Arabic dialects precisely (Egyptian, Khaleeji, Shami, Maghrebi, Iraqi, MSA, etc.).
- Be SPECIFIC to this topic: mention the angle you'll take, the key sections / story arc you're considering, or what you'll emphasize. Never use generic filler.
- Write with full freedom in length, structure, and tone — no fixed template, no required phrasing. Could be 2 sentences, could be a short paragraph, could be a tiny list. Up to you.
- Do NOT mention buttons, downloads, PDF, share, or preview — the UI handles those.
- Plain text only. No code fences.`
      : `You are the presenter, talking to the user in chat right AFTER you finished building their ${kindLabel}.
Write a SHORT, natural summary of what you actually produced.
HARD RULES:
- Reply in EXACTLY the same language and dialect as the user's request below. Mirror Arabic dialects precisely.
- Be SPECIFIC to this deck: mention the angle you took, the highlights, or what the user should pay attention to. Never use generic "your slides are ready".
- Write with full freedom — no fixed template, no required phrasing. Length, tone, and structure are up to you.
- Do NOT mention buttons, downloads, PDF, share, or preview — the UI shows those.
- Plain text only. No code fences.`;

    const user = `USER REQUEST:\n${topic}\n\nDECK TITLE: ${title || "(unset)"}\nDECK KIND: ${kindLabel}${
      slideCount ? `\nSLIDE COUNT: ${slideCount}` : ""
    }`;

    const res = await fetch(router.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${router.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ROUTER_MODELS.slides,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.85,
        max_tokens: 260,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: `gateway ${res.status}`, detail: text }), {
        status: res.status === 429 || res.status === 402 ? res.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const message = String(data?.choices?.[0]?.message?.content ?? "").trim();
    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

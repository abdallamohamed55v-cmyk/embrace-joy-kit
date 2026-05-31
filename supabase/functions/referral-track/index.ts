// Records a click on a referral link and (optionally) updates conversion.
// Public endpoint (verify_jwt = false). Uses service role to bypass RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rawCode = typeof body.code === "string" ? body.code : "";
    const code = rawCode.trim().toUpperCase().slice(0, 64);
    if (!code) {
      return new Response(JSON.stringify({ error: "code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = (body.action as string) || "click"; // "click" | "convert"
    const utm_source = (body.utm_source as string) || null;
    const utm_medium = (body.utm_medium as string) || null;
    const utm_campaign = (body.utm_campaign as string) || null;
    const referer = (body.referer as string) || req.headers.get("referer");
    const landing_path = (body.landing_path as string) || null;
    const converted_user_id = (body.converted_user_id as string) || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve referrer user_id from the code (case-insensitive)
    const { data: codeRow } = await supabase
      .from("referral_codes")
      .select("user_id, code")
      .ilike("code", code)
      .maybeSingle();

    const referrer_user_id = codeRow?.user_id || null;

    if (action === "convert" && converted_user_id) {
      // Mark most recent click for this code & user as converted
      const { data: existing } = await supabase
        .from("referral_clicks")
        .select("id")
        .eq("code", code)
        .is("converted_user_id", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (existing && existing.length > 0) {
        await supabase
          .from("referral_clicks")
          .update({
            converted_user_id,
            converted_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id);
      } else {
        await supabase.from("referral_clicks").insert({
          code,
          referrer_user_id,
          converted_user_id,
          converted_at: new Date().toISOString(),
          utm_source,
          utm_medium,
          utm_campaign,
          referer,
          landing_path,
        });
      }
      return new Response(JSON.stringify({ ok: true, action: "convert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: record click
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "";
    const country = req.headers.get("cf-ipcountry") || null;
    const user_agent = req.headers.get("user-agent") || null;
    const ip_hash = ip ? await sha256(ip + ":" + code) : null;

    const { error } = await supabase.from("referral_clicks").insert({
      code,
      referrer_user_id,
      ip_hash,
      user_agent,
      referer,
      utm_source,
      utm_medium,
      utm_campaign,
      country,
      landing_path,
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, valid: !!referrer_user_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "track failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

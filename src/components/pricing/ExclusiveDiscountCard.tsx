import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";

const SESSION_DEADLINE_KEY = "megsy_promo_deadline_v1";
const SESSION_DISMISSED_KEY = "megsy_promo_dismissed_v1";
const WINDOW_MINUTES = 15;

const fmt = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

interface Props {
  onClaim: () => void;
}

export default function ExclusiveDiscountCard({ onClaim }: Props) {
  const [name, setName] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      const display =
        (u?.user_metadata?.full_name as string | undefined) ||
        (u?.user_metadata?.name as string | undefined) ||
        (u?.email ? u.email.split("@")[0] : "");
      if (!cancelled && display) setName(String(display).split(" ")[0]);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") return; } catch {}
    const t = window.setTimeout(() => setOpen(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  const deadline = useMemo(() => {
    try {
      const existing = sessionStorage.getItem(SESSION_DEADLINE_KEY);
      if (existing) {
        const d = parseInt(existing, 10);
        if (!Number.isNaN(d) && d > Date.now()) return d;
      }
      const fresh = Date.now() + WINDOW_MINUTES * 60 * 1000;
      sessionStorage.setItem(SESSION_DEADLINE_KEY, String(fresh));
      return fresh;
    } catch { return Date.now() + WINDOW_MINUTES * 60 * 1000; }
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const handleOpen = (next: boolean) => {
    if (!next) { try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {} }
    setOpen(next);
  };

  const handleClaim = () => {
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {}
    setOpen(false);
    onClaim();
  };

  const remaining = deadline - now;
  const expired = remaining <= 0;
  const greet = name || "you";

  const perks = [
    { icon: "💬", label: "Unlimited chats — every model" },
    { icon: "🖼️", label: "Unlimited image generation" },
    { icon: "📊", label: "Unlimited slides & docs" },
    { icon: "⚡", label: "Code Builder — no limits" },
  ];

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpen}>
      <ResponsiveDialogContent desktopClassName="!max-w-[400px] !p-0 !rounded-[28px] !border-0 !bg-transparent overflow-hidden">
        <div className="sr-only">
          <ResponsiveDialogTitle>50% off Megsy Pro</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Personal offer reserved for your account.</ResponsiveDialogDescription>
        </div>

        <div className="relative overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-[#0f0f12]">
          {/* ============ TOP CREAM SECTION ============ */}
          <div
            className="relative overflow-hidden px-6 pt-6 pb-7"
            style={{
              background: "linear-gradient(160deg, #FFE8C9 0%, #FFD9A8 55%, #FFCC8A 100%)",
            }}
          >
            {/* sparkle accents */}
            <svg
              className="absolute top-4 right-4 opacity-50"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
            >
              <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" fill="#B45309" />
            </svg>
            <svg
              className="absolute top-16 right-16 opacity-30"
              width="8" height="8" viewBox="0 0 24 24" fill="none"
            >
              <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" fill="#92400E" />
            </svg>

            {/* eyebrow */}
            <div className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.18em] text-[#7C2D12] mb-3">
              <span className="font-black">Megsy</span>
              <span className="opacity-40">|</span>
              <span>EXCLUSIVE · {greet.toUpperCase()}</span>
            </div>

            <h2 className="text-[#1a1a1a] font-black text-[26px] leading-[1.05] tracking-tight">
              Megsy Pro Sale
            </h2>
            <p className="mt-1.5 text-[12.5px] text-[#3a2a14] font-medium">
              Ends in <span className="font-black text-[#7C2D12] font-mono tabular-nums">{expired ? "00:00" : fmt(remaining)}</span>
            </p>

            {/* big hero with orb */}
            <div className="relative mt-5 flex items-end justify-between">
              <div>
                <div
                  className="font-black text-[#0a0a0a] leading-none tracking-tighter"
                  style={{ fontSize: "62px", letterSpacing: "-0.06em" }}
                >
                  50%
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-[20px] font-black text-[#0a0a0a]">OFF</span>
                  <span className="text-[11px] font-semibold text-[#5a3a14]">1st month</span>
                </div>
              </div>

              {/* Decorative orb (CSS only — no asset needed) */}
              <div className="relative w-[120px] h-[120px] -mr-2 -mb-2">
                {/* outer ring */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, #FFFBE9 0%, #F5C16C 35%, #C97B2A 70%, #7C2D12 100%)",
                    boxShadow:
                      "inset -10px -14px 30px rgba(124,45,18,0.55), inset 8px 10px 20px rgba(255,255,255,0.7), 0 12px 24px -8px rgba(124,45,18,0.45)",
                  }}
                />
                {/* center glow */}
                <div
                  className="absolute inset-3 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.5), rgba(255,200,120,0.1) 50%, transparent 75%)",
                  }}
                />
                {/* Megsy mark */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 1L14.39 8.26L22 9.27L16.5 14.14L17.78 22L12 18.27L6.22 22L7.5 14.14L2 9.27L9.61 8.26L12 1Z"
                      fill="#fff"
                      stroke="#7C2D12"
                      strokeWidth="0.6"
                    />
                  </svg>
                </div>
                {/* highlight bubble */}
                <div className="absolute top-3 left-4 w-5 h-3.5 rounded-full bg-white/70 blur-[1px]" />
              </div>
            </div>
          </div>

          {/* ============ BOTTOM DARK SECTION ============ */}
          <div className="relative bg-[#0f0f12] px-5 pt-5 pb-5">
            <p className="text-[12.5px] text-white/55 px-1 mb-3">
              Become a Megsy Pro and unlock:
            </p>

            <ul className="space-y-1">
              {perks.map((p) => (
                <li
                  key={p.label}
                  className="flex items-center gap-3 px-2 py-2 rounded-xl"
                >
                  <span className="w-9 h-9 grid place-items-center rounded-full bg-white/[0.06] border border-white/10 text-base shrink-0">
                    {p.icon}
                  </span>
                  <span className="text-[13.5px] text-white/90 font-medium leading-tight">
                    {p.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Special bonus row (gradient like the reference) */}
            <div
              className="relative mt-3 flex items-center gap-3 px-3 py-3 rounded-2xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(95deg, rgba(168,85,247,0.22) 0%, rgba(236,72,153,0.22) 100%)",
                border: "1px solid rgba(236,72,153,0.35)",
              }}
            >
              <span className="w-9 h-9 grid place-items-center rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 text-base shrink-0 shadow-lg shadow-fuchsia-500/30">
                🎁
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white font-semibold leading-tight">
                  Get <span className="text-fuchsia-300 font-black">3 months</span> bonus credits
                </div>
                <div className="text-[10.5px] text-white/55 mt-0.5">Megsy OS · agent runs 24/7</div>
              </div>
              <span className="text-[9px] font-black tracking-widest text-fuchsia-200 uppercase shrink-0">
                Special
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={handleClaim}
              disabled={expired}
              className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-bold text-[14px] tracking-tight active:scale-[0.98] transition-transform shadow-[0_10px_24px_-6px_rgba(245,158,11,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {expired ? "Offer expired" : "Claim my 50% off"}
            </button>

            <button
              onClick={() => handleOpen(false)}
              className="w-full mt-1 py-2 text-[11px] text-white/40 hover:text-white/65 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpen}>
      <ResponsiveDialogContent desktopClassName="!max-w-md !p-0 !rounded-[28px] !border-0 !bg-transparent">
        <div className="sr-only">
          <ResponsiveDialogTitle>Your 50% discount</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Personal offer reserved for your account.</ResponsiveDialogDescription>
        </div>

        <div className="relative bg-[#0a0a0e] text-white overflow-hidden rounded-t-[28px] sm:rounded-[28px] border border-amber-400/15">
          {/* Premium gold header band */}
          <div className="relative h-[78px] overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, rgba(251,191,36,0.45) 0%, rgba(180,83,9,0.25) 45%, rgba(10,10,14,0) 75%)",
              }}
            />
            {/* shimmer diagonal */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  "linear-gradient(115deg, transparent 30%, rgba(255,215,0,0.22) 50%, transparent 70%)",
                animation: "header-shine 4s ease-in-out infinite",
              }}
            />
            {/* gold hairline at bottom of band */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

            {/* eyebrow centered in band */}
            <div className="relative h-full flex items-center justify-center">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/40 border border-amber-300/30 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                <span className="text-[10px] font-bold tracking-[0.28em] text-amber-200 uppercase">
                  Exclusive · Personal Offer
                </span>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes shimmer-line {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            @keyframes header-shine {
              0%, 100% { transform: translateX(-15%); }
              50% { transform: translateX(15%); }
            }
          `}</style>

          <div className="relative px-7 pt-8 pb-7 text-center">
            {/* Hero number */}
            <div className="relative inline-flex items-start">
              <div
                className="font-black leading-none tracking-tighter bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(251,191,36,0.25)]"
                style={{ fontSize: "clamp(5rem, 20vw, 7rem)", letterSpacing: "-0.06em" }}
              >
                50
              </div>
              <div className="flex flex-col items-start ml-1 mt-2">
                <span
                  className="font-black leading-none bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent"
                  style={{ fontSize: "clamp(2rem, 8vw, 2.75rem)" }}
                >
                  %
                </span>
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-300/90 mt-1.5">
                  OFF
                </span>
              </div>
            </div>

            <h2
              className="mt-3 font-medium text-white/95 leading-tight"
              style={{ fontSize: "clamp(1rem, 3.8vw, 1.2rem)", letterSpacing: "-0.01em" }}
            >
              Reserved for <span className="text-amber-300 font-semibold">{greet}</span>
            </h2>

            <p className="mt-1.5 text-[12px] text-white/45 leading-relaxed max-w-[270px] mx-auto">
              Not a public promo · opened for your account only
            </p>


            {/* Subtle divider */}
            <div className="mt-7 mb-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Price row */}
            <div className="flex items-baseline justify-center gap-3 mb-1">
              <span className="text-xl text-white/30 line-through font-medium">$58</span>
              <span className="text-5xl font-black text-white tracking-tight tabular-nums">$29</span>
              <span className="text-sm text-white/50 font-medium">/mo</span>
            </div>
            <div className="text-[11px] text-white/40 tracking-wide">
              Pro · Unlimited everything
            </div>

            {/* Countdown — minimal */}
            <div className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
              </span>
              <span className="text-[10.5px] text-white/55 uppercase tracking-[0.15em]">Expires in</span>
              <span className="text-[12.5px] font-mono font-bold text-white tabular-nums">
                {expired ? "00:00" : fmt(remaining)}
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={handleClaim}
              disabled={expired}
              className="group relative mt-7 w-full overflow-hidden py-4 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-bold text-[14.5px] tracking-tight active:scale-[0.98] transition-transform shadow-[0_10px_30px_-8px_rgba(245,158,11,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">
                {expired ? "Offer expired" : "Claim my discount"}
              </span>
              <span
                aria-hidden
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                style={{ animation: "shimmer-line 2.8s ease-in-out infinite" }}
              />
            </button>

            <button
              onClick={() => handleOpen(false)}
              className="mt-2 w-full py-2 text-[11.5px] text-white/35 hover:text-white/60 transition-colors"
            >
              Maybe later
            </button>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 text-[10.5px] text-white/30 tracking-wide"
            >
              Cancel anytime · No commitment
            </motion.div>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

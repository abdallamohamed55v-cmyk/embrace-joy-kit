import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const SESSION_DEADLINE_KEY = "megsy_promo_deadline_v1";
const SESSION_DISMISSED_KEY = "megsy_promo_dismissed_v1";
const WINDOW_MINUTES = 15;
const baseClaimedToday = 2847;

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

interface Props {
  onClaim: () => void;
}

export default function ExclusiveDiscountCard({ onClaim }: Props) {
  const [name, setName] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());
  const [open, setOpen] = useState<boolean>(false);
  const [claimed] = useState<number>(() => baseClaimedToday + Math.floor(Math.random() * 7));

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
    try {
      if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") return;
    } catch {}
    const t = window.setTimeout(() => setOpen(true), 600);
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
    } catch {
      return Date.now() + WINDOW_MINUTES * 60 * 1000;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {}
    }
    setOpen(next);
  };

  const handleClaim = () => {
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {}
    setOpen(false);
    onClaim();
  };

  const remaining = deadline - now;
  const expired = remaining <= 0;
  const pct = Math.max(0, Math.min(100, (remaining / (WINDOW_MINUTES * 60 * 1000)) * 100));
  const greeting = name ? `${name},` : "Hey there,";

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent
        desktopClassName="!max-w-lg !p-0 !rounded-2xl border-amber-400/20 bg-[#0a0a14] text-white"
      >
        <VisuallyHidden>
          <ResponsiveDialogTitle>Exclusive 50% discount</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            A personal offer reserved for your account.
          </ResponsiveDialogDescription>
        </VisuallyHidden>

        <div className="relative bg-gradient-to-br from-[#0a0a14] via-[#13101f] to-[#0a0a14] text-white">
          <style>{`
            @keyframes ribbon-shine-modal {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(220%); }
            }
          `}</style>

          {/* Gradient hairline at top */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

          {/* Ribbon */}
          <div className="px-5 sm:px-7 pt-5">
            <div className="relative inline-flex overflow-hidden px-3 py-1 rounded-md bg-gradient-to-b from-amber-400 to-amber-600 text-[10px] font-black tracking-[0.18em] text-black">
              EXCLUSIVE · RESERVED FOR YOU
              <span
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                style={{ animation: "ribbon-shine-modal 2.6s ease-in-out infinite" }}
              />
            </div>
          </div>

          {/* Title + copy */}
          <div className="px-5 sm:px-7 pt-3 pb-2">
            <h2 className="font-black leading-[1.1] text-[clamp(1.35rem,5vw,1.9rem)]">
              {greeting} here's <span className="text-amber-400">50% OFF</span>
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">
                reserved just for you
              </span>
            </h2>
            <p className="mt-2 text-[12.5px] sm:text-sm text-white/70 leading-relaxed">
              This isn't a public offer — it was opened for your account right now.
              Leave and it goes back to others in line.
            </p>
          </div>

          {/* Unlimited grid */}
          <div className="px-5 sm:px-7">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                "Unlimited chats",
                "Unlimited images",
                "Unlimited slides",
                "Unlimited docs",
                "Unlimited Code",
                "Megsy OS 24/7",
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-[12px] font-semibold text-white/90">
                  <span className="text-amber-300 font-black">∞</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Save + countdown */}
          <div className="px-5 sm:px-7 pt-4">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">You save / year</div>
                  <div className="font-black text-3xl text-amber-300 leading-none">$348</div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Less than <span className="text-white font-bold">$0.79 / day</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Ends in</div>
                  <div className="font-mono font-black text-amber-300 text-2xl tabular-nums">
                    {expired ? "00:00" : formatTime(remaining)}
                  </div>
                </div>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-red-400"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="px-5 sm:px-7 pt-4 pb-5">
            <button
              onClick={handleClaim}
              disabled={expired}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-sm tracking-wide active:scale-[0.99] transition-transform shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {expired ? "Offer expired" : "Claim my 50% — Pro $29/mo"}
            </button>
            <button
              onClick={() => handleOpenChange(false)}
              className="w-full mt-1.5 py-2 text-[11px] text-white/45 hover:text-white/70 transition-colors"
            >
              No thanks, I'll pay full price later
            </button>

            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10.5px] text-white/50">
              <span>Cancel anytime · No commitment</span>
              <span>
                +<span className="text-white font-bold">{claimed.toLocaleString("en-US")}</span> this week
              </span>
            </div>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

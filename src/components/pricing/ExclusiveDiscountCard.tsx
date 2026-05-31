import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

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

  // Open as a popup shortly after mount, unless dismissed this session
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

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleClose = () => {
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {}
    setOpen(false);
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto overscroll-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exclusive-discount-title"
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl my-auto"
          >
            {/* Soft glow */}
            <div className="absolute inset-0 -z-10 blur-3xl opacity-60 bg-gradient-to-r from-amber-500/40 via-fuchsia-500/30 to-emerald-500/40 rounded-[32px]" />

            <div
              className="relative overflow-hidden rounded-t-[24px] sm:rounded-[28px] p-[1.5px]"
              style={{
                background:
                  "conic-gradient(from var(--angle,0deg), #FFD700, #ff5e9c, #7c3aed, #10b981, #FFD700)",
                animation: "exclusive-spin 8s linear infinite",
              }}
            >
              <style>{`
                @keyframes exclusive-spin { to { --angle: 360deg; } }
                @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
                @keyframes ribbon-shine {
                  0% { transform: translateX(-120%); }
                  100% { transform: translateX(220%); }
                }
              `}</style>

              <div className="relative rounded-t-[22px] sm:rounded-[26px] bg-gradient-to-br from-[#0a0a14] via-[#13101f] to-[#0a0a14] text-white p-5 sm:p-9 max-h-[100dvh] sm:max-h-[88dvh] overflow-y-auto">

                {/* Close */}
                <button
                  onClick={handleClose}
                  aria-label="Close"
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors text-lg font-light"
                >
                  ×
                </button>

                {/* Ribbon */}
                <div className="absolute -top-1 left-6 sm:left-10 z-10">
                  <div className="relative overflow-hidden px-4 py-1.5 rounded-b-xl bg-gradient-to-b from-amber-400 to-amber-600 text-[10px] sm:text-[11px] font-black tracking-[0.18em] text-black shadow-xl shadow-amber-900/40">
                    EXCLUSIVE • RESERVED FOR YOU
                    <span
                      className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                      style={{ animation: "ribbon-shine 2.6s ease-in-out infinite" }}
                    />
                  </div>
                </div>

                <div className="pt-5">
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold tracking-wider mb-3 uppercase">
                    Hand-picked from thousands of users
                  </div>

                  <h2
                    id="exclusive-discount-title"
                    className="font-black leading-[1.05] text-[clamp(1.4rem,4vw,2.4rem)] mb-2.5"
                  >
                    {greeting} here's <span className="text-amber-400">50% OFF</span>
                    <br />
                    <span className="bg-gradient-to-r from-amber-300 via-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">
                      reserved just for you
                    </span>
                  </h2>

                  <p className="text-[13px] sm:text-base text-white/70 leading-relaxed mb-4">
                    This isn't a public offer — it was opened for your account right now.
                    Leave and it goes back to other users in line.
                  </p>

                  {/* Unlimited list — no icons */}
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
                    {[
                      "Unlimited chats",
                      "Unlimited images",
                      "Unlimited slides",
                      "Unlimited docs",
                      "Unlimited Code",
                      "Megsy OS 24/7",
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex items-center gap-1.5 text-[12px] sm:text-[13px] font-semibold text-white/90"
                      >
                        <span className="text-amber-300 font-black">∞</span>
                        {t}
                      </li>
                    ))}
                  </ul>

                  {/* Save block */}
                  <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 sm:p-5 mb-4">
                    <div className="flex items-end justify-between gap-3 mb-3">
                      <div>
                        <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">You save / year</div>
                        <div className="font-black text-3xl sm:text-5xl text-amber-300 leading-none">$348</div>
                        <div className="text-[10px] text-white/50 mt-1">
                          Less than <span className="text-white font-bold">$0.79 / day</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Ends in</div>
                        <div className="font-mono font-black text-amber-300 text-xl sm:text-3xl">
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


                  <button
                    onClick={handleClaim}
                    disabled={expired}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-sm tracking-wide hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg shadow-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {expired ? "Offer expired" : "Claim my 50% — Pro $29/mo"}
                  </button>

                  <button
                    onClick={handleClose}
                    className="w-full mt-2 py-2 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                  >
                    No thanks, I'll pay full price later
                  </button>

                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
                    <span>Cancel anytime · No commitment</span>
                    <span>
                      Joined by <span className="text-white font-bold">+{claimed.toLocaleString("en-US")}</span> this week
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

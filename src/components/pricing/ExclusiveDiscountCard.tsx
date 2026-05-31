import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MegsyStar from "@/components/files/MegsyStar";

const SESSION_DEADLINE_KEY = "megsy_promo_deadline_v1";
const SESSION_DISMISSED_KEY = "megsy_promo_dismissed_v1";
const WINDOW_MINUTES = 60 * 24; // 24h flash sale

const fmt = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

interface Props {
  onClaim: () => void;
}

export default function ExclusiveDiscountCard({ onClaim }: Props) {
  const [, setName] = useState("");
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") return;
    } catch {}
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
    } catch {
      return Date.now() + WINDOW_MINUTES * 60 * 1000;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const handleClaim = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    } catch {}
    setOpen(false);
    onClaim();
  };

  const remaining = deadline - now;
  const expired = remaining <= 0;

  const perks = [
    "Unlimited AI chats",
    "Unlimited image generation",
    "Unlimited slides & docs",
    "Code Builder — no limits",
  ];

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Megsy Pro exclusive offer"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6 font-sans"
      style={{ background: "#FF4D00" }}
    >
      {/* Close */}
      <button
        onClick={close}
        aria-label="Close"
        className="absolute top-5 right-5 z-20 text-white/90 hover:text-white font-black text-xs uppercase tracking-[0.2em] border-b-2 border-white/40 hover:border-white pb-1 transition-colors"
      >
        Close
      </button>

      <div
        className="relative w-full max-w-[380px] bg-[#FFFBF0] rounded-[40px] overflow-hidden flex flex-col border-4 border-black my-auto"
        style={{ boxShadow: "0 40px 80px -15px rgba(0,0,0,0.5)" }}
      >
        {/* ===== TOP CREAM ===== */}
        <div className="pt-10 px-7 pb-10 z-10">
          <div className="mb-5">
            <div className="inline-block bg-black text-white px-3 py-1 rounded-sm mb-2">
              <span className="uppercase font-black text-[10px] tracking-[0.3em]">
                Premium Access
              </span>
            </div>
            <h3 className="uppercase font-black text-2xl tracking-tighter text-[#FF4D00]">
              Megsy Pro
            </h3>
          </div>

          <div className="leading-[0.85]">
            <h1
              className="font-black text-black tracking-[-0.05em]"
              style={{ fontSize: "clamp(88px,28vw,118px)" }}
            >
              50%
            </h1>
            <div className="flex items-end gap-3 -mt-3">
              <h2
                className="font-black text-black tracking-tighter"
                style={{ fontSize: "clamp(56px,18vw,76px)" }}
              >
                OFF
              </h2>
              <div className="mb-3">
                <span
                  className="bg-[#FF4D00] text-white px-3 py-2 text-[11px] font-black uppercase block -rotate-2"
                  style={{ boxShadow: "4px 4px 0 0 #000" }}
                >
                  Now or never
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div
              className="bg-white border-2 border-black p-4 flex flex-col"
              style={{ boxShadow: "4px 4px 0 0 #000" }}
            >
              <span className="text-[10px] font-black uppercase text-black/40 leading-none mb-1.5 tracking-wider">
                Flash sale ends in
              </span>
              <span className="text-3xl font-black tabular-nums tracking-tighter text-black leading-none font-mono">
                {expired ? "00:00:00" : fmt(remaining)}
              </span>
            </div>
          </div>
        </div>

        {/* ===== BOTTOM DARK ===== */}
        <div className="relative flex-1 bg-[#0F0F0F] p-7 pt-10 border-t-4 border-black">
          {/* Bonus badge */}
          <div className="absolute top-0 left-7 -translate-y-1/2">
            <div
              className="bg-[#FFD700] px-5 py-2.5 border-2 border-black flex items-center gap-2"
              style={{ boxShadow: "4px 4px 0 0 #000" }}
            >
              <span className="text-black">
                <MegsyStar size={14} static />
              </span>
              <span className="font-black text-black text-[11px] uppercase tracking-tight">
                +3 Months Free Credits
              </span>
            </div>
          </div>

          <ul className="mt-4 space-y-5">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white">
                <span className="text-[#FF4D00] shrink-0">
                  <MegsyStar size={14} static />
                </span>
                <span className="font-bold text-[15px] leading-none tracking-tight">
                  {p}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleClaim}
            disabled={expired}
            className="mt-9 w-full py-5 bg-[#FF4D00] text-white font-black text-lg border-2 border-black uppercase tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px]"
            style={{ boxShadow: "6px 6px 0 0 #000" }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <MegsyStar size={16} static />
              {expired ? "Offer expired" : "Get 50% Discount"}
            </span>
          </button>

          <div className="mt-6 flex justify-center">
            <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] border-t border-white/10 pt-4 w-full text-center">
              Secure checkout • Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

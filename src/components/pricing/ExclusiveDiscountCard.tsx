import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

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

/** Megsy mark (the only icon allowed inside this card). */
function MegsyMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 1L14.39 8.26L22 9.27L16.5 14.14L17.78 22L12 18.27L6.22 22L7.5 14.14L2 9.27L9.61 8.26L12 1Z"
        fill="currentColor"
      />
    </svg>
  );
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

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
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
  const greet = name || "you";

  const perks = [
    "Unlimited chats — every model",
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
      className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0e] text-white overflow-y-auto"
    >
      {/* Close */}
      <button
        onClick={close}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-9 h-9 grid place-items-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* ================= TOP — gold hero band ================= */}
      <section
        className="relative px-6 pt-14 pb-12 overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, #FFE8C9 0%, #FFD9A8 50%, #FFCC8A 100%)",
        }}
      >
        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.22em] text-[#7C2D12] uppercase">
          <MegsyMark size={14} className="text-[#7C2D12]" />
          <span>Megsy Exclusive</span>
        </div>

        <h1 className="mt-4 text-center text-[#0a0a0a] font-black tracking-tight text-[34px] sm:text-[42px] leading-[1.02]">
          Reserved for {greet}
        </h1>
        <p className="mt-2 text-center text-[13px] sm:text-[14px] text-[#3a2a14] font-medium">
          A personal offer · not a public promo
        </p>

        {/* Hero number */}
        <div className="mt-8 flex items-end justify-center gap-3">
          <span
            className="font-black text-[#0a0a0a] leading-none tracking-tighter"
            style={{ fontSize: "clamp(96px, 28vw, 168px)", letterSpacing: "-0.07em" }}
          >
            50%
          </span>
          <span
            className="font-black text-[#0a0a0a] leading-none pb-2"
            style={{ fontSize: "clamp(28px, 7vw, 40px)" }}
          >
            OFF
          </span>
        </div>

        <p className="mt-4 text-center text-[12px] font-semibold tracking-wider text-[#5a3a14] uppercase">
          1st month of Megsy Pro
        </p>

        {/* Countdown */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0a0a0e]/90 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[11px] tracking-[0.18em] uppercase text-white/60">
              Ends in
            </span>
            <span className="text-[14px] font-bold font-mono tabular-nums">
              {expired ? "00:00" : fmt(remaining)}
            </span>
          </div>
        </div>
      </section>

      {/* ================= MIDDLE — dark perks ================= */}
      <section className="flex-1 px-6 py-10 sm:py-12 max-w-xl w-full mx-auto">
        <h2 className="text-center text-white/55 text-[12px] tracking-[0.22em] uppercase font-bold mb-6">
          Everything unlocked
        </h2>

        <ul className="space-y-3">
          {perks.map((label) => (
            <li
              key={label}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.07]"
            >
              <MegsyMark size={18} className="text-amber-300 shrink-0" />
              <span className="text-[15px] text-white/90 font-medium leading-tight">
                {label}
              </span>
            </li>
          ))}
        </ul>

        {/* Price */}
        <div className="mt-10 text-center">
          <div className="flex items-baseline justify-center gap-3">
            <span className="text-[18px] text-white/35 line-through font-medium">
              $58
            </span>
            <span className="text-white font-black tracking-tighter text-[56px] sm:text-[64px] leading-none">
              $29
            </span>
            <span className="text-[14px] text-white/55 font-medium">/mo</span>
          </div>
          <p className="mt-2 text-[12px] text-white/45">
            Then $58/mo · cancel anytime
          </p>
        </div>
      </section>

      {/* ================= BOTTOM — CTA ================= */}
      <section className="sticky bottom-0 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/95 to-transparent">
        <div className="max-w-xl mx-auto">
          <button
            onClick={handleClaim}
            disabled={expired}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-bold text-[15px] tracking-tight active:scale-[0.99] transition-transform shadow-[0_18px_40px_-12px_rgba(245,158,11,0.55)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {expired ? "Offer expired" : "Claim my 50% off"}
          </button>
          <button
            onClick={close}
            className="w-full mt-2 py-3 text-[12px] text-white/45 hover:text-white/75 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </section>
    </div>
  );
}

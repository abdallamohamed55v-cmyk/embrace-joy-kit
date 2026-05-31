import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import MegsyStar from "@/components/files/MegsyStar";

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
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #1a1410 0%, #08070a 55%, #000 100%)",
        color: "#fff",
      }}
    >
      {/* Close */}
      <button
        onClick={close}
        aria-label="Close"
        className="absolute top-4 right-4 z-20 w-10 h-10 grid place-items-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/70 hover:text-white backdrop-blur transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* ================= HERO ================= */}
      <section className="relative px-6 pt-16 pb-10 flex flex-col items-center text-center">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[460px]"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 30%, rgba(245,180,90,0.28) 0%, rgba(245,180,90,0.05) 45%, transparent 75%)",
          }}
        />

        {/* Brand sparkle */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -m-6 rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(250,200,120,0.55), transparent 70%)" }}
          />
          <div className="relative text-amber-300">
            <MegsyStar size={56} />
          </div>
        </div>

        {/* Eyebrow */}
        <div className="relative mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.24em] uppercase text-white/80">
            Personal offer · {greet}
          </span>
        </div>

        {/* Hero number */}
        <div className="relative mt-8 flex items-start justify-center">
          <span
            className="font-black leading-[0.85] tracking-tighter bg-clip-text text-transparent"
            style={{
              fontSize: "clamp(140px, 42vw, 220px)",
              letterSpacing: "-0.08em",
              backgroundImage:
                "linear-gradient(180deg, #FFE9B8 0%, #F5B45A 55%, #C97A18 100%)",
              filter: "drop-shadow(0 12px 40px rgba(245,180,90,0.35))",
            }}
          >
            50
          </span>
          <span
            className="font-black text-amber-200 leading-none mt-3"
            style={{ fontSize: "clamp(48px, 14vw, 80px)" }}
          >
            %
          </span>
        </div>

        <h1 className="relative mt-2 text-white font-black tracking-tight text-[22px] sm:text-[26px]">
          off your first month
        </h1>
        <p className="relative mt-2 text-[13px] text-white/55 max-w-xs">
          A one-time invitation to Megsy Pro — not a public promo.
        </p>

        {/* Countdown */}
        <div className="relative mt-7 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/40 border border-white/10 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] tracking-[0.2em] uppercase text-white/55">
            Expires in
          </span>
          <span className="text-[14px] font-bold font-mono tabular-nums text-white">
            {expired ? "00:00" : fmt(remaining)}
          </span>
        </div>
      </section>

      {/* ================= PERKS ================= */}
      <section className="px-6 pb-8 max-w-md w-full mx-auto">
        <div className="rounded-3xl bg-white/[0.03] border border-white/[0.08] p-5 backdrop-blur">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-300">
              <MegsyStar size={14} static />
            </span>
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-white/55">
              What you unlock
            </span>
          </div>
          <ul className="space-y-3.5">
            {perks.map((label) => (
              <li key={label} className="flex items-start gap-3">
                <span className="mt-[3px] text-amber-300 shrink-0">
                  <MegsyStar size={14} static />
                </span>
                <span className="text-[14.5px] text-white/90 font-medium leading-snug">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Price */}
        <div className="mt-7 text-center">
          <div className="flex items-baseline justify-center gap-2.5">
            <span className="text-[16px] text-white/35 line-through font-medium">
              $58
            </span>
            <span
              className="font-black tracking-tighter leading-none bg-clip-text text-transparent"
              style={{
                fontSize: "clamp(48px, 14vw, 64px)",
                backgroundImage:
                  "linear-gradient(180deg, #fff 0%, #d8d8d8 100%)",
              }}
            >
              $29
            </span>
            <span className="text-[13px] text-white/45 font-medium">/mo</span>
          </div>
          <p className="mt-1.5 text-[11px] text-white/35 tracking-wide">
            Then $58/mo · cancel anytime
          </p>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="sticky bottom-0 mt-auto px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black via-black/90 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleClaim}
            disabled={expired}
            className="group relative w-full py-4 rounded-2xl text-black font-bold text-[15px] tracking-tight active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, #FFE082 0%, #F5B45A 50%, #E89A2A 100%)",
              boxShadow:
                "0 20px 50px -12px rgba(245,180,90,0.6), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            <span className="relative inline-flex items-center justify-center gap-2">
              <MegsyStar size={14} static />
              {expired ? "Offer expired" : "Claim my 50% off"}
            </span>
          </button>
          <button
            onClick={close}
            className="w-full mt-2 py-3 text-[12px] text-white/40 hover:text-white/70 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </section>
    </div>
  );
}

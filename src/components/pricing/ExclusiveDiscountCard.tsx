import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import MegsyStar from "@/components/files/MegsyStar";

const LOCAL_DEADLINE_KEY = "megsy_promo_deadline_v2";
const SESSION_DISMISSED_KEY = "megsy_promo_dismissed_v1";
const PROMO_KEY = "megsy_pro_50";
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);

  // Resolve the deadline: prefer Supabase row for logged-in user, else localStorage, else create fresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      // Logged-in: read from supabase
      if (user) {
        const { data: row } = await supabase
          .from("promo_deadlines")
          .select("deadline_at")
          .eq("user_id", user.id)
          .eq("promo_key", PROMO_KEY)
          .maybeSingle();

        if (cancelled) return;

        if (row?.deadline_at) {
          const d = new Date(row.deadline_at).getTime();
          if (d > Date.now()) {
            setDeadline(d);
            try { localStorage.setItem(LOCAL_DEADLINE_KEY, String(d)); } catch {}
            return;
          }
        }

        // No valid row → create one
        const fresh = Date.now() + WINDOW_MS;
        await supabase.from("promo_deadlines").upsert(
          {
            user_id: user.id,
            promo_key: PROMO_KEY,
            deadline_at: new Date(fresh).toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (cancelled) return;
        setDeadline(fresh);
        try { localStorage.setItem(LOCAL_DEADLINE_KEY, String(fresh)); } catch {}
        return;
      }

      // Guest: localStorage
      try {
        const existing = localStorage.getItem(LOCAL_DEADLINE_KEY);
        if (existing) {
          const d = parseInt(existing, 10);
          if (!Number.isNaN(d) && d > Date.now()) {
            setDeadline(d);
            return;
          }
        }
        const fresh = Date.now() + WINDOW_MS;
        localStorage.setItem(LOCAL_DEADLINE_KEY, String(fresh));
        setDeadline(fresh);
      } catch {
        setDeadline(Date.now() + WINDOW_MS);
      }
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

  const remaining = deadline ? deadline - now : WINDOW_MS;
  const expired = deadline !== null && remaining <= 0;

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
      {/* Close — high contrast circular button */}
      <button
        onClick={close}
        aria-label="Close"
        className="absolute top-5 right-5 z-20 w-11 h-11 grid place-items-center rounded-full bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors"
        style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.6)" }}
      >
        <X className="w-5 h-5" strokeWidth={3} />
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
              <span className="text-[11px] font-black uppercase text-black leading-none mb-2 tracking-wider">
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
              <span className="font-black text-black text-[11px] uppercase tracking-tight">
                +3 Months Free Credits
              </span>
            </div>
          </div>

          <ul className="mt-4 space-y-5">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white">
                <span className="text-[#FF4D00] shrink-0">
                  <MegsyStar size={16} static />
                </span>
                <span className="font-bold text-[15px] leading-none tracking-tight text-white">
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
            {expired ? "Offer expired" : "Get 50% Discount"}
          </button>
        </div>
      </div>
    </div>
  );
}

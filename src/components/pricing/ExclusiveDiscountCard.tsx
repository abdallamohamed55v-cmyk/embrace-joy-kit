import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Crown, Infinity as InfinityIcon, Zap, Shield, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_DEADLINE_KEY = "megsy_promo_deadline_v1";
const SESSION_VIEWS_KEY = "megsy_promo_views_v1";
const WINDOW_MINUTES = 15;

// Soft, believable social-proof counter — grows over a session, not random
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
  const [claimed] = useState<number>(() => baseClaimedToday + Math.floor(Math.random() * 7));

  // Resolve a friendly first name for personalisation (falls back to "أنت")
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

  // Session-bound deadline: locks the urgency to a real, persistent moment
  const deadline = useMemo(() => {
    try {
      const existing = sessionStorage.getItem(SESSION_DEADLINE_KEY);
      if (existing) {
        const d = parseInt(existing, 10);
        if (!Number.isNaN(d) && d > Date.now()) return d;
      }
      const fresh = Date.now() + WINDOW_MINUTES * 60 * 1000;
      sessionStorage.setItem(SESSION_DEADLINE_KEY, String(fresh));
      // Bump views counter (used for subtle escalation later)
      const v = (parseInt(sessionStorage.getItem(SESSION_VIEWS_KEY) || "0", 10) || 0) + 1;
      sessionStorage.setItem(SESSION_VIEWS_KEY, String(v));
      return fresh;
    } catch {
      return Date.now() + WINDOW_MINUTES * 60 * 1000;
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = deadline - now;
  const expired = remaining <= 0;
  const pct = Math.max(0, Math.min(100, (remaining / (WINDOW_MINUTES * 60 * 1000)) * 100));

  const greeting = name ? `${name}،` : "مرحباً،";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      dir="rtl"
      className="relative mx-auto max-w-5xl"
    >
      {/* Outer glow */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-60 bg-gradient-to-r from-amber-500/40 via-fuchsia-500/30 to-emerald-500/40 rounded-[32px]" />

      <div
        className="relative overflow-hidden rounded-[28px] p-[1.5px]"
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

        <div className="relative rounded-[26px] bg-gradient-to-br from-[#0a0a14] via-[#13101f] to-[#0a0a14] text-white p-6 sm:p-8">
          {/* Shimmering ribbon */}
          <div className="absolute -top-1 right-6 sm:right-10 z-10">
            <div className="relative overflow-hidden px-4 py-1.5 rounded-b-xl bg-gradient-to-b from-amber-400 to-amber-600 text-[10px] sm:text-[11px] font-black tracking-[0.18em] text-black shadow-xl shadow-amber-900/40">
              EXCLUSIVE • محجوز باسمك
              <span
                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                style={{ animation: "ribbon-shine 2.6s ease-in-out infinite" }}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-[1.2fr_1fr] gap-7 items-center">
            {/* Left: pitch */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold tracking-wider mb-4">
                <Sparkles className="w-3 h-3 text-amber-400" />
                تم اختيارك من بين آلاف المستخدمين
              </div>

              <h2 className="font-black leading-[1.05] text-[clamp(1.6rem,4.2vw,2.5rem)] mb-3">
                {greeting} خصم <span className="text-amber-400">50%</span>
                <br />
                <span className="bg-gradient-to-r from-amber-300 via-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">
                  محجوز لك وحدك
                </span>
              </h2>

              <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-5">
                ده مش عرض عام — ده عرض شخصي اتفتح لحسابك دلوقتي. لو خرجت قبل ما تأكّد،
                الخصم بيرجع لحسابات تانية في الانتظار.
              </p>

              {/* Unlimited list */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                {[
                  { icon: InfinityIcon, t: "محادثات بلا حدود" },
                  { icon: InfinityIcon, t: "صور بلا حدود" },
                  { icon: InfinityIcon, t: "عروض وسلايدز بلا حدود" },
                  { icon: InfinityIcon, t: "مستندات وأبحاث بلا حدود" },
                  { icon: InfinityIcon, t: "Code Builder بلا حدود" },
                  { icon: Zap, t: "Megsy OS — agent 24/7" },
                ].map((row) => (
                  <li
                    key={row.t}
                    className="flex items-center gap-2 text-[13px] font-semibold"
                  >
                    <span className="w-6 h-6 grid place-items-center rounded-md bg-amber-400/15 border border-amber-400/30">
                      <row.icon className="w-3.5 h-3.5 text-amber-300" />
                    </span>
                    {row.t}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <Users className="w-3 h-3" />
                <span>
                  انضم لـ <span className="text-white font-bold">+{claimed.toLocaleString("en-US")}</span> مستخدم فعّلوا الخصم هذا الأسبوع
                </span>
              </div>
            </div>

            {/* Right: action card */}
            <div className="relative rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                  <Crown className="w-3 h-3" />
                  Pro Welcome
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${expired ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                  {expired ? "انتهى" : "نشط"}
                </span>
              </div>

              {/* Big save number — anchoring */}
              <div className="text-center mb-4">
                <div className="text-[11px] text-white/50 mb-1">توفّر سنوياً</div>
                <div className="font-black text-4xl sm:text-5xl text-amber-300 leading-none">
                  $348
                </div>
                <div className="text-[11px] text-white/50 mt-1">
                  أقل من <span className="text-white font-bold">$0.79 / يوم</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 mb-4">
                <div className="flex items-center justify-between text-[10px] text-white/60 mb-1.5">
                  <span>ينتهي العرض خلال</span>
                  <span className="font-mono font-bold text-amber-300 text-base">
                    {expired ? "00:00" : formatTime(remaining)}
                  </span>
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
                onClick={onClaim}
                disabled={expired}
                className="group w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {expired ? "العرض انتهى" : "احجز خصمي — Pro $29/شهر"}
              </button>

              <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-white/40">
                <Shield className="w-3 h-3" />
                إلغاء في أي وقت • بدون التزام
              </div>

              {/* The wall — what you lose if you don't claim */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">
                  بدون Pro ستبقى عند:
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <Lock className="w-3 h-3 text-red-400/70" />
                  حدود يومية + انتظار في الطابور + لا OS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

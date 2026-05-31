import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "megsy_pro_upsell_v1_seen";
const DISCOUNT = 50;

const PERKS = [
  "صور بدون حدود (Unlimited Images)",
  "عروض تقديمية بدون حدود (Unlimited Slides)",
  "مستندات وتقارير بدون حدود (Unlimited Docs)",
  "بحث عميق وذكاء أعلى",
  "أولوية في السرعة والدعم",
  "تخصيص كامل للـ Workspaces",
];

export default function ProUpsellModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (typeof window === "undefined") return;
        if (localStorage.getItem(STORAGE_KEY)) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        // Skip if user already on a paid plan
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", session.user.id)
          .maybeSingle();
        const plan = (profile?.plan || "free").toLowerCase();
        if (plan !== "free" && plan !== "hobby") return;
        if (cancelled) return;
        // Small delay so it doesn't fight the first paint
        setTimeout(() => !cancelled && setOpen(true), 1200);
      } catch {
        /* noop */
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* noop */ }
    setOpen(false);
  };

  const goPricing = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* noop */ }
    setOpen(false);
    navigate("/pricing?promo=WELCOME50");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={dismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pro-upsell-title"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-md rounded-3xl bg-background border border-border shadow-2xl overflow-hidden"
            dir="rtl"
          >
            {/* Top accent gradient */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent pointer-events-none" />

            <button
              onClick={dismiss}
              aria-label="إغلاق"
              className="absolute top-3 left-3 z-10 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative p-7 pt-9">
              {/* Discount badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold tracking-wide mb-4">
                <Sparkles className="w-3 h-3" />
                عرض ترحيبي • خصم {DISCOUNT}%
              </div>

              <h2 id="pro-upsell-title" className="text-2xl font-bold leading-snug mb-2">
                ابدأ بـ <span className="text-primary">Megsy Pro</span> بنص السعر
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                خصم {DISCOUNT}% على أول اشتراك في خطة Pro — متاح لفترة محدودة لحساباتك الجديدة.
              </p>

              <ul className="space-y-2.5 mb-7">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span className="text-foreground/90">{perk}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                <button
                  onClick={goPricing}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-[0.99] transition"
                >
                  فعّل خصم {DISCOUNT}% الآن
                </button>
                <button
                  onClick={dismiss}
                  className="w-full py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground transition"
                >
                  ربما لاحقاً
                </button>
              </div>

              <p className="mt-4 text-[10px] text-center text-muted-foreground/70">
                * الخصم لا يشمل خدمات الفيديو والبرمجة
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

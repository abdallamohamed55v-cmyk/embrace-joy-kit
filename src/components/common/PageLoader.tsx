import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MESSAGES = [
  "Preparing your page",
  "Loading the magic",
  "Polishing pixels",
  "Megsy is thinking",
  "Almost there",
  "Arranging words & visuals",
  "Hang tight",
  "Lighting up the star",
];

/**
 * Full-screen route loader — "Rotating Pulse" design.
 * Soft breathing star with subtle glow + uppercase tracked status text.
 */
const PageLoader = () => {
  const [show, setShow] = useState(false);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * MESSAGES.length));

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 180);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!show) return;
    const i = setInterval(() => setIdx((p) => (p + 1) % MESSAGES.length), 1800);
    return () => clearInterval(i);
  }, [show]);

  if (!show) return <div className="h-screen bg-background" />;

  return (
    <div className="relative h-screen w-full bg-background flex flex-col items-center justify-center overflow-hidden">
      <div className="relative flex flex-col items-center gap-10">
        {/* Breathing star with glow */}
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 blur-xl bg-primary/30 rounded-full scale-150" />
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10 text-primary"
          >
            <path
              d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8L12 0Z"
              fill="currentColor"
            />
          </svg>
        </motion.div>

        {/* Status text */}
        <div className="flex flex-col items-center h-10">
          <AnimatePresence mode="wait">
            <motion.span
              key={idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35 }}
              className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground antialiased"
            >
              {MESSAGES[idx]}
            </motion.span>
          </AnimatePresence>
          <div className="mt-4 h-px w-8 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default PageLoader;

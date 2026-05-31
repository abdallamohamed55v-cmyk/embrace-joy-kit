import { motion } from "framer-motion";

const models = [
  { name: "Megsy", flagship: true },
  { name: "GPT-5.5" },
  { name: "Gemini 3 Pro" },
  { name: "Claude 4.5" },
  { name: "Nano Banana Pro" },
  { name: "GPT-Image 2" },
  { name: "Veo 3.1" },
  { name: "Kling 3 Pro" },
  { name: "Runway Gen-4" },
  { name: "Grok 4" },
  { name: "DeepSeek" },
  { name: "Recraft V4" },
  { name: "Ideogram 3" },
  { name: "Luma Ray" },
];

const StatsMarquee = () => {
  const items = [...models, ...models, ...models, ...models];

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="relative overflow-hidden border-y border-border/10 bg-background py-5 md:py-8 mt-10 md:mt-16"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 md:w-40 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 md:w-40 bg-gradient-to-l from-background to-transparent" />
      <div className="landing-marquee">
        <div className="landing-marquee-track" style={{ animationDuration: "60s" }}>
          {items.map((m, i) => (
            <span
              key={i}
              className={`inline-flex items-center whitespace-nowrap px-5 md:px-12 text-lg md:text-3xl font-bold tracking-tight ${
                m.flagship
                  ? "font-display text-primary text-xl md:text-4xl"
                  : "text-muted-foreground/30"
              }`}
            >
              {m.name}
            </span>
          ))}
        </div>

      </div>
    </motion.section>
  );
};

export default StatsMarquee;

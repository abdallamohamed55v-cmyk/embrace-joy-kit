import { Check, Loader2, X, Power, Mail, Send, Cloud, Github, Database, Plug } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import type { Integration } from "@/lib/integrationsData";

const ICONS: Record<string, JSX.Element> = {
  github: <Github className="w-7 h-7" />,
  supabase: <Database className="w-7 h-7" />,
  email: <Mail className="w-7 h-7" />,
  telegram: <Send className="w-7 h-7" />,
  cloudflare: <Cloud className="w-7 h-7" />,
};

const descriptions: Record<string, string> = {
  github:
    "Connect GitHub via OAuth to push code, create repos, and read repository contents directly from the app.",
  supabase:
    "Link your Supabase project via OAuth to manage data, migrations, and edge functions from the app.",
  email:
    "Get important notifications by email. Powered by Resend on the backend — no third-party login required.",
  telegram:
    "Receive notifications on Telegram. Open the bot, send /start, then paste your chat id here.",
  cloudflare:
    "Cloudflare Pages deployment runs through a backend API token. Status is shown when the server token is configured.",
};

interface FormState {
  email_address?: string;
  telegram_chat_id?: string;
  telegram_username?: string;
}

interface Props {
  integration: Integration | null;
  isConnected: boolean;
  isLoading: boolean;
  meta?: Record<string, any>; // populated by parent: { email_address?, telegram_chat_id?, available? }
  onConnect: (form?: FormState) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export default function IntegrationDetailModal({
  integration,
  isConnected,
  isLoading,
  meta,
  onConnect,
  onDisconnect,
  onClose,
}: Props) {
  const [email, setEmail] = useState("");
  const [chatId, setChatId] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!integration) return;
    setEmail(meta?.email_address ?? "");
    setChatId(meta?.telegram_chat_id ?? "");
    setUsername(meta?.telegram_username ?? "");
  }, [integration, meta]);

  if (!integration) return null;

  const isService = integration.type === "service";
  const isNotification = integration.type === "notification";
  const available = meta?.available !== false;

  const submit = () => {
    if (integration.app === "email") return onConnect({ email_address: email });
    if (integration.app === "telegram")
      return onConnect({ telegram_chat_id: chatId, telegram_username: username });
    return onConnect();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md liquid-glass rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="relative p-6 pb-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center ${
                  isConnected ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/30 border-border/30 text-foreground/80"
                }`}
              >
                {ICONS[integration.app] ?? (integration.type === "pipedream" ? <Plug className="w-7 h-7" /> : (
                  <span className="text-2xl font-bold">{integration.name.charAt(0)}</span>
                ))}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{integration.name}</h2>
                <p className="text-xs text-muted-foreground">{integration.category}</p>
                {isConnected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-emerald-500 font-medium">Connected</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70 mb-1.5">
                About
              </p>
              <p className="text-sm text-foreground/85 leading-relaxed">
                {descriptions[integration.app] ?? integration.description}
              </p>
            </div>

            {!available && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This integration is not configured on the server yet.
                </p>
              </div>
            )}

            {/* Inline form */}
            {integration.app === "email" && (
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/40 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {integration.app === "telegram" && (
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
                  Your Telegram chat id
                </label>
                <input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="123456789"
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/40 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/40 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Get your id by messaging @userinfobot on Telegram.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border/20">
            {isService ? (
              <div
                className={`w-full py-3 rounded-xl text-center text-sm font-medium ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {isConnected ? "Configured on the server" : "Not configured on the server"}
              </div>
            ) : isConnected ? (
              <button
                onClick={onDisconnect}
                disabled={isLoading}
                className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={isLoading || !available}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Power className="w-4 h-4" />
                    {isNotification ? `Enable ${integration.name}` : `Connect ${integration.name}`}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

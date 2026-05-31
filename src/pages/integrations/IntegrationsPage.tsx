// Integrations page — first-party flows (GitHub/Supabase/Email/Telegram/Cloudflare)
// plus top apps via Pipedream Connect.
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Check, Mail, Send, Cloud, Github, Database, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { integrations, INTEGRATION_CATEGORIES, type Integration } from "@/lib/integrationsData";
import IntegrationDetailModal from "@/components/integrations/IntegrationDetailModal";

const ICONS: Record<string, JSX.Element> = {
  github: <Github className="w-6 h-6" />,
  supabase: <Database className="w-6 h-6" />,
  email: <Mail className="w-6 h-6" />,
  telegram: <Send className="w-6 h-6" />,
  cloudflare: <Cloud className="w-6 h-6" />,
};
const PIPEDREAM_ICON = <Plug className="w-6 h-6" />;

type AppMeta = Record<string, any>;

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({});
  const [appMeta, setAppMeta] = useState<Record<string, AppMeta>>({});
  const [loadingApp, setLoadingApp] = useState<string | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    setIsLoadingConnections(true);
    try {
      const [github, supa, notify, cf, pd] = await Promise.all([
        supabase.functions.invoke("github-push", { body: { action: "status" } }),
        supabase.functions.invoke("supabase-link-manager", { body: { action: "status" } }),
        supabase.functions.invoke("notify-user", { body: { action: "status" } }),
        supabase.functions.invoke("check-cf-secrets", { body: {} }),
        supabase.functions.invoke("pipedream-connect", { body: { action: "list_accounts" } }),
      ]);

      const connected: Record<string, boolean> = {};
      const meta: Record<string, AppMeta> = {};

      if (!github.error && github.data?.connected) connected.github = true;
      if (!supa.error && supa.data?.connected) connected.supabase = true;

      if (!notify.error && notify.data) {
        meta.email = { ...notify.data.email };
        meta.telegram = { ...notify.data.telegram };
        if (notify.data.email?.connected) connected.email = true;
        if (notify.data.telegram?.connected) connected.telegram = true;
      }

      const cfOk = !cf.error && cf.data?.verify?.success === true;
      meta.cloudflare = { available: cfOk };
      if (cfOk) connected.cloudflare = true;

      if (!pd.error && Array.isArray(pd.data?.accounts)) {
        for (const a of pd.data.accounts) {
          const slug = a.app_slug ?? a.app?.name_slug ?? a.app?.slug;
          if (!slug) continue;
          connected[slug] = true;
          meta[slug] = { account_id: a.account_id ?? a.id, account_name: a.account_name ?? a.name };
        }
      }

      setConnectedApps(connected);
      setAppMeta(meta);
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const handleConnect = async (integration: Integration, form?: any) => {
    setLoadingApp(integration.id);
    try {
      if (integration.type === "pipedream" && integration.pipedreamSlug) {
        const { data, error } = await supabase.functions.invoke("pipedream-connect", {
          body: { action: "create_token" },
        });
        if (error || data?.error || !data?.connect_link_url) {
          throw new Error(data?.error || error?.message || "Pipedream not configured");
        }
        const url = `${data.connect_link_url}&app=${encodeURIComponent(integration.pipedreamSlug)}`;
        const popup = window.open(url, `pd-${integration.app}`, "width=600,height=750");
        if (!popup) throw new Error("Allow popups to complete the connection");

        // Poll for the new account every 2s; stop when found or popup closes.
        await new Promise<void>((resolve) => {
          const start = Date.now();
          const timer = window.setInterval(async () => {
            if (popup.closed || Date.now() - start > 180_000) {
              window.clearInterval(timer);
              resolve();
              return;
            }
            const { data: poll } = await supabase.functions.invoke("pipedream-connect", {
              body: { action: "list_accounts" },
            });
            const found = (poll?.accounts || []).some(
              (a: any) => (a.app_slug ?? a.app?.name_slug ?? a.app?.slug) === integration.pipedreamSlug,
            );
            if (found) {
              window.clearInterval(timer);
              try { popup.close(); } catch {}
              resolve();
            }
          }, 2500);
        });

        await loadConnections();
        if (connectedApps[integration.app]) toast.success(`${integration.name} connected`);
        setSelectedIntegration(null);
        return;
      }

      if (integration.app === "github" || integration.app === "supabase") {
        const popup = window.open("about:blank", `${integration.app}-oauth`, "width=600,height=750");
        try {
          const startFn = integration.app === "github" ? "oauth-github-connect" : "supabase-oauth-start";
          const { data, error } = await supabase.functions.invoke(startFn, {
            body: { redirect_to: window.location.href },
          });
          if (error || data?.error || !data?.authorize_url) {
            throw new Error(data?.error || error?.message || "OAuth is not configured");
          }
          if (!popup) throw new Error("Allow popups to complete the connection");
          popup.location.href = data.authorize_url;

          await new Promise<void>((resolve) => {
            const listener = (ev: MessageEvent) => {
              if (ev.data?.type !== `${integration.app}-oauth`) return;
              window.removeEventListener("message", listener);
              window.clearInterval(poll);
              resolve();
            };
            window.addEventListener("message", listener);
            const poll = window.setInterval(() => {
              if (popup.closed) {
                window.clearInterval(poll);
                window.removeEventListener("message", listener);
                resolve();
              }
            }, 1000);
          });

          await loadConnections();
          toast.success(`${integration.name} connected`);
          setSelectedIntegration(null);
        } catch (e) {
          if (popup && !popup.closed) popup.close();
          throw e;
        }
        return;
      }

      if (integration.app === "email" || integration.app === "telegram") {
        const { data, error } = await supabase.functions.invoke("notify-user", {
          body: { action: "connect", app: integration.app, ...(form || {}) },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Failed");
        await loadConnections();
        toast.success(`${integration.name} enabled`);
        setSelectedIntegration(null);
        return;
      }

      if (integration.app === "cloudflare") {
        toast.info("Cloudflare is configured by the server administrator.");
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${integration.name} connection failed`);
    } finally {
      setLoadingApp(null);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    setLoadingApp(integration.id);
    try {
      if (integration.type === "pipedream") {
        const accountId = appMeta[integration.app]?.account_id;
        if (accountId) {
          await supabase.functions.invoke("pipedream-connect", {
            body: { action: "delete_account", account_id: accountId },
          });
        }
      } else if (integration.app === "github") {
        await supabase.functions.invoke("github-push", { body: { action: "disconnect" } });
      } else if (integration.app === "supabase") {
        await supabase.functions.invoke("supabase-link-manager", { body: { action: "disconnect" } });
      } else if (integration.app === "email" || integration.app === "telegram") {
        await supabase.functions.invoke("notify-user", {
          body: { action: "disconnect", app: integration.app },
        });
      }
      await loadConnections();
      toast.success(`${integration.name} disconnected`);
      setSelectedIntegration(null);
    } finally {
      setLoadingApp(null);
    }
  };

  const isConnected = (app: string) => !!connectedApps[app];

  const grouped = useMemo(() => {
    const out: { category: string; items: Integration[] }[] = [];
    INTEGRATION_CATEGORIES.filter((c) => c !== "All").forEach((cat) => {
      const items = integrations.filter((i) => i.category === cat);
      if (items.length) out.push({ category: cat, items });
    });
    return out;
  }, []);

  const connectedCount = Object.keys(connectedApps).filter((k) => connectedApps[k]).length;

  const Card = ({ integration }: { integration: Integration }) => {
    const connected = isConnected(integration.app);
    return (
      <button
        onClick={() => setSelectedIntegration(integration)}
        className="group relative bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border/60 grid place-items-center shrink-0 text-foreground/80 group-hover:scale-105 transition-transform">
            {ICONS[integration.app] ?? (integration.type === "pipedream" ? PIPEDREAM_ICON : (
              <span className="text-[14px] font-semibold text-foreground/70">
                {integration.name.charAt(0)}
              </span>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-[14px] font-semibold text-foreground truncate">
                {integration.name}
              </h3>
              {connected && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase shrink-0 inline-flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Linked
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
              {integration.description}
            </p>
            <div
              className={`mt-4 w-full py-2 px-4 rounded-xl border text-[13px] font-semibold text-center transition-colors ${
                connected
                  ? "border-primary/20 bg-primary/5 text-primary"
                  : "border-border text-foreground/80 group-hover:bg-muted"
              }`}
            >
              {connected ? "Manage" : integration.type === "service" ? "Details" : "Connect"}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const Content = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="max-w-4xl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">
            First-party integrations powered by Supabase — no third-party aggregator.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card p-1.5 pr-4 rounded-2xl border border-border shadow-sm self-start md:self-auto">
          <div className="h-10 px-4 flex items-center bg-primary/10 text-primary rounded-xl font-semibold text-sm">
            {connectedCount} Connected
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {integrations.length} Available
          </span>
        </div>
      </div>

      {isLoadingConnections ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-12">
          {grouped.map((group) => (
            <section key={group.category}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  {group.category}
                </h2>
                <div className="h-px flex-1 bg-border/60"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map((i) => (
                  <Card key={i.id} integration={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <IntegrationDetailModal
        integration={selectedIntegration}
        isConnected={selectedIntegration ? isConnected(selectedIntegration.app) : false}
        isLoading={selectedIntegration ? loadingApp === selectedIntegration.id : false}
        meta={selectedIntegration ? appMeta[selectedIntegration.app] : undefined}
        onConnect={(form) => selectedIntegration && handleConnect(selectedIntegration, form)}
        onDisconnect={() => selectedIntegration && handleDisconnect(selectedIntegration)}
        onClose={() => setSelectedIntegration(null)}
      />
    </motion.div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout
        title="Integrations"
        subtitle={`${integrations.length} apps · grouped by category`}
      >
        <Content />
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="h-[100dvh] bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 pb-16">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate("/settings")}
            className="w-9 h-9 grid place-items-center rounded-xl text-foreground/70 hover:bg-muted/50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Integrations</h1>
        </div>
        <div className="pt-2">
          <Content />
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;

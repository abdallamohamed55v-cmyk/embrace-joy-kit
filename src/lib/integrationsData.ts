// Integrations — GitHub & Supabase via native OAuth, plus top 20 apps via Pipedream Connect.
// Pipedream gives one-click OAuth for 2700+ apps; we expose the most-requested 20 here.

export type IntegrationType = "oauth" | "notification" | "service" | "pipedream";

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  app: string;          // internal app key (used for ICONS lookup)
  type: IntegrationType;
  pipedreamSlug?: string; // Pipedream app name_slug (for `type: "pipedream"`)
}

export const INTEGRATION_CATEGORIES = [
  "All",
  "Development",
  "Productivity",
  "Communication",
  "Marketing",
  "Storage",
  "Notifications",
  "Deployment",
] as const;

export const integrations: Integration[] = [
  // ── Native (first-party) ───────────────────────────────────────────
  {
    id: "github",
    name: "GitHub",
    description: "Push code, create repos, and read repositories from chat.",
    category: "Development",
    app: "github",
    type: "oauth",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Link your Supabase project to manage data and migrations.",
    category: "Development",
    app: "supabase",
    type: "oauth",
  },
  {
    id: "email",
    name: "Email Notifications",
    description: "Receive important updates by email via Resend.",
    category: "Notifications",
    app: "email",
    type: "notification",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Receive notifications and chat with the bot on Telegram.",
    category: "Notifications",
    app: "telegram",
    type: "notification",
  },
  {
    id: "cloudflare",
    name: "Cloudflare Pages",
    description: "Deploy your apps to Cloudflare Pages from the platform.",
    category: "Deployment",
    app: "cloudflare",
    type: "service",
  },

  // ── Top 20 via Pipedream Connect ───────────────────────────────────
  // Productivity
  { id: "google_sheets", name: "Google Sheets", description: "Read and write data in your spreadsheets.", category: "Productivity", app: "google_sheets", type: "pipedream", pipedreamSlug: "google_sheets" },
  { id: "google_drive", name: "Google Drive", description: "Upload, list, and share files in Drive.", category: "Storage", app: "google_drive", type: "pipedream", pipedreamSlug: "google_drive" },
  { id: "google_docs", name: "Google Docs", description: "Create and edit documents programmatically.", category: "Productivity", app: "google_docs", type: "pipedream", pipedreamSlug: "google_docs" },
  { id: "google_calendar", name: "Google Calendar", description: "Manage events and check availability.", category: "Productivity", app: "google_calendar", type: "pipedream", pipedreamSlug: "google_calendar" },
  { id: "gmail", name: "Gmail", description: "Send and read emails on your behalf.", category: "Communication", app: "gmail", type: "pipedream", pipedreamSlug: "gmail" },
  { id: "notion", name: "Notion", description: "Create pages, query databases, and update content.", category: "Productivity", app: "notion", type: "pipedream", pipedreamSlug: "notion" },
  { id: "airtable", name: "Airtable", description: "Read/write bases and records.", category: "Productivity", app: "airtable_oauth", type: "pipedream", pipedreamSlug: "airtable_oauth" },

  // Communication
  { id: "slack", name: "Slack", description: "Send messages and manage channels.", category: "Communication", app: "slack", type: "pipedream", pipedreamSlug: "slack" },
  { id: "discord", name: "Discord", description: "Post to channels via your bot.", category: "Communication", app: "discord", type: "pipedream", pipedreamSlug: "discord" },
  { id: "whatsapp_business", name: "WhatsApp Business", description: "Send WhatsApp messages via Cloud API.", category: "Communication", app: "whatsapp_business", type: "pipedream", pipedreamSlug: "whatsapp_business" },
  { id: "microsoft_teams", name: "Microsoft Teams", description: "Send messages to channels and chats.", category: "Communication", app: "microsoft_teams", type: "pipedream", pipedreamSlug: "microsoft_teams" },
  { id: "microsoft_outlook", name: "Outlook", description: "Send and manage emails on Outlook.", category: "Communication", app: "microsoft_outlook", type: "pipedream", pipedreamSlug: "microsoft_outlook" },

  // Marketing & CRM
  { id: "hubspot", name: "HubSpot", description: "Sync contacts, deals, and tickets.", category: "Marketing", app: "hubspot", type: "pipedream", pipedreamSlug: "hubspot" },
  { id: "mailchimp", name: "Mailchimp", description: "Manage audiences and send campaigns.", category: "Marketing", app: "mailchimp", type: "pipedream", pipedreamSlug: "mailchimp" },
  { id: "stripe", name: "Stripe", description: "Read customers, charges, and subscriptions.", category: "Marketing", app: "stripe", type: "pipedream", pipedreamSlug: "stripe" },
  { id: "shopify", name: "Shopify", description: "Manage products, orders, and customers.", category: "Marketing", app: "shopify_developer_app", type: "pipedream", pipedreamSlug: "shopify_developer_app" },
  { id: "linkedin", name: "LinkedIn", description: "Post updates and read profile data.", category: "Marketing", app: "linkedin", type: "pipedream", pipedreamSlug: "linkedin" },

  // Storage
  { id: "dropbox", name: "Dropbox", description: "Upload and manage files in Dropbox.", category: "Storage", app: "dropbox", type: "pipedream", pipedreamSlug: "dropbox" },
  { id: "microsoft_onedrive", name: "OneDrive", description: "Manage files in Microsoft OneDrive.", category: "Storage", app: "microsoft_onedrive", type: "pipedream", pipedreamSlug: "microsoft_onedrive" },

  // Dev tools
  { id: "linear", name: "Linear", description: "Create and update issues in Linear.", category: "Development", app: "linear", type: "pipedream", pipedreamSlug: "linear" },
];

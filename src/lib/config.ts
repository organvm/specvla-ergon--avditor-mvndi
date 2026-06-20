/**
 * App configuration — env vars + hardcoded defaults.
 * No SQLite, no native modules, no filesystem access.
 * Safe to import from any context (SSR, API routes, client).
 *
 * For admin-editable config, use the /api/admin/config API route
 * which handles its own database access.
 */

const defaults: Record<string, string> = {
  geminiApiKey: "",
  supabaseUrl: "",
  supabaseKey: "",
  stripeSecretKey: "",
  stripeWebhookSecret: "",
  posthogKey: "",
  posthogHost: "https://us.i.posthog.com",
  resendApiKey: "",
  cronSecret: "",
  adminEmails: "admin@growthauditor.ai",
  authPassword: "cosmic", // allow-secret
  nextAuthSecret: "",
  baseUrl: "http://localhost:3000",
  stripePricePro: "price_pro_placeholder",
  stripePricePremium: "price_premium_placeholder",
  subscriptionPriceMonthly: "price_monthly_placeholder",
  subscriptionPriceYearly: "price_yearly_placeholder",
  enableSubscriptions: "false",
  enableMonthlyAudits: "true",
  emailFrom: "hello@growthauditor.ai",
  appName: "Avditor Mvndi",
  appTagline: "Cosmic Strategy & Digital Alignment",
  primaryColor: "#7000ff",
  accentColor: "#00d4ff",
  logoUrl: "",
  faviconUrl: "",
  customCss: "",
  webhookUrl: "",
  webhookSecret: "",
};

// Map config keys to environment variable names
const envMap: Record<string, string> = {
  geminiApiKey: "GEMINI_API_KEY",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseKey: "SUPABASE_SERVICE_ROLE_KEY",
  stripeSecretKey: "STRIPE_SECRET_KEY",
  stripeWebhookSecret: "STRIPE_WEBHOOK_SECRET",
  posthogKey: "NEXT_PUBLIC_POSTHOG_KEY",
  posthogHost: "NEXT_PUBLIC_POSTHOG_HOST",
  resendApiKey: "RESEND_API_KEY",
  cronSecret: "CRON_SECRET",
  adminEmails: "ADMIN_EMAILS",
  authPassword: "AUTH_PASSWORD", // allow-secret
  nextAuthSecret: "NEXTAUTH_SECRET",
  baseUrl: "NEXT_PUBLIC_BASE_URL",
  stripePricePro: "STRIPE_PRICE_PRO",
  stripePricePremium: "STRIPE_PRICE_PREMIUM",
  appName: "NEXT_PUBLIC_APP_NAME",
  webhookUrl: "WEBHOOK_URL",
  webhookSecret: "WEBHOOK_SECRET",
};

export function getConfig(key: string): string | null {
  // Check env var first
  const envKey = envMap[key];
  if (envKey && process.env[envKey]) {
    return process.env[envKey]!;
  }
  return defaults[key] ?? null;
}

export function getAllConfig(): Record<string, string> {
  const config: Record<string, string> = { ...defaults };
  for (const [key, envKey] of Object.entries(envMap)) {
    if (process.env[envKey]) {
      config[key] = process.env[envKey]!;
    }
  }
  return config;
}

// No-ops in env-var mode — admin config writes go through API routes
export function setConfig(_key: string, _value: string): void {
  // In production, config is set via environment variables.
  // The admin API route handles SQLite writes for local dev.
}

export function deleteConfig(_key: string): void {
  // No-op in env-var mode
}

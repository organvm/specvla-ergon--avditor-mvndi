export interface EnvStatus {
  key: string;
  label: string;
  configured: boolean;
  required: boolean;
  category: "database" | "ai" | "payments" | "email" | "analytics" | "monitoring" | "auth";
}

/** Check that an env var is set and not a known placeholder value. */
function isRealValue(val: string | undefined): boolean {
  if (!val) return false;
  return !val.endsWith("_placeholder");
}

export function getEnvStatus(): EnvStatus[] {
  return [
    { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL, required: false, category: "database" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Key", configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY, required: false, category: "database" },
    { key: "GEMINI_API_KEY", label: "Gemini API Key (server)", configured: !!process.env.GEMINI_API_KEY, required: false, category: "ai" },
    { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", configured: isRealValue(process.env.STRIPE_SECRET_KEY), required: false, category: "payments" },
    { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", configured: isRealValue(process.env.STRIPE_WEBHOOK_SECRET), required: false, category: "payments" },
    { key: "RESEND_API_KEY", label: "Resend API Key", configured: isRealValue(process.env.RESEND_API_KEY), required: false, category: "email" },
    { key: "NEXT_PUBLIC_POSTHOG_KEY", label: "PostHog Key", configured: isRealValue(process.env.NEXT_PUBLIC_POSTHOG_KEY), required: false, category: "analytics" },
    { key: "NEXT_PUBLIC_SENTRY_DSN", label: "Sentry DSN", configured: !!process.env.NEXT_PUBLIC_SENTRY_DSN, required: false, category: "monitoring" },
    { key: "CRON_SECRET", label: "Cron Secret", configured: !!process.env.CRON_SECRET, required: false, category: "auth" },
    { key: "ADMIN_EMAILS", label: "Admin Emails", configured: !!process.env.ADMIN_EMAILS, required: false, category: "auth" },
  ];
}

export function getConfiguredCount(): { configured: number; total: number } {
  const statuses = getEnvStatus();
  return {
    configured: statuses.filter(s => s.configured).length,
    total: statuses.length,
  };
}

import { getAudits, getLeads, getScheduledAudits, type AuditRecord } from "@/lib/db";
import { getEnvStatus } from "@/lib/env";

export type DashboardStatus = "healthy" | "degraded";
export type ServiceState = "operational" | "degraded";

export interface DashboardMetrics {
  generatedAt: string;
  status: DashboardStatus;
  usage: {
    totalAudits: number;
    auditsLast7Days: number;
    auditsLast30Days: number;
    uniqueUsers: number;
    totalLeads: number;
    leadConversionRate: number;
    activeSchedules: number;
    totalSchedules: number;
  };
  quality: {
    averageScore: number;
    scoredAudits: number;
  };
  trends: {
    auditsByDay: Array<{ date: string; count: number }>;
  };
  topDomains: Array<{ domain: string; count: number }>;
  topBusinessTypes: Array<{ type: string; count: number }>;
  services: Array<{ name: string; state: ServiceState; detail: string }>;
  readiness: Array<{ category: string; configured: number; total: number }>;
  recentAudits: Array<{ id: string; link: string; businessType: string; createdAt?: string }>;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(now: Date, days: number): Date {
  const d = startOfUtcDay(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeDomain(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return "Unknown";

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "") || trimmed;
  } catch {
    return trimmed;
  }
}

function topCounts(values: string[], limit: number): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function auditScore(audit: AuditRecord): number | null {
  try {
    const scores = JSON.parse(audit.scores) as Record<string, unknown>;
    const values = ["communication", "aesthetic", "drive", "structure"]
      .map((key) => scores[key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  } catch {
    return null;
  }
}

function buildReadiness() {
  const categories = new Map<string, { configured: number; total: number }>();

  for (const env of getEnvStatus()) {
    const current = categories.get(env.category) || { configured: 0, total: 0 };
    categories.set(env.category, {
      configured: current.configured + (env.configured ? 1 : 0),
      total: current.total + 1,
    });
  }

  return Array.from(categories.entries()).map(([category, counts]) => ({
    category,
    ...counts,
  }));
}

export async function getDashboardMetrics(now = new Date()): Promise<DashboardMetrics> {
  const [auditsResult, leadsResult, schedulesResult] = await Promise.allSettled([
    getAudits(),
    getLeads(),
    getScheduledAudits(),
  ]);

  const audits = auditsResult.status === "fulfilled" ? auditsResult.value : [];
  const leads = leadsResult.status === "fulfilled" ? leadsResult.value : [];
  const schedules = schedulesResult.status === "fulfilled" ? schedulesResult.value : [];

  const sevenDaysAgo = daysAgo(now, 6);
  const thirtyDaysAgo = daysAgo(now, 29);

  const auditsLast7Days = audits.filter((audit) => {
    const createdAt = parseDate(audit.createdAt);
    return createdAt ? createdAt >= sevenDaysAgo : false;
  }).length;

  const auditsLast30Days = audits.filter((audit) => {
    const createdAt = parseDate(audit.createdAt);
    return createdAt ? createdAt >= thirtyDaysAgo : false;
  }).length;

  const dayCounts = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    dayCounts.set(dayKey(daysAgo(now, i)), 0);
  }

  for (const audit of audits) {
    const createdAt = parseDate(audit.createdAt);
    if (!createdAt) continue;

    const key = dayKey(createdAt);
    if (dayCounts.has(key)) {
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    }
  }

  const auditScores = audits
    .map(auditScore)
    .filter((value): value is number => value !== null);

  const failedSources = [
    auditsResult.status === "rejected" ? "audit history" : null,
    leadsResult.status === "rejected" ? "lead capture" : null,
    schedulesResult.status === "rejected" ? "scheduled audits" : null,
  ].filter((source): source is string => Boolean(source));

  const status = failedSources.length > 0 ? "degraded" : "healthy";

  return {
    generatedAt: now.toISOString(),
    status,
    usage: {
      totalAudits: audits.length,
      auditsLast7Days,
      auditsLast30Days,
      uniqueUsers: new Set(audits.map((audit) => audit.userEmail).filter(Boolean)).size,
      totalLeads: leads.length,
      leadConversionRate: audits.length > 0 ? round((leads.length / audits.length) * 100) : 0,
      activeSchedules: schedules.filter((schedule) => schedule.enabled).length,
      totalSchedules: schedules.length,
    },
    quality: {
      averageScore: auditScores.length > 0
        ? round(auditScores.reduce((sum, score) => sum + score, 0) / auditScores.length)
        : 0,
      scoredAudits: auditScores.length,
    },
    trends: {
      auditsByDay: Array.from(dayCounts.entries()).map(([date, count]) => ({ date, count })),
    },
    topDomains: topCounts(audits.map((audit) => normalizeDomain(audit.link)), 5)
      .map((item) => ({ domain: item.name, count: item.count })),
    topBusinessTypes: topCounts(audits.map((audit) => audit.businessType || "Unknown"), 5)
      .map((item) => ({ type: item.name, count: item.count })),
    services: [
      {
        name: "Audit History",
        state: auditsResult.status === "fulfilled" ? "operational" : "degraded",
        detail: auditsResult.status === "fulfilled" ? `${audits.length} records readable` : "Read failed",
      },
      {
        name: "Lead Capture",
        state: leadsResult.status === "fulfilled" ? "operational" : "degraded",
        detail: leadsResult.status === "fulfilled" ? `${leads.length} records readable` : "Read failed",
      },
      {
        name: "Schedules",
        state: schedulesResult.status === "fulfilled" ? "operational" : "degraded",
        detail: schedulesResult.status === "fulfilled" ? `${schedules.filter((schedule) => schedule.enabled).length} active` : "Read failed",
      },
    ],
    readiness: buildReadiness(),
    recentAudits: audits
      .slice()
      .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))
      .slice(0, 5)
      .map((audit) => ({
        id: audit.id,
        link: audit.link,
        businessType: audit.businessType,
        createdAt: audit.createdAt,
      })),
  };
}

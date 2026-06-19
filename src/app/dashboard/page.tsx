import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { getDashboardMetrics, type DashboardMetrics } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Aggregate status and usage metrics for Avditor Mvndi.",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDate(value?: string): string {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="card" style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <div style={styles.metricValue}>{value}</div>
      <p style={styles.metricDetail}>{detail}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p style={styles.emptyState}>{children}</p>;
}

function StatusDot({ state }: { state: "healthy" | "degraded" | "operational" }) {
  const color = state === "degraded" ? "#f59e0b" : "#22c55e";
  return <span aria-hidden="true" style={{ ...styles.statusDot, background: color }} />;
}

function TrendBars({ days }: { days: DashboardMetrics["trends"]["auditsByDay"] }) {
  const maxCount = Math.max(...days.map((day) => day.count), 1);

  return (
    <div style={styles.trendList}>
      {days.map((day) => (
        <div key={day.date} style={styles.trendRow}>
          <span style={styles.trendDate}>{formatDate(day.date)}</span>
          <div style={styles.trendTrack}>
            <div
              data-testid={`dashboard-trend-${day.date}`}
              style={{
                ...styles.trendFill,
                width: `${(day.count / maxCount) * 100}%`,
                minWidth: day.count > 0 ? "4px" : 0,
              }}
            />
          </div>
          <span style={styles.trendCount}>{day.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const statusLabel = metrics.status === "healthy" ? "Healthy" : "Degraded";

  return (
    <main className="main">
      <section style={styles.header}>
        <div className="astro-badge">Product Pulse</div>
        <h1 style={styles.title}>Status Dashboard</h1>
        <p style={styles.subtitle}>Operational health and aggregate usage for Avditor Mvndi.</p>
        <div style={styles.statusPill}>
          <StatusDot state={metrics.status} />
          <span>{statusLabel}</span>
          <span style={styles.timestamp}>Updated {formatTimestamp(metrics.generatedAt)}</span>
        </div>
      </section>

      <div className="container" style={styles.dashboardContainer}>
        <section aria-label="Usage summary" style={styles.metricGrid}>
          <MetricCard
            label="Total audits"
            value={formatNumber(metrics.usage.totalAudits)}
            detail={`${formatNumber(metrics.usage.auditsLast30Days)} in the last 30 days`}
          />
          <MetricCard
            label="Active users"
            value={formatNumber(metrics.usage.uniqueUsers)}
            detail="Unique signed-in audit submitters"
          />
          <MetricCard
            label="Lead conversion"
            value={formatPercent(metrics.usage.leadConversionRate)}
            detail={`${formatNumber(metrics.usage.totalLeads)} captured leads`}
          />
          <MetricCard
            label="Scheduled audits"
            value={`${formatNumber(metrics.usage.activeSchedules)}/${formatNumber(metrics.usage.totalSchedules)}`}
            detail="Enabled recurring checks"
          />
          <MetricCard
            label="Average score"
            value={`${metrics.quality.averageScore.toFixed(1)}/100`}
            detail={`${formatNumber(metrics.quality.scoredAudits)} scored audits`}
          />
          <MetricCard
            label="7-day volume"
            value={formatNumber(metrics.usage.auditsLast7Days)}
            detail="Audits generated this week"
          />
        </section>

        <section style={styles.mainGrid}>
          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Service Status</h2>
              <span style={styles.panelMeta}>{statusLabel}</span>
            </div>
            <div style={styles.statusList}>
              {metrics.services.map((service) => (
                <div key={service.name} style={styles.statusRow}>
                  <div style={styles.statusName}>
                    <StatusDot state={service.state === "operational" ? "operational" : "degraded"} />
                    <span>{service.name}</span>
                  </div>
                  <span style={styles.statusDetail}>{service.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Configuration Readiness</h2>
              <span style={styles.panelMeta}>By service group</span>
            </div>
            <div style={styles.readinessGrid}>
              {metrics.readiness.map((item) => (
                <div key={item.category} style={styles.readinessItem}>
                  <span style={styles.readinessName}>{item.category}</span>
                  <span style={styles.readinessCount}>{item.configured}/{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.mainGrid}>
          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Audit Volume</h2>
              <span style={styles.panelMeta}>Last 7 days</span>
            </div>
            <TrendBars days={metrics.trends.auditsByDay} />
          </div>

          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Recent Audits</h2>
              <span style={styles.panelMeta}>{metrics.recentAudits.length} shown</span>
            </div>
            {metrics.recentAudits.length === 0 ? (
              <EmptyState>No audits yet.</EmptyState>
            ) : (
              <div style={styles.recentList}>
                {metrics.recentAudits.map((audit) => (
                  <div key={audit.id} style={styles.recentRow}>
                    <div style={styles.recentText}>
                      <span style={styles.recentLink}>{audit.link}</span>
                      <span style={styles.recentType}>{audit.businessType}</span>
                    </div>
                    <span style={styles.recentDate}>{formatDate(audit.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={styles.mainGrid}>
          <RankedList
            title="Top Domains"
            empty="No domain data yet."
            items={metrics.topDomains.map((item) => ({ name: item.domain, count: item.count }))}
          />
          <RankedList
            title="Business Types"
            empty="No business type data yet."
            items={metrics.topBusinessTypes.map((item) => ({ name: item.type, count: item.count }))}
          />
        </section>
      </div>
    </main>
  );
}

function RankedList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ name: string; count: number }>;
}) {
  return (
    <div className="card" style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        <span style={styles.panelMeta}>Top {items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <div style={styles.rankList}>
          {items.map((item, index) => (
            <div key={item.name} style={styles.rankRow}>
              <span style={styles.rankName}>
                <span style={styles.rankIndex}>{index + 1}</span>
                {item.name}
              </span>
              <span style={styles.rankCount}>{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  header: {
    textAlign: "center",
    margin: "0 auto 2rem",
    maxWidth: "760px",
  },
  title: {
    fontSize: "2.6rem",
    fontWeight: 900,
    letterSpacing: 0,
    lineHeight: 1,
    marginBottom: "0.75rem",
    background: "linear-gradient(to bottom, #fff 40%, #94a3b8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: "var(--text-muted)",
    fontSize: "1rem",
    marginBottom: "1rem",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.55rem",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(6,10,22,0.62)",
    borderRadius: "999px",
    padding: "0.55rem 0.85rem",
    color: "#edf0f7",
    fontSize: "0.85rem",
    fontWeight: 700,
  },
  statusDot: {
    width: "0.55rem",
    height: "0.55rem",
    borderRadius: "999px",
    boxShadow: "0 0 18px currentColor",
  },
  timestamp: {
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  dashboardContainer: {
    maxWidth: "1180px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  metricCard: {
    borderRadius: "8px",
    padding: "1rem",
    minHeight: "130px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  metricLabel: {
    color: "var(--text-muted)",
    fontSize: "0.72rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  metricValue: {
    color: "#fff",
    fontSize: "2.1rem",
    fontWeight: 900,
    lineHeight: 1,
  },
  metricDetail: {
    color: "var(--text-muted)",
    fontSize: "0.8rem",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  panel: {
    borderRadius: "8px",
    padding: "1rem",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    marginBottom: "1rem",
  },
  panelTitle: {
    color: "#fff",
    fontSize: "1rem",
    lineHeight: 1.2,
  },
  panelMeta: {
    color: "var(--text-muted)",
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
  },
  statusList: {
    display: "grid",
    gap: "0.65rem",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    paddingBottom: "0.65rem",
  },
  statusName: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.55rem",
    color: "#edf0f7",
    fontWeight: 700,
  },
  statusDetail: {
    color: "var(--text-muted)",
    fontSize: "0.82rem",
    textAlign: "right",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
    gap: "0.55rem",
  },
  readinessItem: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "0.7rem",
    background: "rgba(0,0,0,0.18)",
  },
  readinessName: {
    display: "block",
    color: "var(--text-muted)",
    fontSize: "0.72rem",
    textTransform: "capitalize",
    marginBottom: "0.35rem",
  },
  readinessCount: {
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: 800,
  },
  trendList: {
    display: "grid",
    gap: "0.55rem",
  },
  trendRow: {
    display: "grid",
    gridTemplateColumns: "64px 1fr 32px",
    alignItems: "center",
    gap: "0.6rem",
  },
  trendDate: {
    color: "var(--text-muted)",
    fontSize: "0.75rem",
  },
  trendTrack: {
    height: "0.85rem",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  trendFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #22c55e, var(--secondary))",
  },
  trendCount: {
    color: "#fff",
    fontSize: "0.78rem",
    textAlign: "right",
    fontWeight: 800,
  },
  recentList: {
    display: "grid",
    gap: "0.6rem",
  },
  recentRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    paddingBottom: "0.6rem",
  },
  recentText: {
    minWidth: 0,
  },
  recentLink: {
    display: "block",
    color: "#fff",
    fontSize: "0.86rem",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "360px",
  },
  recentType: {
    display: "block",
    color: "var(--text-muted)",
    fontSize: "0.75rem",
    marginTop: "0.15rem",
  },
  recentDate: {
    color: "var(--text-muted)",
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
  },
  rankList: {
    display: "grid",
    gap: "0.55rem",
  },
  rankRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    paddingBottom: "0.55rem",
  },
  rankName: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.55rem",
    minWidth: 0,
    color: "#edf0f7",
    fontSize: "0.86rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rankIndex: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.4rem",
    height: "1.4rem",
    borderRadius: "6px",
    background: "rgba(0,212,255,0.12)",
    color: "var(--secondary)",
    fontSize: "0.75rem",
    fontWeight: 800,
    flex: "0 0 auto",
  },
  rankCount: {
    color: "#fff",
    fontWeight: 800,
  },
  emptyState: {
    color: "var(--text-muted)",
    fontSize: "0.86rem",
  },
} satisfies Record<string, CSSProperties>;

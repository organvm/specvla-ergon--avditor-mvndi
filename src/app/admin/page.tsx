"use client";

import { useEffect, useState } from "react";
import Loader from "@/components/Loader";

interface Config {
  [key: string]: string;
}

interface User {
  email: string;
  auditCount: number;
  lastAudit: string;
  firstAudit: string;
}

interface Audit {
  id: string;
  userEmail?: string;
  link: string;
  businessType: string;
  goals: string;
  createdAt?: string;
}

interface Lead {
  email: string;
  source: string;
  auditId?: string;
  createdAt?: string;
}

interface ScheduledAudit {
  id: string;
  userEmail: string;
  link: string;
  businessType: string;
  goals: string;
  frequency: "weekly" | "monthly";
  enabled: boolean;
  lastRunAt?: string;
  createdAt?: string;
}

interface Stats {
  totalAudits: number;
  totalUsers: number;
  auditsLast30Days: number;
}

type Tab = "overview" | "users" | "audits" | "leads" | "schedules" | "analytics" | "config";

interface AnalyticsData {
  auditsByDay: Array<{ date: string; count: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  avgScores: { communication: number; aesthetic: number; drive: number; structure: number };
  businessTypes: Array<{ type: string; count: number }>;
  leadsByDay: Array<{ date: string; count: number }>;
  totalLeads: number;
  conversionRate: number;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [config, setConfig] = useState<Config>({});
  const [users, setUsers] = useState<User[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [envStatus, setEnvStatus] = useState<Array<{ key: string; label: string; configured: boolean; category: string }>>([]);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [schedules, setSchedules] = useState<ScheduledAudit[]>([]);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ userEmail: "", link: "", businessType: "", goals: "", frequency: "monthly" as "weekly" | "monthly" });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/admin?type=stats");
        if (res.ok) {
          setIsAdmin(true);
          loadOverview();
        } else {
          setError("Admin access required");
        }
      } catch {
        setError("Failed to check admin status");
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEnvStatus = async () => {
    try {
      const res = await fetch("/api/admin?type=env");
      if (res.ok) {
        const data = await res.json();
        setEnvStatus(data.envStatus || []);
      }
    } catch (e) {
      console.error("Failed to load env status:", e);
    }
  };

  const loadOverview = async () => {
    try {
      const [statsRes, auditsRes] = await Promise.all([
        fetch("/api/admin?type=stats"),
        fetch("/api/admin?type=audits"),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (auditsRes.ok) {
        const data = await auditsRes.json();
        setUsers(data.uniqueUsers || []);
        setAudits(data.recentAudits || []);
      }
    } catch (e) {
      console.error("Failed to load overview:", e);
    }
    await loadEnvStatus();
  };

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users?action=users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error("Failed to load users:", e);
    }
  };

  const loadLeads = async () => {
    try {
      const res = await fetch("/api/admin?type=leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (e) {
      console.error("Failed to load leads:", e);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch (e) {
      console.error("Failed to load analytics:", e);
    }
  };

  const loadAudits = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setAudits(data.audits || []);
      }
    } catch (e) {
      console.error("Failed to load audits:", e);
    }
  };

  const loadSchedules = async () => {
    try {
      const res = await fetch("/api/admin/schedules");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (e) {
      console.error("Failed to load schedules:", e);
    }
  };

  const addSchedule = async () => {
    if (!newSchedule.userEmail || !newSchedule.link || !newSchedule.businessType || !newSchedule.goals) return;
    try {
      const res = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSchedule),
      });
      if (res.ok) {
        setNewSchedule({ userEmail: "", link: "", businessType: "", goals: "", frequency: "monthly" });
        setShowAddSchedule(false);
        await loadSchedules();
      }
    } catch (e) {
      console.error("Failed to add schedule:", e);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Delete this scheduled audit?")) return;
    try {
      const res = await fetch(`/api/admin/schedules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSchedules(schedules.filter((s) => s.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete schedule:", e);
    }
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/schedules?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setSchedules(schedules.map((s) => s.id === id ? { ...s, enabled } : s));
      }
    } catch (e) {
      console.error("Failed to toggle schedule:", e);
    }
  };

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "config") await loadConfig();
    if (tab === "users") await loadUsers();
    if (tab === "audits") await loadAudits();
    if (tab === "leads") await loadLeads();
    if (tab === "schedules") await loadSchedules();
    if (tab === "analytics") await loadAnalytics();
  };

  const saveConfig = async (key: string, value: string) => {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setSaveMessage(`Saved ${key}`);
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage("Failed to save");
      }
    } catch {
      setSaveMessage("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const deleteAudit = async (id: string) => {
    if (!confirm("Delete this audit?")) return;
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAudits(audits.filter((a) => a.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  if (loading) return <main className="main"><Loader /></main>;

  if (!isAdmin) {
    return (
      <main className="main">
        <div className="hero">
          <h1>Admin Access Denied</h1>
          <p>You do not have permission to view this page.</p>
        </div>
      </main>
    );
  }

  const configFields = [
    { key: "adminEmails", label: "Admin Emails", type: "text", placeholder: "admin@yoursite.com,other@yoursite.com", description: "Comma-separated list of admin email addresses" },
    { key: "authPassword", label: "Admin Password", type: "password", placeholder: "cosmic", description: "Password for admin login" },
    { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://yoursite.com", description: "Public URL of your deployment" },
    { key: "emailFrom", label: "Email From Address", type: "text", placeholder: "hello@yoursite.com", description: "Sender address for emails" },
    { key: "geminiApiKey", label: "Gemini API Key", type: "password", placeholder: "AIzaSy...", description: "Google Gemini API key for AI features (leave empty to let users provide their own)" },
    { key: "supabaseUrl", label: "Supabase URL", type: "text", placeholder: "https://xxx.supabase.co", description: "PostgreSQL database URL (leave empty for local SQLite)" },
    { key: "supabaseKey", label: "Supabase Service Key", type: "password", placeholder: "eyJ...", description: "Service role key for database access" },
    { key: "stripeSecretKey", label: "Stripe Secret Key", type: "password", placeholder: "sk_live_...", description: "For payment processing (leave empty to disable)" },
    { key: "stripeWebhookSecret", label: "Stripe Webhook Secret", type: "password", placeholder: "whsec_...", description: "Webhook signing secret" },
    { key: "posthogKey", label: "PostHog API Key", type: "password", placeholder: "phc_...", description: "Analytics (leave empty to disable)" },
    { key: "posthogHost", label: "PostHog Host", type: "text", placeholder: "https://us.i.posthog.com", description: "PostHog instance host" },
    { key: "resendApiKey", label: "Resend API Key", type: "password", placeholder: "re_...", description: "For sending emails (leave empty to disable)" },
    { key: "cronSecret", label: "Cron Secret", type: "password", placeholder: "secure_random_string", description: "Secret for scheduled jobs" },
    { key: "nextAuthSecret", label: "NextAuth Secret", type: "password", placeholder: "random_string", description: "Session encryption secret" },
    { key: "stripePricePro", label: "Pro Price ID", type: "text", placeholder: "price_...", description: "Stripe recurring price ID for Pro" },
    { key: "stripePricePremium", label: "Premium Price ID", type: "text", placeholder: "price_...", description: "Stripe recurring price ID for Premium" },
    { key: "enableSubscriptions", label: "Enable Subscriptions", type: "select", options: ["true", "false"], description: "Show subscription options to users" },
    { key: "enableMonthlyAudits", label: "Enable Monthly Audits", type: "select", options: ["true", "false"], description: "Run automatic monthly re-audits for subscribers" },
    { key: "appName", label: "App Name", type: "text", placeholder: "Avditor Mvndi", description: "Your application's name" },
    { key: "appTagline", label: "App Tagline", type: "text", placeholder: "Cosmic Strategy & Digital Alignment", description: "Your application's tagline" },
    { key: "primaryColor", label: "Primary Color", type: "text", placeholder: "#7000ff", description: "Main brand color (hex)" },
    { key: "accentColor", label: "Accent Color", type: "text", placeholder: "#00d4ff", description: "Secondary brand color (hex)" },
    { key: "logoUrl", label: "Logo URL", type: "text", placeholder: "https://yoursite.com/logo.png", description: "URL to your logo image" },
    { key: "faviconUrl", label: "Favicon URL", type: "text", placeholder: "https://yoursite.com/favicon.ico", description: "URL to your favicon" },
    { key: "customCss", label: "Custom CSS", type: "text", placeholder: ".my-class { ... }", description: "Additional CSS to apply to all pages" },
    { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://hooks.slack.com/services/...", description: "URL to receive audit and lead event notifications" },
    { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "whsec_...", description: "Shared secret for webhook signature verification (future)" },
  ];

  return (
    <main className="main">
      <div className="hero">
        <div className="astro-badge">
          <span aria-hidden="true">✦</span>
          Command Center
        </div>
        <h1>Avditor Mvndi Admin</h1>
        <p>Configure, manage, and monitor your deployment.</p>
      </div>

      <div className="container" style={{ maxWidth: "1400px" }}>
        {error && (
          <div className="card" style={{ background: "rgba(255,100,100,0.1)", borderColor: "var(--accent)" }}>
            <p style={{ color: "var(--accent)" }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          {(["overview", "users", "audits", "leads", "schedules", "analytics", "config"] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? "" : "btn-secondary"}`}
              onClick={() => handleTabChange(tab)}
              style={{ textTransform: "capitalize" }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <div className="card" style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "3rem", margin: 0, color: "var(--secondary)" }}>{stats?.totalAudits || 0}</h2>
                <p style={{ color: "var(--text-muted)" }}>Total Audits</p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "3rem", margin: 0, color: "var(--secondary)" }}>{stats?.totalUsers || 0}</h2>
                <p style={{ color: "var(--text-muted)" }}>Unique Users</p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "3rem", margin: 0, color: "var(--secondary)" }}>{stats?.auditsLast30Days || 0}</h2>
                <p style={{ color: "var(--text-muted)" }}>Last 30 Days</p>
              </div>
            </div>

            {envStatus.length > 0 && (
              <div className="card" style={{ marginBottom: "2rem" }}>
                <h2 style={{ color: "var(--secondary)", marginBottom: "1rem" }}>Environment Status</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.85rem" }}>
                  {envStatus.filter(e => e.configured).length} of {envStatus.length} variables configured
                </p>
                {(["database", "ai", "payments", "email", "analytics", "monitoring", "auth"] as const).map((cat) => {
                  const items = envStatus.filter(e => e.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} style={{ marginBottom: "1rem" }}>
                      <h3 style={{ color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>{cat}</h3>
                      {items.map((env) => (
                        <div key={env.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ color: env.configured ? "#22c55e" : "#ef4444", fontSize: "1rem" }}>
                            {env.configured ? "\u2713" : "\u2717"}
                          </span>
                          <span style={{ flex: 1 }}>{env.label}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontFamily: "monospace" }}>{env.key}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="card">
              <h2 style={{ color: "var(--secondary)", marginBottom: "1rem" }}>Recent Activity</h2>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {audits.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No audits yet</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Link</th>
                        <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>User</th>
                        <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audits.slice(0, 10).map((audit) => (
                        <tr key={audit.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "0.5rem" }}>{audit.link}</td>
                          <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>{audit.userEmail || "Anonymous"}</td>
                          <td style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>
                            {audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="card">
            <h2 style={{ color: "var(--secondary)", marginBottom: "1rem" }}>All Users ({users.length})</h2>
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              {users.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No users yet</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Email</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Audits</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>First</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.email} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "0.5rem" }}>{user.email}</td>
                        <td style={{ textAlign: "right", padding: "0.5rem" }}>{user.auditCount}</td>
                        <td style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>
                          {user.firstAudit ? new Date(user.firstAudit).toLocaleDateString() : "-"}
                        </td>
                        <td style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>
                          {user.lastAudit ? new Date(user.lastAudit).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "audits" && (
          <div className="card">
            <h2 style={{ color: "var(--secondary)", marginBottom: "1rem" }}>All Audits ({audits.length})</h2>
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              {audits.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No audits yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {audits.map((audit) => (
                    <div key={audit.id} style={{ padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{audit.link}</strong>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                          {audit.businessType} • {audit.userEmail || "Anonymous"} • {audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : "-"}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "0.5rem 1rem", width: "auto", fontSize: "0.85rem" }}
                        onClick={() => deleteAudit(audit.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "leads" && (
          <div className="card">
            <h2 style={{ color: "var(--secondary)", marginBottom: "1rem" }}>All Leads ({leads.length})</h2>
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              {leads.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No leads yet</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Email</th>
                      <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Source</th>
                      <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Audit ID</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "0.5rem" }}>{lead.email}</td>
                        <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>{lead.source}</td>
                        <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>{lead.auditId || "-"}</td>
                        <td style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "schedules" && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: "var(--secondary)", margin: 0 }}>Scheduled Audits ({schedules.length})</h2>
              <button
                className="btn"
                style={{ padding: "0.5rem 1rem", width: "auto", fontSize: "0.85rem" }}
                onClick={() => setShowAddSchedule(!showAddSchedule)}
              >
                {showAddSchedule ? "Cancel" : "Add Schedule"}
              </button>
            </div>

            {showAddSchedule && (
              <div style={{ padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", marginBottom: "1rem", display: "grid", gap: "0.75rem" }}>
                <input
                  className="input"
                  placeholder="User email"
                  value={newSchedule.userEmail}
                  onChange={(e) => setNewSchedule({ ...newSchedule, userEmail: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Website URL"
                  value={newSchedule.link}
                  onChange={(e) => setNewSchedule({ ...newSchedule, link: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Business type"
                  value={newSchedule.businessType}
                  onChange={(e) => setNewSchedule({ ...newSchedule, businessType: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Goals"
                  value={newSchedule.goals}
                  onChange={(e) => setNewSchedule({ ...newSchedule, goals: e.target.value })}
                />
                <select
                  className="input"
                  value={newSchedule.frequency}
                  onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value as "weekly" | "monthly" })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button
                  className="btn"
                  style={{ padding: "0.5rem 1rem", width: "auto", fontSize: "0.85rem" }}
                  onClick={addSchedule}
                >
                  Save Schedule
                </button>
              </div>
            )}

            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              {schedules.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No scheduled audits yet</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Email</th>
                      <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>URL</th>
                      <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)" }}>Frequency</th>
                      <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)" }}>Enabled</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Last Run</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr key={schedule.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "0.5rem" }}>{schedule.userEmail}</td>
                        <td style={{ padding: "0.5rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{schedule.link}</td>
                        <td style={{ textAlign: "center", padding: "0.5rem", textTransform: "capitalize" }}>{schedule.frequency}</td>
                        <td style={{ textAlign: "center", padding: "0.5rem" }}>
                          <button
                            onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                            style={{
                              background: schedule.enabled ? "#22c55e" : "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              padding: "0.25rem 0.75rem",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            {schedule.enabled ? "On" : "Off"}
                          </button>
                        </td>
                        <td style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                          {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleDateString() : "Never"}
                        </td>
                        <td style={{ textAlign: "right", padding: "0.5rem" }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.75rem", width: "auto", fontSize: "0.8rem" }}
                            onClick={() => deleteSchedule(schedule.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="card">
            <h2 style={{ color: "var(--secondary)", marginBottom: "1.5rem" }}>Analytics</h2>
            {!analytics ? (
              <p style={{ color: "var(--text-muted)" }}>Loading analytics...</p>
            ) : (
              <div style={{ display: "grid", gap: "2rem" }}>
                {/* Lead Funnel */}
                <div>
                  <h3 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>Lead Funnel</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ height: "28px", width: "100%", background: "linear-gradient(90deg, var(--primary), var(--secondary))", borderRadius: "6px", display: "flex", alignItems: "center", paddingLeft: "12px", fontSize: "0.85rem", fontWeight: 600 }}>
                        Audits: {analytics.auditsByDay.reduce((s, d) => s + d.count, 0)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ height: "28px", width: `${Math.max(analytics.conversionRate, 5)}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))", borderRadius: "6px", display: "flex", alignItems: "center", paddingLeft: "12px", fontSize: "0.85rem", fontWeight: 600, minWidth: "120px" }}>
                        Leads: {analytics.totalLeads}
                      </div>
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Conversion: {analytics.conversionRate.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Average Scores */}
                <div>
                  <h3 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>Average Scores</h3>
                  {(["communication", "aesthetic", "drive", "structure"] as const).map((key) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                      <span style={{ width: "120px", fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{key}</span>
                      <div style={{ flex: 1, height: "16px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${analytics.avgScores[key]}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))", borderRadius: "4px" }} />
                      </div>
                      <span style={{ width: "40px", textAlign: "right", fontSize: "0.85rem" }}>{Math.round(analytics.avgScores[key])}</span>
                    </div>
                  ))}
                </div>

                {/* Audit Volume */}
                <div>
                  <h3 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>Audit Volume (30 days)</h3>
                  <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {analytics.auditsByDay.map((day) => {
                      const maxCount = Math.max(...analytics.auditsByDay.map(d => d.count), 1);
                      return (
                        <div key={day.date} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "4px" }}>
                          <span style={{ width: "80px", fontSize: "0.7rem", color: "var(--text-muted)" }}>{day.date}</span>
                          <div style={{ flex: 1, height: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(day.count / maxCount) * 100}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))", borderRadius: "3px", minWidth: day.count > 0 ? "4px" : "0" }} />
                          </div>
                          <span style={{ width: "30px", textAlign: "right", fontSize: "0.75rem" }}>{day.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Domains + Business Types side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div>
                    <h3 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>Top Domains</h3>
                    {analytics.topDomains.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No data yet</p>
                    ) : (
                      analytics.topDomains.map((d, i) => (
                        <div key={d.domain} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--text-muted)" }}>{i + 1}. {d.domain}</span>
                          <span>{d.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div>
                    <h3 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>Business Types</h3>
                    {analytics.businessTypes.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No data yet</p>
                    ) : (
                      analytics.businessTypes.map((bt) => (
                        <div key={bt.type} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--text-muted)" }}>{bt.type}</span>
                          <span>{bt.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "config" && (
          <div className="card">
            <h2 style={{ color: "var(--secondary)", marginBottom: "1rem" }}>Configuration</h2>
            {saveMessage && (
              <p style={{ color: "var(--primary)", marginBottom: "1rem" }}>{saveMessage}</p>
            )}
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {configFields.map((field) => (
                <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      className="input"
                      value={config[field.key] || ""}
                      onChange={(e) => saveConfig(field.key, e.target.value)}
                      disabled={saving}
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      className="input"
                      value={config[field.key] || ""}
                      placeholder={field.placeholder}
                      onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                      onBlur={(e) => saveConfig(field.key, e.target.value)}
                      disabled={saving}
                    />
                  )}
                  <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{field.description}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

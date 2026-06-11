"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AI_PROVIDERS,
  AIProvider,
  getStoredProvider,
  getProviderConfig,
  getStoredApiKey,
} from "@/services/aiProvider";
import ProBadge from "@/components/ProBadge";

interface Integration {
  id: string;
  name: string;
  url: string;
  event: string;
  createdAt?: string;
}

const WEBHOOK_EVENTS = [
  { value: "audit.completed", label: "Audit Completed" },
  { value: "lead.captured", label: "Lead Captured" },
  { value: "comparison.completed", label: "Comparison Completed" },
] as const;

export default function SettingsPage() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai" | "agency" | "data" | "integrations">("ai");
  const { data: session } = useSession();

  // Integration state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ name: "", url: "", event: "audit.completed" });
  const [integrationError, setIntegrationError] = useState("");

  const isPro = session?.user?.isPro || session?.user?.isAdmin;

  const fetchIntegrations = useCallback(async () => {
    if (!session?.user?.email) return;
    setIntegrationsLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch {
      // silent fail — integrations are optional
    } finally {
      setIntegrationsLoading(false);
    }
  }, [session?.user?.email]);

  const handleAddIntegration = async () => {
    setIntegrationError("");
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIntegration),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add integration");
      }
      setNewIntegration({ name: "", url: "", event: "audit.completed" });
      setShowAddForm(false);
      fetchIntegrations();
    } catch (err) {
      setIntegrationError(err instanceof Error ? err.message : "Failed to add integration");
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/integrations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setIntegrations(prev => prev.filter(i => i.id !== id));
      }
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    const storedProvider = getStoredProvider();
    const storedKey = getStoredApiKey(storedProvider) || "";
    setProvider(storedProvider);
    setApiKey(storedKey);
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/settings/branding")
        .then(res => res.json())
        .then(data => {
          if (data.customLogoUrl) setLogoUrl(data.customLogoUrl);
        })
        .catch(() => {});
    }
    fetchIntegrations();
  }, [session?.user?.email, fetchIntegrations]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    const storedKey = getStoredApiKey(newProvider) || "";
    setApiKey(storedKey);
  };

  const config = getProviderConfig(provider);

  const saveKeys = () => {
    localStorage.setItem("ai_provider", provider);
    if (provider === "gemini") {
      localStorage.setItem("gemini_api_key", apiKey);
    } else {
      localStorage.setItem(`${provider}_api_key`, apiKey);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleBrandingSave = async () => {
    try {
      const res = await fetch("/api/settings/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      if (!res.ok) throw new Error("Failed to save branding");
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Pro subscription required.");
    }
  };

  const handleDeleteData = async () => {
    if (!confirm("Are you sure? This is irreversible.")) return;
    try {
      const res = await fetch("/api/settings/data/forget", { method: "DELETE" });
      if (res.ok) {
        alert("Your data has been erased.");
        window.location.href = "/";
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="main">
      <div className="hero">
        <h1>Settings {isPro && <ProBadge />}</h1>
        <p>Control your cosmic interface and strategic data.</p>
      </div>

      <div className="container" style={{ maxWidth: "900px" }}>
        {/* TAB NAVIGATION (Iceberg Tips) */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
          <button 
            onClick={() => setActiveTab("ai")}
            className={`btn ${activeTab === "ai" ? "" : "btn-secondary"}`}
            style={{ width: "auto", flex: "none", padding: "0.5rem 1.5rem" }}
          >
            AI Engine
          </button>
          {isPro && (
            <button 
              onClick={() => setActiveTab("agency")}
              className={`btn ${activeTab === "agency" ? "" : "btn-secondary"}`}
              style={{ width: "auto", flex: "none", padding: "0.5rem 1.5rem" }}
            >
              Agency
            </button>
          )}
          <button 
            onClick={() => setActiveTab("integrations")}
            className={`btn ${activeTab === "integrations" ? "" : "btn-secondary"}`}
            style={{ width: "auto", flex: "none", padding: "0.5rem 1.5rem" }}
          >
            Integrations
          </button>
          <button 
            onClick={() => setActiveTab("data")}
            className={`btn ${activeTab === "data" ? "" : "btn-secondary"}`}
            style={{ width: "auto", flex: "none", padding: "0.5rem 1.5rem" }}
          >
            Privacy
          </button>
        </div>

        <div className="card">
          {activeTab === "ai" && (
            <div className="tab-content" style={{ animation: "fadeIn 0.3s" }}>
              <div className="form-group">
                <label htmlFor="provider">Selected AI Model</label>
                <select id="provider" className="input" value={provider} onChange={(e) => handleProviderChange(e.target.value as AIProvider)}>
                  {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="apikey">{config.name} Secret Key</label>
                <input id="apikey" type="password" className="input" placeholder={config.keyPlaceholder} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                <small style={{ color: "var(--text-muted)", marginTop: "0.5rem", display: "block" }}>
                  Get credentials at <a href={config.getKeyUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{config.name}</a>
                </small>
              </div>
              <button className="btn" onClick={saveKeys}>
                {saved ? "Alignment Saved! ✦" : "Align AI Engine"}
              </button>
            </div>
          )}

          {activeTab === "agency" && isPro && (
            <div className="tab-content" style={{ animation: "fadeIn 0.3s" }}>
              <h3 style={{ marginBottom: "1rem" }}>White-Label Configuration</h3>
              <div className="form-group">
                <label htmlFor="logoUrl">Custom Agency Logo URL</label>
                <input id="logoUrl" className="input" type="url" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </div>
              <button className="btn" onClick={handleBrandingSave}>
                {brandingSaved ? "Branding Applied! ✦" : "Manifest Branding"}
              </button>
              
              <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <Link href="/settings/schedules" className="btn btn-secondary" style={{ display: "block", textAlign: "center" }}>
                  Manage Recurring Audits
                </Link>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="tab-content" style={{ animation: "fadeIn 0.3s" }}>
              <h3 style={{ marginBottom: "1rem" }}>External Orbits</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                Connect your growth reports to external systems like Slack or Zapier.
              </p>

              {/* Existing integrations */}
              {integrationsLoading ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading integrations...</p>
              ) : integrations.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  {integrations.map((integration) => (
                    <div
                      key={integration.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "8px",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>{integration.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                          {integration.event} &rarr; <span style={{ opacity: 0.7 }}>{integration.url}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteIntegration(integration.id)}
                        style={{
                          background: "none",
                          border: "1px solid rgba(255,0,112,0.3)",
                          color: "#ff0070",
                          padding: "0.35rem 0.75rem",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem", opacity: 0.6 }}>
                  No integrations configured yet.
                </p>
              )}

              {/* Add integration form */}
              {showAddForm ? (
                <div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                  {integrationError && (
                    <p style={{ color: "#ff0070", fontSize: "0.85rem", marginBottom: "1rem" }}>{integrationError}</p>
                  )}
                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="int-name" style={{ fontSize: "0.85rem" }}>Name</label>
                    <input
                      id="int-name"
                      className="input"
                      placeholder="e.g. Slack Notifications"
                      value={newIntegration.name}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="int-url" style={{ fontSize: "0.85rem" }}>Webhook URL</label>
                    <input
                      id="int-url"
                      className="input"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={newIntegration.url}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                    <label htmlFor="int-event" style={{ fontSize: "0.85rem" }}>Trigger Event</label>
                    <select
                      id="int-event"
                      className="input"
                      value={newIntegration.event}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, event: e.target.value }))}
                    >
                      {WEBHOOK_EVENTS.map((ev) => (
                        <option key={ev.value} value={ev.value}>{ev.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button className="btn" onClick={handleAddIntegration} style={{ flex: 1 }}>
                      Connect Orbit
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setShowAddForm(false); setIntegrationError(""); }}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary" onClick={() => setShowAddForm(true)} style={{ width: "auto" }}>
                  Add Webhook Integration
                </button>
              )}
            </div>
          )}

          {activeTab === "data" && (
            <div className="tab-content" style={{ animation: "fadeIn 0.3s" }}>
              <h3 style={{ marginBottom: "1rem" }}>Strategic Sovereignty</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "2rem", fontSize: "0.9rem" }}>
                Your data is your legacy. Export or erase your footprint at any time.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <a href="/api/settings/data/export" className="btn btn-secondary" style={{ flex: 1, textAlign: "center", minWidth: "200px" }}>
                  Export Strategic History
                </a>
                <button onClick={handleDeleteData} className="btn" style={{ flex: 1, minWidth: "200px", backgroundColor: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                  Erase Cosmic Presence
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "2rem", textAlign: "center", lineHeight: "1.6", opacity: 0.6 }}>
          Local keys are never stored in our core database. They remain in your device&apos;s gravitational pull.
        </p>
      </div>
    </main>
  );
}

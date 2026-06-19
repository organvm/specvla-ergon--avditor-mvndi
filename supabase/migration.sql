-- Growth Auditor - Supabase Migration
-- Run this in the Supabase SQL Editor to set up all tables

-- Audits table
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  "userEmail" TEXT,
  "teamId" TEXT,
  link TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  goals TEXT NOT NULL,
  "markdownAudit" TEXT NOT NULL,
  scores TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  "teamId" TEXT NOT NULL REFERENCES teams(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  "auditId" TEXT,
  source TEXT DEFAULT 'audit_gate',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled audits table
CREATE TABLE IF NOT EXISTS scheduled_audits (
  id TEXT PRIMARY KEY,
  "userEmail" TEXT NOT NULL,
  "teamId" TEXT,
  link TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  goals TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  enabled BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  "userEmail" TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  "customLogoUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  "userEmail" TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API tokens table
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  "userEmail" TEXT NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit feedback table
CREATE TABLE IF NOT EXISTS audit_feedback (
  id TEXT PRIMARY KEY,
  "auditId" TEXT NOT NULL,
  "userEmail" TEXT,
  section TEXT,
  score INTEGER NOT NULL,
  comment TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backfill column for deployments that already ran an older migration.
ALTER TABLE scheduled_audits ADD COLUMN IF NOT EXISTS "teamId" TEXT;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audits_user_email ON audits("userEmail");
CREATE INDEX IF NOT EXISTS idx_audits_team_id ON audits("teamId");
CREATE INDEX IF NOT EXISTS idx_audits_link ON audits(link);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits("createdAt");
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members("teamId");
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads("createdAt");
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_user ON scheduled_audits("userEmail");
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_team_id ON scheduled_audits("teamId");
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_enabled ON scheduled_audits(enabled);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email ON subscriptions("userEmail");
CREATE INDEX IF NOT EXISTS idx_integrations_user_email ON integrations("userEmail");
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_email ON api_tokens("userEmail");
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_audit_feedback_audit_id ON audit_feedback("auditId");

-- Row Level Security (optional, recommended for production)
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_feedback ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by the app's server-side code)
CREATE POLICY "Service role full access" ON audits FOR ALL USING (true);
CREATE POLICY "Service role full access" ON teams FOR ALL USING (true);
CREATE POLICY "Service role full access" ON team_members FOR ALL USING (true);
CREATE POLICY "Service role full access" ON leads FOR ALL USING (true);
CREATE POLICY "Service role full access" ON scheduled_audits FOR ALL USING (true);
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON integrations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON api_tokens FOR ALL USING (true);
CREATE POLICY "Service role full access" ON audit_feedback FOR ALL USING (true);

-- ============================================
-- Application Assessment System - Initial Schema
-- Shared database: also used by Health Check tool and Client Dashboard
-- Run: turso db shell <dbname> < 001_initial_schema.sql
-- ============================================

-- ============================================
-- PROSPECTS (Health Check Buyers - Not Clients Yet)
-- ============================================
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  -- Contact Info
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  website_url TEXT NOT NULL,

  -- Lead Source
  source TEXT DEFAULT 'organic', -- 'organic', 'referral', 'social', 'ad'

  -- Status in Funnel
  status TEXT DEFAULT 'health_check_purchased',
  -- Possible values:
  -- 'health_check_purchased' - Paid $49, got results
  -- 'application_started' - Clicked through to apply
  -- 'application_submitted' - Submitted application
  -- 'converted_to_client' - Accepted and became client
  -- 'declined' - Applied but declined
  -- 'cold' - No further action after 90 days

  -- Conversion Tracking
  application_id TEXT,
  client_id TEXT,
  converted_at INTEGER,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,

  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_created ON prospects(created_at DESC);

-- ============================================
-- APPLICATIONS (Service Requests)
-- ============================================
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  -- Origin Tracking (NULL if direct application)
  prospect_id TEXT,

  -- Contact Information
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_role TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website_url TEXT,

  -- Organization Details
  organization_type TEXT NOT NULL,
  other_org_type TEXT,
  situation TEXT NOT NULL,
  project_description TEXT NOT NULL,

  -- Budget & Timeline
  budget_range TEXT NOT NULL,
  timeline TEXT NOT NULL,
  previous_designer BOOLEAN NOT NULL,

  -- Mission Alignment
  mission_statement TEXT NOT NULL,
  community_impact TEXT NOT NULL,
  impact_categories TEXT NOT NULL, -- JSON array
  other_impact TEXT,
  industry TEXT NOT NULL,

  -- Referral
  referral_source TEXT,
  referral_detail TEXT,

  -- Assessment
  status TEXT DEFAULT 'pending', -- pending, under_review, accepted, declined
  auto_assessment TEXT, -- JSON object
  admin_notes TEXT,
  decision_made_at INTEGER,
  decision_by TEXT,

  -- Link to client (populated on acceptance)
  client_id TEXT,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,

  FOREIGN KEY (prospect_id) REFERENCES prospects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_prospect ON applications(prospect_id);

-- ============================================
-- HEALTH CHECKS (Website Analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,

  -- Ownership (only ONE should be populated per check)
  prospect_id TEXT, -- Lead magnet purchase
  application_id TEXT, -- Free with accepted application
  client_id TEXT, -- Ongoing client monitoring

  -- Website Details
  url TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,

  -- Results (JSON objects)
  search_visibility TEXT,
  google_business_profile TEXT,
  social_presence TEXT,
  speed_security TEXT,
  brand_consistency TEXT,
  contact_accessibility TEXT,
  trust_compliance TEXT,

  -- Overall Score
  overall_score REAL,

  -- Report Type & Payment
  report_type TEXT NOT NULL,
  -- 'lead_magnet' - Paid $49 lead magnet
  -- 'application_bonus' - Free with accepted application
  -- 'monthly_maintenance' - Ongoing client monitoring
  -- 'on_demand' - Client requested check

  payment_status TEXT DEFAULT 'unpaid',
  -- 'unpaid', 'paid', 'complimentary', 'credited'

  amount_paid REAL DEFAULT 0,
  stripe_payment_id TEXT,
  stripe_checkout_session_id TEXT,

  -- Credit Tracking (for lead magnet conversions)
  credited_to_client BOOLEAN DEFAULT FALSE,
  credited_at INTEGER,
  credited_amount REAL,

  FOREIGN KEY (prospect_id) REFERENCES prospects(id),
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_health_checks_prospect ON health_checks(prospect_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_application ON health_checks(application_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_client ON health_checks(client_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_email ON health_checks(contact_email);
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON health_checks(created_at DESC);

-- ============================================
-- CLIENTS (Active Customers)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  -- Origin Tracking
  prospect_id TEXT, -- If they came from health check
  application_id TEXT NOT NULL,

  -- Basic Info
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  primary_website_url TEXT,

  -- Auth0 Integration
  auth0_user_id TEXT UNIQUE,

  -- Service Details
  service_plan TEXT, -- 'starter', 'professional', 'enterprise', 'maintenance'
  monthly_rate REAL,
  contract_start_date INTEGER,
  contract_end_date INTEGER,

  -- Health Check Credit (for lead magnet conversions)
  health_check_credit_applied BOOLEAN DEFAULT FALSE,
  health_check_credit_amount REAL DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active', -- active, paused, churned

  FOREIGN KEY (prospect_id) REFERENCES prospects(id),
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_auth0 ON clients(auth0_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_prospect ON clients(prospect_id);

-- ============================================
-- PROJECTS (Client Work)
-- Reserved for future multi-project client tracking.
-- Not currently written to by any Netlify function. Pending implementation.
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  client_id TEXT NOT NULL,

  -- Project Details
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT, -- 'new-site', 'redesign', 'maintenance', 'update'
  status TEXT DEFAULT 'active', -- active, completed, paused, cancelled

  -- Website Details
  url TEXT,
  staging_url TEXT,
  github_repo TEXT,

  -- Dates
  started_at INTEGER,
  completed_at INTEGER,

  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ============================================
-- INVOICES (Billing)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,

  client_id TEXT NOT NULL,
  project_id TEXT,

  -- Invoice Details
  invoice_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  description TEXT,

  -- Payment
  status TEXT DEFAULT 'pending', -- pending, paid, overdue, cancelled
  due_date INTEGER NOT NULL,
  paid_date INTEGER,

  -- Stripe Integration
  stripe_invoice_id TEXT,

  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);

-- ============================================
-- MAINTENANCE_LOGS (Activity Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,

  client_id TEXT NOT NULL,
  project_id TEXT,

  -- Activity Details
  activity_type TEXT NOT NULL, -- 'update', 'backup', 'security-patch', 'content-update'
  description TEXT NOT NULL,
  hours_spent REAL,

  -- Metadata
  performed_by TEXT, -- 'system' or admin name

  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_client ON maintenance_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_created ON maintenance_logs(created_at DESC);

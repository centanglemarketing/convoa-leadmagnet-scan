-- PostgreSQL database initialization script

-- Ensure the schema exists for the leads table
CREATE SCHEMA IF NOT EXISTS convoa_leadmagnet;

-- Leads table (using native UUID and JSONB)
CREATE TABLE IF NOT EXISTS convoa_leadmagnet.leads (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email             VARCHAR(255),
  business_name     VARCHAR(255),
  city              VARCHAR(255),
  trade             VARCHAR(100),
  profile_score     INT,
  comm_fail_count   INT,
  hours_flag        BOOLEAN DEFAULT FALSE,
  competitor_data   JSONB,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index on leads(email) in convoa_leadmagnet schema
CREATE INDEX IF NOT EXISTS idx_leads_email ON convoa_leadmagnet.leads(email);

-- Magic links table (using native UUID and JSONB)
CREATE TABLE IF NOT EXISTS magic_links (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token        VARCHAR(255) NOT NULL UNIQUE,
  email        VARCHAR(255) NOT NULL,
  scan_data    JSONB NOT NULL,
  used         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index on magic_links(token)
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);

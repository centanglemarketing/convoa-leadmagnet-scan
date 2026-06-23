-- Initialize tables for Convoa Lead Magnet Scan

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    city VARCHAR(255),
    trade VARCHAR(255),
    profile_score INTEGER,
    comm_fail_count INTEGER,
    hours_flag BOOLEAN DEFAULT FALSE,
    competitor_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index on leads(email)
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Magic links table
CREATE TABLE IF NOT EXISTS magic_links (
    id SERIAL PRIMARY KEY,
    token UUID NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    scan_data JSONB,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index on magic_links(token)
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);

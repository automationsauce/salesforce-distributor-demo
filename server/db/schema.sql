CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS distributor_criteria CASCADE;
DROP TABLE IF EXISTS distributor_agents CASCADE;
DROP TABLE IF EXISTS distributors CASCADE;
DROP TABLE IF EXISTS object_configs CASCADE;
DROP TABLE IF EXISTS crm_connections CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS assignment_logs CASCADE;

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE crm_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    crm_type VARCHAR(50),
    instance_url TEXT,
    client_id TEXT,
    client_secret_encrypted TEXT,
    refresh_token_encrypted TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (account_id, crm_type)
);

CREATE TABLE object_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    object_name VARCHAR(255),
    entry_queue_id VARCHAR(255),
    required_fields JSONB,
    enable_polling BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (account_id, object_name)
);

CREATE TABLE distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    object_config_id UUID NOT NULL REFERENCES object_configs(id),
    external_id VARCHAR(255),
    name VARCHAR(255),
    logic TEXT,
    priority INTEGER,
    next_agent_sequence INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE distributor_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID NOT NULL REFERENCES distributors(id),
    sequence_number INTEGER,
    field_name VARCHAR(255),
    operator VARCHAR(20),
    comparison_value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE distributor_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID NOT NULL REFERENCES distributors(id),
    external_user_id VARCHAR(255),
    name VARCHAR(255),
    sequence_number INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id INTEGER REFERENCES accounts(id),
    object_name VARCHAR(255),
    record_id VARCHAR(255),
    distributor_name VARCHAR(255),
    assigned_user_id VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
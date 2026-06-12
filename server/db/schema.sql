CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE crm_connections (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    crm_type VARCHAR(50),
    instance_url TEXT,
    client_id TEXT,
    client_secret_encrypted TEXT,
    refresh_token_encrypted TEXT,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE object_configs (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    object_name VARCHAR(255),
    entry_queue_id VARCHAR(255),
    required_fields JSONB,
    enable_polling BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE
);
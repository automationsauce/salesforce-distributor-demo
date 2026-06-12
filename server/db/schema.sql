CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    account_key TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
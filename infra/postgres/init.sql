-- roomKit database initialization

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed developer API key
INSERT INTO api_keys (key, description) 
VALUES ('dev', 'Local Development Key')
ON CONFLICT (key) DO NOTHING;

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'ended'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    egress_id TEXT,
    url TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recordings_room_id ON recordings(room_id);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
    id SERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    role TEXT NOT NULL, -- 'human' or 'agent'
    text TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    confidence REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transcripts_room_id ON transcripts(room_id);

-- Summaries table
CREATE TABLE IF NOT EXISTS summaries (
    id SERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    markdown TEXT NOT NULL,
    model TEXT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summaries_room_id ON summaries(room_id);

-- L6: tenants (multi-tenant scaffold)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO tenants (id, name) VALUES ('tenant-dev', 'Dev Tenant')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id);
UPDATE api_keys SET tenant_id = 'tenant-dev' WHERE tenant_id IS NULL;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id);
UPDATE rooms SET tenant_id = 'tenant-dev' WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

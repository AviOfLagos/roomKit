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

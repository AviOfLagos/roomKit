# roomKit — Standalone WebRTC + AI Meeting Platform

A hosted WebRTC meeting platform with a baked-in context-aware AI participant. Builders can initialize video rooms via a standard HTTP REST API, share the secure link with humans, and let the integrated AI assistant join the conversation. Custom AI agents can also stream into the call via an ultra-low-latency WebSocket binary audio gateway.

---

## Technical Stack
- **SFU**: LiveKit (self-hosted for dev, LiveKit Cloud for prod)
- **Gateway**: Node.js + TypeScript + Fastify (REST APIs, token generation, WS audio bridge)
- **Default AI Agent**: Python + `livekit-agents` (Silero VAD, Deepgram STT, OpenAI GPT-4o-mini, ElevenLabs TTS)
- **Web Client**: Next.js (App Router) + React + LiveKit React SDK
- **Database**: PostgreSQL (Drizzle ORM / Raw Postgres client)
- **Auth**: API Key header (`x-api-key`) for REST endpoints; JWT tokens signed by gateway API key for rooms

---

## 5-Minute Quickstart

### Prerequisites
- Node.js >= 22.0.0
- PNPM installed (`npm install -g pnpm`)
- Docker & Docker-Compose
- Python 3.11 with `pip`

### Step 1: Install Dependencies
From the repository root, install monorepo dependencies:
```bash
pnpm install
```

Set up the Python environment:
```bash
cd services/agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### Step 2: Spin Up Infrastructure
Launch LiveKit, PostgreSQL, and MinIO S3-mock containers:
```bash
docker-compose -f infra/docker-compose.yml up -d
```

### Step 3: Run the Platform (Dev Mode)
Create a `.env` file under `services/gateway/` matching the configuration below, then run the full stack:
```bash
pnpm dev
```
- Gateway Backend: `http://localhost:3000`
- Next.js Web Client: `http://localhost:3001` (rewrites `/v1/*` to proxy backend)

---

## REST API Reference

All requests to the HTTP API must contain the `x-api-key` header. For local development, this defaults to `dev`.

### 1. Initialize Room
Creates a new meeting space.
- **URL**: `POST /v1/rooms`
- **Headers**: `x-api-key: dev`
- **Body**:
```json
{
  "context": {
    "systemPrompt": "You are a polite, professional assistant."
  },
  "defaultAgent": true,
  "maxParticipants": 10
}
```
- **Response**:
```json
{
  "roomId": "room-bc81fa39",
  "joinUrl": "http://localhost:3000/room/room-bc81fa39",
  "agentToken": "eyJhbGciOi..."
}
```

### 2. Room Status
Fetches active participants.
- **URL**: `GET /v1/rooms/:id`
- **Headers**: `x-api-key: dev`
- **Response**:
```json
{
  "status": "active",
  "participants": [
    { "identity": "human-aefb", "name": "User A", "joinedAt": "2026-05-21T14:30:00Z" }
  ],
  "createdAt": "2026-05-21T14:28:00Z"
}
```

### 3. Terminate Room
Kicks participants and terminates the room session.
- **URL**: `DELETE /v1/rooms/:id`
- **Headers**: `x-api-key: dev`

### 4. Fetch Room Artifacts
- **Transcript**: `GET /v1/rooms/:id/transcript` -> returns speaker-tagged transcript chunks.
- **Summary**: `GET /v1/rooms/:id/summary` -> returns AI generated Markdown summary.
- **Recording**: `GET /v1/rooms/:id/recording` -> returns signed S3 composite mp4 link.

---

## BYO-AI WebSocket Gateway

External AI builders can connect custom voice/LLM agents directly via a raw WebSocket socket, bypassing WebRTC complexity.

- **WebSocket URL**: `ws://localhost:3000/v1/rooms/:roomId/agent?token=<agentToken>`

### Audio Frame Contract
- **Format**: Raw PCM (no header)
- **Sample Rate**: 16,000 Hz, mono
- **Precision**: Signed 16-bit, little-endian
- **Frame Size**: 20 ms frames (320 samples = 640 bytes)
- **Piping Rules**:
  - **Binary frames**: Send / receive audio payload (multiples of 640 bytes).
  - **Text frames**: Exchange control JSON events (`RoomEvent`).

### 30-Line BYO-AI Agent Example (`examples/byo-agent.py`)
```python
import asyncio
import sys
import json
import websockets

async def run_byo_agent(room_id: str, token: str):
    gateway_url = f"ws://localhost:3000/v1/rooms/{room_id}/agent?token={token}"
    print(f"Connecting Custom BYO Agent to: {gateway_url} ...")
    
    async with websockets.connect(gateway_url) as ws:
        print("Joined roomKit gateway!")
        async for message in ws:
            if isinstance(message, bytes):
                # Echo incoming room audio back
                await ws.send(message)
            else:
                event = json.loads(message)
                print(f"[Event] {event['type']}")

if __name__ == "__main__":
    asyncio.run(run_byo_agent(sys.argv[1], sys.argv[2]))
```

Run the example using:
```bash
python3 examples/byo-agent.py <roomId> <agentToken>
```

---

## Environment Variables Reference

Create a `.env` in `services/gateway/` to manage configurations:
```ini
PORT=3000
ROOMKIT_API_KEY=dev
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
DATABASE_URL=postgres://postgres:postgres@localhost:5432/roomkit
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=admin12345
MINIO_BUCKET=roomkit-recordings
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
```

---

## Production Deployment Notes

1. **LiveKit SFU**: Spin up a LiveKit Cloud project to get production-grade media servers with optimized TURN. Paste the credentials into your `.env`.
2. **Gateway**: Deploy the Node Fastify gateway to Vercel or any container service (Render, AWS ECS). Ensure persistent WebSockets are enabled.
3. **Database**: Use a serverless Postgres option like Supabase or Neon. Run `infra/postgres/init.sql` schema bootstrap.
4. **S3 Storage**: Set up an AWS S3, Cloudflare R2, or Vercel Blob bucket, and link it in the environment variables to persist recorded meeting mp4s.

---

## License

Licensed under the Apache License, Version 2.0 (the "License"). You may obtain a copy of the License in the LICENSE file.

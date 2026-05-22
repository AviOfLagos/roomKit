#!/usr/bin/env python3
import asyncio
import sys
import json
import websockets

async def run_byo_agent(room_id: str, token: str):
    # WS URL pointing to roomKit gateway
    # Note: Use ws:// for local HTTP, wss:// for production HTTPS
    gateway_url = f"ws://localhost:3000/v1/rooms/{room_id}/agent?token={token}"
    
    print(f"Connecting Custom BYO Agent to: {gateway_url} ...")
    
    try:
        async with websockets.connect(gateway_url) as ws:
            print("Successfully joined the roomKit audio bridge!")
            
            # Start bidirectional proxy
            async for message in ws:
                if isinstance(message, bytes):
                    # Incoming raw mixed room audio (16kHz, mono, Int16 LE PCM)
                    # For Phase 1 Echo test, we send the exact same bytes back
                    await ws.send(message)
                else:
                    # Incoming JSON Control Event
                    event = json.loads(message)
                    print(f"\n[Event Alert] Received Control Event: {event['type']}")
                    print(json.dumps(event, indent=2))
                    
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Connection closed by server: {e}")
    except Exception as e:
        print(f"Error occurred in BYO Agent: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python examples/byo-agent.py <roomId> <token>")
        sys.exit(1)
        
    room_id = sys.argv[1]
    token = sys.argv[2]
    
    try:
        asyncio.run(run_byo_agent(room_id, token))
    except KeyboardInterrupt:
        print("\nBYO Agent shut down by user.")

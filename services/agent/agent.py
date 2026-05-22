import asyncio
import logging
import json
import os
import requests
import time
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, JobProcess, run_app
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import openai, deepgram, elevenlabs, silero

# Load environment variables
load_dotenv()

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roomkit-agent")

GATEWAY_URL = os.getenv("NEXT_PUBLIC_GATEWAY_URL", "http://localhost:3000")

class RoomKitAgent:
    def __init__(self, ctx: JobContext):
        self.ctx = ctx
        self.room = ctx.room
        self.transcript_history = []
        self.human_speech_times = {} # participant_id -> last_speech_timestamp
        self.agent_name = "assistant"
        
        # Load system prompt and options from room metadata
        self.system_prompt = "You are a friendly, helpful AI host."
        self.default_agent = True
        
        if self.room.metadata:
            try:
                meta = json.loads(self.room.metadata)
                context = meta.get("context", {})
                self.system_prompt = context.get("systemPrompt", self.system_prompt)
                self.default_agent = meta.get("defaultAgent", True)
                logger.info(f"Loaded context from metadata. System prompt: {self.system_prompt}")
            except Exception as e:
                logger.error(f"Error parsing room metadata: {e}")

    async def start(self):
        # Join room
        logger.info(f"Connecting to room: {self.room.name}")
        
        # We check if defaultAgent is disabled
        if not self.default_agent:
            logger.info("Default agent is disabled for this room. Exiting.")
            return

        # Initialize voice pipeline
        # VAD: Silero VAD
        # STT: Deepgram STT
        # LLM: OpenAI gpt-4o-mini
        # TTS: ElevenLabs Flash
        self.agent = VoicePipelineAgent(
            vad=silero.VAD.load(),
            stt=deepgram.STT(),
            llm=openai.LLM(model="gpt-4o-mini", system_prompt=self.system_prompt),
            tts=elevenlabs.TTS(),
            barge_in_threshold=0.25 # 250ms sustained barge-in
        )

        # Register event handlers
        @self.agent.on("user_transcription_finished")
        def on_user_transcription(event):
            # Hook STT transcripts and save to DB
            text = event.text.strip()
            if not text:
                return
            
            participant_id = event.participant.identity
            display_name = event.participant.name or ""
            logger.info(f"STT: [{participant_id}]: {text}")
            
            # 1. Update human activity tracking
            now = time.time()
            if "agent" not in participant_id:
                self.human_speech_times[participant_id] = now
            
            # 2. Append to local transcript list
            self.transcript_history.append({
                "role": "human",
                "participant": participant_id,
                "name": display_name,
                "text": text,
                "at": now
            })
            
            # 3. Post to Gateway database
            try:
                chunk_id = f"chunk-{int(now*1000)}"
                requests.post(f"{GATEWAY_URL}/v1/rooms/{self.room.name}/transcripts", json={
                    "participantId": participant_id,
                    "displayName": display_name,
                    "role": "human",
                    "text": text,
                    "chunkId": chunk_id,
                    "confidence": 0.95
                }, timeout=2)
            except Exception as e:
                logger.error(f"Failed to persist transcript chunk to gateway: {e}")

        @self.agent.on("agent_action")
        def on_agent_action(action):
            # Triggered when agent speaks or replies
            logger.info(f"Agent Action: {action}")

        # Hook into agent's speech ended to save agent transcripts as well
        @self.agent.on("agent_speech_committed")
        def on_agent_speech_committed(event):
            text = event.text.strip()
            if not text:
                return
            
            now = time.time()
            self.transcript_history.append({
                "role": "agent",
                "participant": "default-agent",
                "name": "AI Agent",
                "text": text,
                "at": now
            })
            
            try:
                chunk_id = f"chunk-agent-{int(now*1000)}"
                requests.post(f"{GATEWAY_URL}/v1/rooms/{self.room.name}/transcripts", json={
                    "participantId": "default-agent",
                    "displayName": "AI Agent",
                    "role": "agent",
                    "text": text,
                    "chunkId": chunk_id,
                    "confidence": 1.0
                }, timeout=2)
            except Exception as e:
                logger.error(f"Failed to persist agent transcript chunk to gateway: {e}")

        # Start the voice pipeline in the room
        self.agent.start(self.room)

        # Greet first participant immediately if someone is already in, or wait for someone to join
        asyncio.create_task(self.greeting_loop())

    async def greeting_loop(self):
        # Wait a short moment for connection stability
        await asyncio.sleep(2)
        
        # Check if there's any human already in the room
        humans = [p for p in self.room.participants.values() if "agent" not in p.identity]
        if humans:
            first_human = humans[0]
            display_name = first_human.name or first_human.identity
            await self.agent.say(f"Hello {display_name}! Welcome back. How can I help you today?")
            return

        # Otherwise, wait for the first human to join
        @self.room.on("participant_joined")
        def on_participant_joined(participant: rtc.RemoteParticipant):
            if "agent" not in participant.identity:
                display_name = participant.name or participant.identity
                asyncio.create_task(self.greet_participant(display_name))

    async def greet_participant(self, name: str):
        await asyncio.sleep(1.5) # Wait for audio connection to establish
        await self.agent.say(f"Hello {name}! I am in the room. Nice to meet you!")

    def should_speak_gate_check(self, text: str) -> bool:
        """
        Gate check: Stays quiet if 2+ humans were active in the last 6 seconds
        AND the last utterance does not mention the agent name.
        """
        now = time.time()
        active_humans = 0
        for pid, last_time in self.human_speech_times.items():
            if now - last_time <= 6.0:
                active_humans += 1

        if active_humans >= 2:
            # Check if text contains agent's name
            text_lower = text.lower()
            if self.agent_name not in text_lower and "agent" not in text_lower and "roomkit" not in text_lower:
                logger.info(f"Should-speak Gate: Silenced reply. Active humans={active_humans}. Text: '{text}'")
                return False
        return True

    async def clean_and_summarize(self):
        logger.info("Room ended or closing. Generating summary...")
        
        if not self.transcript_history:
            logger.info("No transcripts to summarize.")
            return

        # Compile formatted transcript string
        formatted_transcript = ""
        for item in self.transcript_history:
            formatted_transcript += f"{item['name']} ({item['role']}): {item['text']}\n"

        # Ask OpenAI for summary
        try:
            # We can use direct OpenAI API since openai package is installed
            from openai import OpenAI
            client = OpenAI()
            
            prompt = (
                f"You are a meeting assistant. Summarize the following meeting room transcript in clean Markdown format with a title, key bullet points, and speaker-specific action items.\n\n"
                f"Transcript:\n{formatted_transcript}"
            )
            
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a professional scribe."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            summary_md = completion.choices[0].message.content
            logger.info("Summary successfully generated!")
            
            # Post summary to gateway
            requests.post(f"{GATEWAY_URL}/v1/rooms/{self.room.name}/summary", json={
                "markdown": summary_md,
                "model": "gpt-4o-mini"
            }, timeout=5)
            logger.info("Summary persisted to gateway database.")
            
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")

async def entrypoint(ctx: JobContext):
    agent_handler = RoomKitAgent(ctx)
    await agent_handler.start()
    
    # Wait until the room is disconnected
    while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        await asyncio.sleep(1)
        
    # Trigger final summary compilation on room disconnect
    await agent_handler.clean_and_summarize()

if __name__ == "__main__":
    run_app(WorkerOptions(entrypoint_fnc=entrypoint))

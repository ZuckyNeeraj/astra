# Astra Agents (Hermes orchestration)

Python + FastAPI service for the Hermes Orchestrator and specialist agents.
State lives in Convex; this layer runs reasoning and writes real output there.

## Setup

```bash
cd agents
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --reload --port 8000
```

Then open http://localhost:8000/docs

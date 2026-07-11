"""
Astra — Hermes agent orchestration layer (FastAPI).

This is the Python service where the Hermes Orchestrator plans subtasks and the
specialist agents (Hospital, Insurance, Document, Claim, Payment, Notification)
run. State lives in Convex — agents write real output there via activity:log etc.

For now this is a health-check stub so the service boots. Wire up the real
orchestrator + Convex client tomorrow.

Run:  uvicorn main:app --reload --port 8000   (from agents/, venv active)
"""
from fastapi import FastAPI

app = FastAPI(title="Astra Agents", version="0.0.1")


@app.get("/health")
def health():
    return {"status": "ok", "service": "astra-agents"}


@app.get("/")
def root():
    return {"message": "Astra Hermes orchestration layer. See /docs for the API."}

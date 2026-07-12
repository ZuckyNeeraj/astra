# Astra × Hermes — the orchestration layer

Astra runs on the **Hermes Agent** (Nous Research). Hermes is the manager/brain
that reasons with `gpt-5.6-sol` and coordinates the specialist agents. It does
its work by calling **Convex functions as tools** through the Convex MCP server;
Convex holds all state, and the deployed React app is the live dashboard.

```
Health Report email
   → Convex cron ingests → proposed plan          (already built)
   → watch.sh polls Convex for pending plans
   → Hermes Orchestrator (gpt-5.6-sol)
        └─ Convex MCP `run` → agentTools:* functions
             ├─ startJourneyFromPlan   (create journey + agents)
             ├─ Hospital  → linkupHospitalSearch (real web search)
             ├─ Insurance → coverage verdict
             ├─ Document  → readVault (present/missing)
             └─ Notification → family update
        └─ each step → logStep (tokens + cost)
   → Live Agents dashboard fills in real time
```

## One-time setup (already done on this machine)
- `hermes` installed (v0.18.x).
- Model: `gpt-5.6-sol`, provider `openai-api` (key in `~/.hermes/.env`).
- Convex MCP server registered: `hermes mcp list` shows `convex ✓ enabled`.

Verify: `hermes status` and `hermes mcp list`.

## Run it
1. Make sure Convex has a **proposed plan** to work on — send yourself a
   "Health Report" email (the cron ingests it within a minute), or run
   `npx convex run inbox:scanInbox` while signed in.
2. Start the loop:
   ```bash
   bash hermes/watch.sh
   ```
   It polls Convex; when a pending report appears, Hermes orchestrates the
   journey and writes live activity.
3. Open the **Live Agents** screen (local or https://astra-bac.pages.dev) and
   watch agents flip working→done, the event stream fill, and tokens/cost climb.

## Files
- `orchestrator.md` — the Orchestrator prompt Hermes runs (the "skill").
- `watch.sh` — the autonomous poll→orchestrate loop.

## Manual one-shot (no loop)
```bash
hermes --yolo -z "$(cat hermes/orchestrator.md)"
```

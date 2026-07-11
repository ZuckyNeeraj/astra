# Astra — dev & demo commands.
# Run `make` (or `make help`) to see everything.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Port the frontend is served on (override: `make demo PORT=5175`).
PORT ?= 5173

.PHONY: help install dev db web build deploy seed reset wipe demo stop

# Cloudflare Pages project name (override: `make deploy CF_PROJECT=my-astra`).
CF_PROJECT ?= astra

help: ## Show this help
	@echo "Astra — available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install root + frontend dependencies
	npm install
	cd frontend && npm install

dev: ## Run Convex + Vite together (Ctrl-C stops both)
	@echo "Starting Convex backend + Vite frontend…  (Ctrl-C to stop both)"
	@trap 'kill 0' INT TERM EXIT; \
	 npx convex dev & \
	 (cd frontend && npm run dev) & \
	 wait

db: ## Run only the Convex dev backend
	npx convex dev

web: ## Run only the Vite frontend
	cd frontend && npm run dev

build: ## Refresh Convex codegen + build the frontend to frontend/dist
	npx convex dev --once
	cd frontend && npm run build

deploy: build ## Build, then deploy frontend/dist to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
	@[ -n "$$CLOUDFLARE_API_TOKEN" ] || { echo "❌ Set CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) first."; exit 1; }
	npx wrangler pages deploy frontend/dist --project-name=$(CF_PROJECT) --commit-dirty=true

seed: ## Seed the demo journey (needs a signed-up user first)
	npx convex run seed:run

reset: ## Reset inbox demo — clears ingested reports & dismissed candidates (keeps users/journeys)
	npx convex run inbox:resetPipeline

wipe: ## ERASE ALL Convex data (users, auth, files) — start fresh from the signup screen
	@read -p "⚠️  This ERASES ALL Convex data including users. Continue? [y/N] " ans; \
	 [ "$$ans" = "y" ] || [ "$$ans" = "Y" ] || { echo "Aborted."; exit 1; }
	npx convex run admin:wipeAll
	@echo "✅ Wiped clean. Reload the app — you'll land on the signup screen."

demo: wipe ## Wipe all data, then open the app for a fresh run-through
	@echo "Opening the app at http://localhost:$(PORT) …"
	@open "http://localhost:$(PORT)" 2>/dev/null || echo "Open http://localhost:$(PORT) in your browser."

stop: ## Stop any running Convex/Vite dev servers
	-@pkill -f "convex dev" 2>/dev/null; pkill -f "vite" 2>/dev/null; echo "Stopped dev servers (if any were running)."

# ParlayCity Development Makefile

DEV_PORTS := 3000 3001 3002 8545
PID_DIR   := .pids

# -- Bootstrap (install all dev tools) --
bootstrap:
	./scripts/bootstrap.sh

# -- Setup (install project dependencies) --
setup:
	pnpm install
	cd packages/contracts && forge install foundry-rs/forge-std --no-git 2>/dev/null || true
	cd packages/contracts && forge install OpenZeppelin/openzeppelin-contracts --no-git 2>/dev/null || true

# -- Local Development --
chain:
	cd packages/contracts && anvil

deploy-local:
	cd packages/contracts && forge script script/Deploy.s.sol --broadcast --rpc-url http://127.0.0.1:8545
	./scripts/sync-env.sh

deploy-sepolia:
	@test -n "$$DEPLOYER_PRIVATE_KEY" || (echo "Error: DEPLOYER_PRIVATE_KEY env var required" && exit 1)
	@test -n "$$BASE_SEPOLIA_RPC_URL" || (echo "Error: BASE_SEPOLIA_RPC_URL env var required (default: https://sepolia.base.org)" && exit 1)
	cd packages/contracts && PRIVATE_KEY=$$DEPLOYER_PRIVATE_KEY forge script script/Deploy.s.sol \
		--broadcast --rpc-url $$BASE_SEPOLIA_RPC_URL --verify --slow
	./scripts/sync-env.sh sepolia

sync-env:
	./scripts/sync-env.sh

dev-web:
	cd apps/web && pnpm dev

dev-services:
	cd packages/services && pnpm dev

## Start all dev services (anvil + deploy + services + web)
dev:
	@echo "Starting ParlayCity dev stack..."
	@mkdir -p $(PID_DIR)
	@# Kill anything on our ports first
	@for port in $(DEV_PORTS); do \
		lsof -ti :$$port | xargs kill -9 2>/dev/null || true; \
	done
	@sleep 1
	@# Start anvil
	@nohup anvil > $(PID_DIR)/anvil.log 2>&1 & echo $$! > $(PID_DIR)/anvil.pid
	@echo "  Anvil started (pid $$(cat $(PID_DIR)/anvil.pid)) on :8545"
	@sleep 2
	@# Deploy contracts and sync env (clean cache to avoid stale source refs across branches)
	@cd packages/contracts && forge clean > /dev/null 2>&1 || true
	@cd packages/contracts && forge script script/Deploy.s.sol --broadcast --rpc-url http://127.0.0.1:8545 > ../../$(PID_DIR)/deploy.log 2>&1
	@./scripts/sync-env.sh
	@echo "  Contracts deployed, .env.local synced"
	@# Register catalog legs on-chain
	@cd packages/services && pnpm exec tsx ../../scripts/register-legs.ts > ../../$(PID_DIR)/register-legs.log 2>&1 || echo "  (register-legs skipped, see .pids/register-legs.log)"
	@echo "  Catalog legs registered on-chain"
	@# Start services
	@cd packages/services && nohup pnpm dev > ../../$(PID_DIR)/services.log 2>&1 & echo $$! > $(PID_DIR)/services.pid
	@echo "  Services started (pid $$(cat $(PID_DIR)/services.pid)) on :3001"
	@sleep 1
	@# Start web
	@cd apps/web && nohup pnpm dev > ../../$(PID_DIR)/web.log 2>&1 & echo $$! > $(PID_DIR)/web.pid
	@echo "  Web started (pid $$(cat $(PID_DIR)/web.pid)) on :3000"
	@sleep 3
	@echo ""
	@echo "Dev stack running. Use 'make dev-stop' to shut down."
	@echo "  Anvil:    http://localhost:8545"
	@echo "  Services: http://localhost:3001"
	@echo "  Web:      http://localhost:3000"
	@echo ""
	@echo "Logs in $(PID_DIR)/*.log"

## Stop all dev services
dev-stop:
	@echo "Stopping ParlayCity dev stack..."
	@for pidfile in $(PID_DIR)/*.pid; do \
		if [ -f "$$pidfile" ]; then \
			pid=$$(cat "$$pidfile"); \
			kill $$pid 2>/dev/null && echo "  Stopped pid $$pid ($$(basename $$pidfile .pid))" || true; \
			rm -f "$$pidfile"; \
		fi; \
	done
	@# Also kill any remaining processes on our ports
	@for port in $(DEV_PORTS); do \
		lsof -ti :$$port | xargs kill -9 2>/dev/null || true; \
	done
	@echo "All dev services stopped."

## Show status of dev services
dev-status:
	@echo "ParlayCity dev services:"
	@for port in 8545 3001 3000; do \
		if [ "$$port" = "8545" ]; then name="Anvil"; \
		elif [ "$$port" = "3001" ]; then name="Services"; \
		else name="Web"; fi; \
		pid=$$(lsof -ti :$$port 2>/dev/null | head -1); \
		if [ -n "$$pid" ]; then \
			echo "  $$name (:$$port) - running (pid $$pid)"; \
		else \
			echo "  $$name (:$$port) - stopped"; \
		fi; \
	done

# -- Testing --
test-contracts:
	cd packages/contracts && forge test -vvv

test-services:
	cd packages/services && pnpm test

test-web:
	cd apps/web && pnpm test

test-all: test-contracts test-services test-web

test-e2e:
	cd packages/e2e && pnpm test

# -- Quality Gate --
gate: test-all typecheck build-web

typecheck:
	cd apps/web && npx tsc --noEmit

build-web:
	cd apps/web && pnpm build

build-contracts:
	cd packages/contracts && forge build

coverage-contracts:
	cd packages/contracts && forge coverage --report summary

coverage-services:
	cd packages/services && npx vitest run --coverage

coverage-web:
	cd apps/web && npx vitest run --coverage

coverage: coverage-contracts coverage-services coverage-web

snapshot:
	cd packages/contracts && forge snapshot

# -- Local CI (act) --
ci:
	act pull_request

ci-contracts:
	act pull_request -j contracts

ci-services:
	act pull_request -j services

ci-web:
	act pull_request -j web

# -- Demo --
demo-seed:
	./scripts/demo-seed.sh

## Auto-resolve legs + settle tickets (buy a ticket, watch the rocket climb)
demo-autopilot:
	pnpm --filter services exec tsx ../../scripts/demo-autopilot.ts

## Auto-resolve with a crash (set CRASH_LEG_INDEX, 0-indexed, to the leg that loses)
demo-autopilot-crash:
	@echo "Crashing last leg of every ticket (CRASH_ODDS=100)"
	CRASH_ODDS=100 pnpm --filter services exec tsx ../../scripts/demo-autopilot.ts

# -- Leg Registration --
register-legs:
	pnpm --filter services exec tsx ../../scripts/register-legs.ts

# -- Agents --
risk-agent:
	pnpm --filter services exec tsx ../../scripts/risk-agent.ts

risk-agent-dry:
	DRY_RUN=true pnpm --filter services exec tsx ../../scripts/risk-agent.ts

# -- Cleanup --
clean:
	cd packages/contracts && forge clean
	cd apps/web && rm -rf .next

.PHONY: bootstrap setup chain deploy-local deploy-sepolia sync-env dev-web dev-services dev dev-stop dev-status test-contracts test-services test-web test-all test-e2e gate typecheck build-web build-contracts coverage coverage-contracts coverage-services coverage-web snapshot ci ci-contracts ci-services ci-web demo-seed demo-autopilot demo-autopilot-crash register-legs clean risk-agent risk-agent-dry

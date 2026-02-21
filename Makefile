# ParlayCity Development Makefile

DEV_PORTS := 3000 3001 3002 8545
PID_DIR   := .pids

# Load .env if it exists (secrets, RPC URLs, contract addresses)
-include .env
export

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
	cd packages/contracts && USDC_ADDRESS= forge script script/Deploy.s.sol --broadcast --rpc-url http://127.0.0.1:8545
	USDC_ADDRESS= ./scripts/sync-env.sh

deploy-sepolia:
	@test -n "$$DEPLOYER_PRIVATE_KEY" || (echo "Error: DEPLOYER_PRIVATE_KEY required (set in .env)" && exit 1)
	$(eval RPC := $(or $(BASE_SEPOLIA_RPC_URL),https://sepolia.base.org))
	$(eval VERIFY_FLAG := $(if $(BASESCAN_API_KEY),--verify --etherscan-api-key $(BASESCAN_API_KEY) --verifier-url https://api-sepolia.basescan.org/api,))
	cd packages/contracts && \
		PRIVATE_KEY=$$DEPLOYER_PRIVATE_KEY \
		USDC_ADDRESS=$(USDC_ADDRESS) \
		BOOTSTRAP_DAYS=30 \
		forge script script/Deploy.s.sol \
			--broadcast --rpc-url $(RPC) $(VERIFY_FLAG) --slow
	USDC_ADDRESS=$(USDC_ADDRESS) ./scripts/sync-env.sh sepolia

## Full Sepolia pipeline: deploy + register legs + seed demo data
deploy-sepolia-full: deploy-sepolia register-legs-sepolia demo-seed-sepolia
	@echo ""
	@echo "=== Base Sepolia deployment complete ==="
	@echo "Run 'make create-pool-sepolia' to create Uniswap V3 USDC/WETH pool"

## Register catalog legs on Base Sepolia
register-legs-sepolia:
	$(eval RPC := $(or $(BASE_SEPOLIA_RPC_URL),https://sepolia.base.org))
	RPC_URL=$(RPC) PRIVATE_KEY=$$DEPLOYER_PRIVATE_KEY \
		pnpm --filter services exec tsx ../../scripts/register-legs.ts

## Seed demo data on Base Sepolia
demo-seed-sepolia:
	USDC_ADDRESS=$(USDC_ADDRESS) \
	BASE_SEPOLIA_RPC_URL=$(or $(BASE_SEPOLIA_RPC_URL),https://sepolia.base.org) \
	DEPLOYER_PRIVATE_KEY=$$DEPLOYER_PRIVATE_KEY \
	ACCOUNT1_PRIVATE_KEY=$${ACCOUNT1_PRIVATE_KEY:-$$DEPLOYER_PRIVATE_KEY} \
		./scripts/demo-seed.sh sepolia

## Create Uniswap V3 USDC/WETH pool on Base Sepolia
create-pool-sepolia:
	@test -n "$$DEPLOYER_PRIVATE_KEY" || (echo "Error: DEPLOYER_PRIVATE_KEY required (set in .env)" && exit 1)
	$(eval RPC := $(or $(BASE_SEPOLIA_RPC_URL),https://sepolia.base.org))
	cd packages/contracts && \
		PRIVATE_KEY=$$DEPLOYER_PRIVATE_KEY \
		USDC_ADDRESS=$(USDC_ADDRESS) \
		WETH_ADDRESS=$(or $(WETH_ADDRESS),0x4200000000000000000000000000000000000006) \
		UNISWAP_NFPM=$(or $(UNISWAP_NFPM),0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2) \
		forge script script/CreatePool.s.sol \
			--broadcast --rpc-url $(RPC) --slow

## Print deployer address and funding instructions
fund-deployer:
	@echo "Deployer address: $(or $(DEPLOYER_ADDRESS),$(shell cast wallet address $$DEPLOYER_PRIVATE_KEY 2>/dev/null || echo 'DEPLOYER_PRIVATE_KEY not set'))"
	@echo ""
	@echo "1. Get Base Sepolia ETH:"
	@echo "   https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
	@echo "   https://faucet.quicknode.com/base/sepolia"
	@echo ""
	@echo "2. Get testnet USDC (20 per 2h):"
	@echo "   https://faucet.circle.com/"
	@echo "   Select 'Base Sepolia' and paste your deployer address"

## Mint MockUSDC to any wallet on Base Sepolia (10,000 per call, no access control)
## Usage: make fund-wallet WALLET=0x... [AMOUNT=10000] [RPC=https://sepolia.base.org]
fund-wallet:
	$(eval RPC := $(or $(BASE_SEPOLIA_RPC_URL),https://sepolia.base.org))
	$(eval USDC := $(shell grep NEXT_PUBLIC_USDC_ADDRESS apps/web/.env.local 2>/dev/null | cut -d= -f2))
	$(eval AMT_USDC := $(or $(AMOUNT),10000))
	$(eval AMT_RAW := $(shell echo "$(AMT_USDC) * 1000000" | bc))
	@test -n "$(WALLET)" || (echo "Usage: make fund-wallet WALLET=0x..." && exit 1)
	@test -n "$(USDC)" || (echo "Error: USDC address not found. Run 'make deploy-sepolia' first." && exit 1)
	@echo "Minting $(AMT_USDC) MockUSDC to $(WALLET) on Base Sepolia..."
	@cast send $(USDC) "mint(address,uint256)" $(WALLET) $(AMT_RAW) \
		--rpc-url $(RPC) --private-key $(DEPLOYER_PRIVATE_KEY)
	@echo ""
	@echo "Balance: $$(cast call $(USDC) 'balanceOf(address)(uint256)' $(WALLET) --rpc-url $(RPC) | awk '{printf "%.2f MockUSDC\n", $$1/1000000}')"

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
	@cd packages/contracts && USDC_ADDRESS= forge script script/Deploy.s.sol --broadcast --rpc-url http://127.0.0.1:8545 > ../../$(PID_DIR)/deploy.log 2>&1
	@USDC_ADDRESS= ./scripts/sync-env.sh
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

.PHONY: bootstrap setup chain deploy-local deploy-sepolia deploy-sepolia-full sync-env dev-web dev-services dev dev-stop dev-status test-contracts test-services test-web test-all test-e2e gate typecheck build-web build-contracts coverage coverage-contracts coverage-services coverage-web snapshot ci ci-contracts ci-services ci-web demo-seed demo-seed-sepolia demo-autopilot demo-autopilot-crash register-legs register-legs-sepolia create-pool-sepolia fund-deployer fund-wallet clean risk-agent risk-agent-dry

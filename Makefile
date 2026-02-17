# ParlayCity Development Makefile

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

dev-web:
	cd apps/web && pnpm dev

dev-services:
	cd packages/services && pnpm dev

# -- Testing --
test-contracts:
	cd packages/contracts && forge test -vvv

test-services:
	cd packages/services && pnpm test

test-all: test-contracts test-services

# -- Quality Gate --
gate: test-all typecheck build-web

typecheck:
	cd apps/web && npx tsc --noEmit

build-web:
	cd apps/web && pnpm build

build-contracts:
	cd packages/contracts && forge build

coverage:
	cd packages/contracts && forge coverage --report summary

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

# -- Cleanup --
clean:
	cd packages/contracts && forge clean
	cd apps/web && rm -rf .next

.PHONY: bootstrap setup chain deploy-local dev-web dev-services test-contracts test-services test-all gate typecheck build-web build-contracts coverage snapshot ci ci-contracts ci-services ci-web clean

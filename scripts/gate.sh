#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  echo -e "${YELLOW}[GATE]${NC} $name..."
  if "$@" > /dev/null 2>&1; then
    echo -e "${GREEN}[PASS]${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}[FAIL]${NC} $name"
    FAIL=$((FAIL + 1))
  fi
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================="
echo " ParlayCity Quality Gate"
echo "=============================="
echo ""

# Contracts
check "Forge fmt check" bash -c "cd packages/contracts && forge fmt --check"
check "Forge build" bash -c "cd packages/contracts && forge build"
check "Forge test (unit)" bash -c "cd packages/contracts && forge test --match-path 'test/unit/*'"
check "Forge test (fuzz)" bash -c "cd packages/contracts && forge test --match-path 'test/fuzz/*'"
check "Forge test (invariant)" bash -c "cd packages/contracts && forge test --match-path 'test/invariant/*'"

# Web
check "Web lint" pnpm --filter web lint
check "Web typecheck" pnpm --filter web typecheck
check "Web build" pnpm --filter web build

# Services
check "Services lint" pnpm --filter @parlaycity/services lint
check "Services typecheck" pnpm --filter @parlaycity/services typecheck

# Shared
check "Shared lint" pnpm --filter @parlaycity/shared lint
check "Shared typecheck" pnpm --filter @parlaycity/shared typecheck

echo ""
echo "=============================="
echo -e " Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "=============================="

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Quality gate FAILED.${NC}"
  exit 2
fi

echo -e "${GREEN}Quality gate PASSED.${NC}"

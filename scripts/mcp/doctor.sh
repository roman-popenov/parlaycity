#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "==> ParlayCity MCP Doctor"
echo ""

check() {
  local name="$1"
  local cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}[OK]${NC} $name ($cmd found)"
  else
    echo -e "${RED}[MISSING]${NC} $name ($cmd not found)"
  fi
}

check_env() {
  local name="$1"
  local var="$2"
  if [ -n "${!var:-}" ]; then
    echo -e "${GREEN}[OK]${NC} $name (\$$var set)"
  else
    echo -e "${YELLOW}[WARN]${NC} $name (\$$var not set)"
  fi
}

echo "--- Tools ---"
check "Foundry (forge)" "forge"
check "Anvil" "anvil"
check "Cast" "cast"
check "Slither" "slither"
check "Node.js" "node"
check "pnpm" "pnpm"
check "Python3" "python3"

echo ""
echo "--- Environment ---"
check_env "Base Sepolia RPC" "BASE_SEPOLIA_RPC_URL"
check_env "Deployer Key" "DEPLOYER_PRIVATE_KEY"
check_env "Mistral API Key" "MISTRAL_API_KEY"
check_env "GitHub PAT" "GITHUB_PERSONAL_ACCESS_TOKEN"

echo ""
echo "--- MCP Config ---"
if [ -f ".mcp.json" ]; then
  echo -e "${GREEN}[OK]${NC} .mcp.json exists"
else
  echo -e "${RED}[MISSING]${NC} .mcp.json not found"
fi

echo ""
echo "Doctor complete."

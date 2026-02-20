#!/usr/bin/env bash
# Reads deployed contract addresses from forge broadcast output
# and writes them to apps/web/.env.local
#
# Usage:
#   ./sync-env.sh          # Anvil (chain 31337)
#   ./sync-env.sh sepolia  # Base Sepolia (chain 84532)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

NETWORK="${1:-local}"

if [ "$NETWORK" = "sepolia" ]; then
  CHAIN_ID=84532
  BROADCAST="$ROOT/packages/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
else
  CHAIN_ID=31337
  BROADCAST="$ROOT/packages/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
fi

ENV_FILE="$ROOT/apps/web/.env.local"

if [ ! -f "$BROADCAST" ]; then
  echo "No broadcast file found at $BROADCAST"
  if [ "$NETWORK" = "sepolia" ]; then
    echo "Run 'make deploy-sepolia' first."
  else
    echo "Run 'make deploy-local' first."
  fi
  exit 1
fi

# Extract CREATE transaction addresses by contractName
get_addr() {
  local name="$1"
  python3 -c "
import json, sys
with open('$BROADCAST') as f:
    data = json.load(f)
for tx in data['transactions']:
    if tx.get('transactionType') == 'CREATE' and tx.get('contractName') == '$name':
        print(tx['contractAddress'])
        sys.exit(0)
print('')
"
}

USDC=$(get_addr "MockUSDC")
HOUSE_VAULT=$(get_addr "HouseVault")
PARLAY_ENGINE=$(get_addr "ParlayEngine")
LEG_REGISTRY=$(get_addr "LegRegistry")
LOCK_VAULT=$(get_addr "LockVault")

# Preserve WalletConnect project ID if it exists
WC_ID=""
if [ -f "$ENV_FILE" ]; then
  WC_ID=$(grep -oP '(?<=NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=).*' "$ENV_FILE" 2>/dev/null || true)
fi

cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_HOUSE_VAULT_ADDRESS=$HOUSE_VAULT
NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS=$PARLAY_ENGINE
NEXT_PUBLIC_LEG_REGISTRY_ADDRESS=$LEG_REGISTRY
NEXT_PUBLIC_USDC_ADDRESS=$USDC
NEXT_PUBLIC_LOCK_VAULT_ADDRESS=$LOCK_VAULT
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$WC_ID
EOF

echo "Updated $ENV_FILE with deployed addresses (chain $CHAIN_ID):"
echo "  USDC:          $USDC"
echo "  HouseVault:    $HOUSE_VAULT"
echo "  ParlayEngine:  $PARLAY_ENGINE"
echo "  LegRegistry:   $LEG_REGISTRY"
echo "  LockVault:     $LOCK_VAULT"

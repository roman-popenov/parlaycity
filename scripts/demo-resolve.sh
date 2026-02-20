#!/usr/bin/env bash
# demo-resolve.sh -- Interactively resolve legs and settle tickets.
#
# Usage:
#   ./scripts/demo-resolve.sh [leg_id]           # Local Anvil
#   ./scripts/demo-resolve.sh [leg_id] sepolia   # Base Sepolia
#
# If leg_id is provided, resolves that leg as Won then prompts for next.
# If no leg_id, starts from 0 and walks through all legs interactively.
#
# Requires: cast (foundry), deployed contracts with seeded data
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# Parse args: first numeric arg is leg_id, "sepolia" sets network
LEG_ID=""
NETWORK="local"
for arg in "$@"; do
  if [[ "$arg" =~ ^[0-9]+$ ]]; then
    LEG_ID="$arg"
  elif [ "$arg" = "sepolia" ]; then
    NETWORK="sepolia"
  fi
done

# --- RPC + keys ---
if [ "$NETWORK" = "sepolia" ]; then
  RPC_URL="${BASE_SEPOLIA_RPC_URL:?Set BASE_SEPOLIA_RPC_URL}"
  DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY}"
  CHAIN_ID=84532
else
  RPC_URL="http://127.0.0.1:8545"
  DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  CHAIN_ID=31337
fi

# --- Load addresses from broadcast ---
BROADCAST="$ROOT/packages/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
if [ ! -f "$BROADCAST" ]; then
  echo "ERROR: No broadcast at $BROADCAST. Deploy first."
  exit 1
fi

get_addr() {
  python3 -c "
import json, sys
with open('$BROADCAST') as f:
    data = json.load(f)
for tx in data['transactions']:
    if tx.get('transactionType') == 'CREATE' and tx.get('contractName') == '$1':
        print(tx['contractAddress'])
        sys.exit(0)
sys.exit(1)
"
}

ORACLE=$(get_addr "AdminOracleAdapter")
ENGINE=$(get_addr "ParlayEngine")

echo "=== ParlayCity Demo Resolver ==="
echo "Network: $NETWORK (chain $CHAIN_ID)"
echo "Oracle:  $ORACLE"
echo "Engine:  $ENGINE"
echo ""

# LegStatus enum: 0=Unresolved, 1=Won, 2=Lost, 3=Voided
# Outcome for "Yes"
YES=$(cast keccak "Yes")
NO=$(cast keccak "No")

resolve_leg() {
  local lid="$1"
  local status="$2"  # 1=Won, 2=Lost
  local outcome="$3"

  local status_name="Won"
  [ "$status" = "2" ] && status_name="Lost"

  echo "Resolving leg $lid as $status_name..."
  if cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" \
    "$ORACLE" "resolve(uint256,uint8,bytes32)" "$lid" "$status" "$outcome" > /dev/null 2>&1; then
    echo "  Leg $lid resolved as $status_name"
  else
    echo "  ERROR: Failed to resolve leg $lid (may already be resolved)"
  fi
}

settle_ticket() {
  local tid="$1"
  echo "Settling ticket $tid..."
  if cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" \
    "$ENGINE" "settleTicket(uint256)" "$tid" > /dev/null 2>&1; then
    echo "  Ticket $tid settled"
  else
    echo "  Ticket $tid: settlement skipped (not all legs resolved or already settled)"
  fi
}

# --- Interactive resolve loop ---
current_leg="${LEG_ID:-0}"

while true; do
  echo ""
  echo "--- Leg $current_leg ---"
  echo "  [w] Resolve as WON"
  echo "  [l] Resolve as LOST"
  echo "  [s] Skip this leg"
  echo "  [t] Try settling all tickets (0-9)"
  echo "  [q] Quit"
  echo ""
  read -rp "Action for leg $current_leg: " action

  case "$action" in
    w|W)
      resolve_leg "$current_leg" 1 "$YES"
      current_leg=$((current_leg + 1))
      ;;
    l|L)
      resolve_leg "$current_leg" 2 "$NO"
      current_leg=$((current_leg + 1))
      ;;
    s|S)
      echo "  Skipped leg $current_leg"
      current_leg=$((current_leg + 1))
      ;;
    t|T)
      echo ""
      echo "Attempting to settle tickets 0-9..."
      for tid in $(seq 0 9); do
        settle_ticket "$tid"
      done
      ;;
    q|Q)
      echo "Done."
      exit 0
      ;;
    *)
      echo "  Unknown action. Use w/l/s/t/q."
      ;;
  esac
done

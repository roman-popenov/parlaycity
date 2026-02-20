#!/usr/bin/env bash
# demo-seed.sh -- Seeds the deployed ParlayCity contracts with sample data.
#
# Creates 5 legs, deposits LP liquidity, buys 4 tickets across 2 wallets
# using Classic, Progressive, and EarlyCashout payout modes.
#
# Usage:
#   ./scripts/demo-seed.sh                 # Local Anvil (default)
#   ./scripts/demo-seed.sh sepolia         # Base Sepolia
#
# Requires: cast (foundry), deployed contracts (run deploy first)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

NETWORK="${1:-local}"

# --- RPC + keys ---
if [ "$NETWORK" = "sepolia" ]; then
  RPC_URL="${BASE_SEPOLIA_RPC_URL:?Set BASE_SEPOLIA_RPC_URL}"
  DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY}"
  ACCOUNT1_KEY="${ACCOUNT1_PRIVATE_KEY:?Set ACCOUNT1_PRIVATE_KEY for Sepolia}"
  CHAIN_ID=84532
else
  RPC_URL="http://127.0.0.1:8545"
  # Anvil default keys
  DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  ACCOUNT1_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  CHAIN_ID=31337
fi

# Safety: when running in local mode, warn if a remote RPC env var is set.
# Catches the case where a user has BASE_SEPOLIA_RPC_URL set but forgot to pass "sepolia".
if [ "$NETWORK" = "local" ] && [ -n "${BASE_SEPOLIA_RPC_URL:-}" ]; then
  echo "WARNING: NETWORK is 'local' but BASE_SEPOLIA_RPC_URL is set in your env."
  echo "         Did you mean: $0 sepolia"
  echo "         Continuing will use Anvil default keys against localhost."
  read -rp "Continue with local? [y/N] " confirm
  [ "$confirm" = "y" ] || [ "$confirm" = "Y" ] || exit 1
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
with open(sys.argv[1]) as f:
    data = json.load(f)
for tx in data['transactions']:
    if tx.get('transactionType') == 'CREATE' and tx.get('contractName') == sys.argv[2]:
        print(tx['contractAddress'])
        sys.exit(0)
sys.exit(1)
" "$BROADCAST" "$1"
}

USDC=$(get_addr "MockUSDC")
VAULT=$(get_addr "HouseVault")
ENGINE=$(get_addr "ParlayEngine")
REGISTRY=$(get_addr "LegRegistry")
ORACLE=$(get_addr "AdminOracleAdapter")

DEPLOYER_ADDR=$(cast wallet address "$DEPLOYER_KEY")
ACCOUNT1_ADDR=$(cast wallet address "$ACCOUNT1_KEY")

echo "=== ParlayCity Demo Seed ==="
echo "Network:      $NETWORK (chain $CHAIN_ID)"
echo "RPC:          $RPC_URL"
echo "Deployer:     $DEPLOYER_ADDR"
echo "Account1:     $ACCOUNT1_ADDR"
echo "USDC:         $USDC"
echo "HouseVault:   $VAULT"
echo "ParlayEngine: $ENGINE"
echo "LegRegistry:  $REGISTRY"
echo "Oracle:       $ORACLE"
echo ""

# Helper: send a transaction
send() {
  local key="$1"; shift
  cast send --private-key "$key" --rpc-url "$RPC_URL" "$@" > /dev/null 2>&1
}

# --- 1. Deposit LP liquidity into HouseVault ---
# Deploy.s.sol already minted 10,000 USDC each. Use a small slice for
# realistic demo numbers that judges can relate to.
echo "--- Depositing LP Liquidity ---"
send "$DEPLOYER_KEY" "$USDC" "approve(address,uint256)" "$VAULT" 600000000  # 600 USDC
send "$DEPLOYER_KEY" "$VAULT" "deposit(uint256,address)" 600000000 "$DEPLOYER_ADDR"
echo "  Deployer deposited 600 USDC into HouseVault"

send "$ACCOUNT1_KEY" "$USDC" "approve(address,uint256)" "$VAULT" 400000000  # 400 USDC
send "$ACCOUNT1_KEY" "$VAULT" "deposit(uint256,address)" 400000000 "$ACCOUNT1_ADDR"
echo "  Account1 deposited 400 USDC into HouseVault"

# --- 3. Create legs ---
echo ""
echo "--- Creating Legs ---"

NOW=$(cast block latest --rpc-url "$RPC_URL" -f timestamp)
CUTOFF=$((NOW + 86400))       # +1 day
RESOLVE=$((NOW + 86400 + 3600))  # +1 day + 1 hour

# createLeg(string,string,uint256,uint256,address,uint256)
LEGS=(
  "Will ETH break \$5000 by March 2026?|coingecko:eth|350000"
  "Will BTC reach \$200k by March 2026?|coingecko:btc|250000"
  "Will SOL flip \$400 by March 2026?|coingecko:sol|200000"
  "Will Base TVL exceed \$20B by March 2026?|defillama:base|400000"
  "Will ETHDenver 2026 have 20k+ attendees?|manual:ethdenver|600000"
)

for i in "${!LEGS[@]}"; do
  IFS='|' read -r question source prob <<< "${LEGS[$i]}"
  send "$DEPLOYER_KEY" "$REGISTRY" \
    "createLeg(string,string,uint256,uint256,address,uint256)" \
    "$question" "$source" "$CUTOFF" "$RESOLVE" "$ORACLE" "$prob"
  echo "  Leg $i: $question (prob: ${prob} PPM)"
done

# Figure out leg IDs -- the deploy script already created 3 legs (0,1,2),
# so our new legs start at 3. But on a fresh deploy they start at 0.
# Read _legCount to determine what we have.
LEG_COUNT_HEX=$(cast call "$REGISTRY" "legCount()(uint256)" --rpc-url "$RPC_URL" 2>/dev/null || echo "")
if [ -z "$LEG_COUNT_HEX" ]; then
  # Try alternative: read the last known ID
  echo "  (Could not read legCount, assuming legs start at 0)"
  FIRST_LEG=0
else
  TOTAL_LEGS=$((LEG_COUNT_HEX))
  FIRST_LEG=$((TOTAL_LEGS - 5))
  echo "  Total legs in registry: $TOTAL_LEGS (our legs: $FIRST_LEG-$((TOTAL_LEGS - 1)))"
fi

L0=$FIRST_LEG
L1=$((FIRST_LEG + 1))
L2=$((FIRST_LEG + 2))
L3=$((FIRST_LEG + 3))
L4=$((FIRST_LEG + 4))

# --- 4. Buy tickets ---
echo ""
echo "--- Buying Tickets ---"

# Approve engine to spend USDC
send "$DEPLOYER_KEY" "$USDC" "approve(address,uint256)" "$ENGINE" 50000000  # 50 USDC
send "$ACCOUNT1_KEY" "$USDC" "approve(address,uint256)" "$ENGINE" 50000000  # 50 USDC

# Outcome bytes32 for "Yes" = keccak256("Yes")
YES=$(cast keccak "Yes")

# Ticket stakes are small to stay under vault's 5% max payout cap.
# With 1,000 USDC vault TVL, max payout ~50 USDC.

# Ticket 1: Deployer, Classic mode (0), legs 0+1, $2
send "$DEPLOYER_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L0,$L1]" "[$YES,$YES]" 2000000 0
echo "  Ticket: deployer, Classic, legs [$L0,$L1], stake \$2"

# Ticket 2: Deployer, Progressive mode (1), legs 0+2+3, $1
send "$DEPLOYER_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L0,$L2,$L3]" "[$YES,$YES,$YES]" 1000000 1
echo "  Ticket: deployer, Progressive, legs [$L0,$L2,$L3], stake \$1"

# Ticket 3: Account1, EarlyCashout mode (2), legs 1+3+4, $2
send "$ACCOUNT1_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L1,$L3,$L4]" "[$YES,$YES,$YES]" 2000000 2
echo "  Ticket: account1, EarlyCashout, legs [$L1,$L3,$L4], stake \$2"

# Ticket 4: Account1, Classic mode (0), legs 2+4, $3
send "$ACCOUNT1_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L2,$L4]" "[$YES,$YES]" 3000000 0
echo "  Ticket: account1, Classic, legs [$L2,$L4], stake \$3"

# --- Summary ---
echo ""
echo "=== Seed Complete ==="
echo "Legs created:   5 (IDs $L0-$L4)"
echo "Tickets bought: 4"
echo "LP deposits:    1,000 USDC total"
echo ""
echo "Next: start the autopilot to auto-resolve legs:"
echo "  make demo-autopilot"
echo ""
echo "Or resolve manually:"
echo "  ./scripts/demo-resolve.sh"

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

# USDC: prefer env var (required for Sepolia where we use Circle USDC)
if [ -n "${USDC_ADDRESS:-}" ]; then
  USDC="$USDC_ADDRESS"
else
  USDC=$(get_addr "MockUSDC") || true
  if [ -z "$USDC" ]; then
    echo "ERROR: No USDC_ADDRESS env var and no MockUSDC in broadcast."
    echo "For Sepolia, set USDC_ADDRESS to Circle USDC on Base Sepolia."
    exit 1
  fi
fi

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
# Detect if USDC is mintable (MockUSDC on local) or real (Circle USDC on Sepolia).
# If mintable, mint first. If real, user must have USDC from a faucet.
IS_MOCK=false
if cast call "$USDC" "mint(address,uint256)" "$DEPLOYER_ADDR" 0 --rpc-url "$RPC_URL" > /dev/null 2>&1; then
  IS_MOCK=true
fi

if [ "$NETWORK" = "sepolia" ]; then
  # Sepolia: smaller amounts (limited faucet USDC)
  LP_DEPLOYER=50000000   # 50 USDC
  LP_ACCOUNT1=30000000   # 30 USDC
  LP_LABEL_D="50"
  LP_LABEL_A="30"
  LP_TOTAL="80"
else
  LP_DEPLOYER=600000000  # 600 USDC
  LP_ACCOUNT1=400000000  # 400 USDC
  LP_LABEL_D="600"
  LP_LABEL_A="400"
  LP_TOTAL="1,000"
fi

echo "--- Depositing LP Liquidity ---"
if [ "$IS_MOCK" = true ]; then
  echo "  MockUSDC detected -- minting before deposit"
  send "$DEPLOYER_KEY" "$USDC" "mint(address,uint256)" "$DEPLOYER_ADDR" "$LP_DEPLOYER"
  send "$DEPLOYER_KEY" "$USDC" "mint(address,uint256)" "$ACCOUNT1_ADDR" "$LP_ACCOUNT1"
else
  echo "  Real USDC detected -- skipping mint (ensure wallets are funded via faucet)"
fi

send "$DEPLOYER_KEY" "$USDC" "approve(address,uint256)" "$VAULT" "$LP_DEPLOYER"
send "$DEPLOYER_KEY" "$VAULT" "deposit(uint256,address)" "$LP_DEPLOYER" "$DEPLOYER_ADDR"
echo "  Deployer deposited $LP_LABEL_D USDC into HouseVault"

send "$ACCOUNT1_KEY" "$USDC" "approve(address,uint256)" "$VAULT" "$LP_ACCOUNT1"
send "$ACCOUNT1_KEY" "$VAULT" "deposit(uint256,address)" "$LP_ACCOUNT1" "$ACCOUNT1_ADDR"
echo "  Account1 deposited $LP_LABEL_A USDC into HouseVault"

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

# Sepolia: smaller stakes to stay within limited vault TVL
if [ "$NETWORK" = "sepolia" ]; then
  STAKE_SM=500000    # $0.50
  STAKE_MD=1000000   # $1.00
  STAKE_LG=1500000   # $1.50
  APPROVE_EACH=5000000  # $5
else
  STAKE_SM=1000000   # $1
  STAKE_MD=2000000   # $2
  STAKE_LG=3000000   # $3
  APPROVE_EACH=50000000  # $50
fi

if [ "$IS_MOCK" = true ]; then
  send "$DEPLOYER_KEY" "$USDC" "mint(address,uint256)" "$DEPLOYER_ADDR" "$APPROVE_EACH"
  send "$DEPLOYER_KEY" "$USDC" "mint(address,uint256)" "$ACCOUNT1_ADDR" "$APPROVE_EACH"
fi

# Approve engine to spend USDC
send "$DEPLOYER_KEY" "$USDC" "approve(address,uint256)" "$ENGINE" "$APPROVE_EACH"
send "$ACCOUNT1_KEY" "$USDC" "approve(address,uint256)" "$ENGINE" "$APPROVE_EACH"

# Outcome bytes32 for "Yes" = bytes32(uint256(1)), matching ParlayEngine + frontend conventions
YES="0x0000000000000000000000000000000000000000000000000000000000000001"

# Ticket stakes stay under vault's 5% max payout cap.

# Ticket 1: Deployer, Classic mode (0), legs 0+1
send "$DEPLOYER_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L0,$L1]" "[$YES,$YES]" "$STAKE_MD" 0
echo "  Ticket: deployer, Classic, legs [$L0,$L1], stake \$$(echo "scale=2; $STAKE_MD / 1000000" | bc)"

# Ticket 2: Deployer, Progressive mode (1), legs 0+2+3
send "$DEPLOYER_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L0,$L2,$L3]" "[$YES,$YES,$YES]" "$STAKE_SM" 1
echo "  Ticket: deployer, Progressive, legs [$L0,$L2,$L3], stake \$$(echo "scale=2; $STAKE_SM / 1000000" | bc)"

# Ticket 3: Account1, EarlyCashout mode (2), legs 1+3+4
send "$ACCOUNT1_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L1,$L3,$L4]" "[$YES,$YES,$YES]" "$STAKE_MD" 2
echo "  Ticket: account1, EarlyCashout, legs [$L1,$L3,$L4], stake \$$(echo "scale=2; $STAKE_MD / 1000000" | bc)"

# Ticket 4: Account1, Classic mode (0), legs 2+4
send "$ACCOUNT1_KEY" "$ENGINE" \
  "buyTicketWithMode(uint256[],bytes32[],uint256,uint8)" \
  "[$L2,$L4]" "[$YES,$YES]" "$STAKE_LG" 0
echo "  Ticket: account1, Classic, legs [$L2,$L4], stake \$$(echo "scale=2; $STAKE_LG / 1000000" | bc)"

# --- Summary ---
echo ""
echo "=== Seed Complete ==="
echo "Legs created:   5 (IDs $L0-$L4)"
echo "Tickets bought: 4"
echo "LP deposits:    $LP_TOTAL USDC total"
echo ""
echo "Next: start the autopilot to auto-resolve legs:"
echo "  make demo-autopilot"
echo ""
echo "Or resolve manually:"
echo "  ./scripts/demo-resolve.sh"

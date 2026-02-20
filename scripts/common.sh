#!/usr/bin/env bash
# common.sh -- Shared helpers for demo scripts.

load_network() {
  local network="$1"
  local require_account1="${2:-0}"

  if [ "$network" = "sepolia" ]; then
    RPC_URL="${BASE_SEPOLIA_RPC_URL:?Set BASE_SEPOLIA_RPC_URL}"
    DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY}"
    if [ "$require_account1" = "1" ]; then
      ACCOUNT1_KEY="${ACCOUNT1_PRIVATE_KEY:?Set ACCOUNT1_PRIVATE_KEY for Sepolia}"
    else
      ACCOUNT1_KEY="${ACCOUNT1_PRIVATE_KEY:-}"
    fi
    CHAIN_ID=84532
  else
    RPC_URL="http://127.0.0.1:8545"
    # Anvil default keys
    DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    if [ "$require_account1" = "1" ]; then
      ACCOUNT1_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    else
      ACCOUNT1_KEY=""
    fi
    CHAIN_ID=31337
  fi

  # Safety: when running in local mode, warn if a remote RPC env var is set.
  # Catches the case where a user has BASE_SEPOLIA_RPC_URL set but forgot to pass "sepolia".
  if [ "$network" = "local" ] && [ -n "${BASE_SEPOLIA_RPC_URL:-}" ]; then
    echo "WARNING: NETWORK is 'local' but BASE_SEPOLIA_RPC_URL is set in your env."
    echo "         Did you mean: $0 sepolia"
    echo "         Continuing will use Anvil default keys against localhost."
    read -rp "Continue with local? [y/N] " confirm
    [ "$confirm" = "y" ] || [ "$confirm" = "Y" ] || exit 1
  fi
}

load_broadcast() {
  : "${ROOT:?ROOT not set}"
  : "${CHAIN_ID:?CHAIN_ID not set}"

  BROADCAST="$ROOT/packages/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
  if [ ! -f "$BROADCAST" ]; then
    echo "ERROR: No broadcast at $BROADCAST. Deploy first."
    exit 1
  fi
}

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

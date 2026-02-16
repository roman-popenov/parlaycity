# ParlayCity Runbook

## Quick Start

```bash
git clone <repo>
cd hackathon
make setup
# Terminal 1:
make chain
# Terminal 2:
make deploy-local
# Terminal 3:
make dev-web
# Terminal 4 (optional):
make dev-services
```

## Common Operations

### Mint Test USDC (local)
```bash
cast send <MOCK_USDC> "mint(address,uint256)" <YOUR_ADDR> 10000000000 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Check Vault Stats
```bash
cast call <HOUSE_VAULT> "totalAssets()(uint256)" --rpc-url http://127.0.0.1:8545
cast call <HOUSE_VAULT> "totalReserved()(uint256)" --rpc-url http://127.0.0.1:8545
```

### Resolve a Leg (FAST mode)
```bash
cast send <ADMIN_ORACLE> "resolve(uint256,uint8,bytes32)" <LEG_ID> 1 0x01 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <ADMIN_KEY>
```
Status values: 0=Unresolved, 1=Won, 2=Lost, 3=Voided

### Check Ticket Status
```bash
cast call <PARLAY_ENGINE> "getTicket(uint256)" <TICKET_ID> --rpc-url http://127.0.0.1:8545
```

## Troubleshooting

### "Insufficient liquidity"
Vault doesn't have enough free USDC. Either:
- Deposit more USDC to vault
- Reduce ticket stake
- Check utilization isn't at cap

### "Cutoff passed"
Leg's betting window has closed. Create legs with future cutoff times.

### Transaction reverts with no message
- Check USDC approval: `cast call <USDC> "allowance(address,address)" <USER> <ENGINE>`
- Check USDC balance: `cast call <USDC> "balanceOf(address)" <USER>`

### Anvil reset
```bash
# Kill anvil and restart
make chain
make deploy-local
```

## Monitoring

### Services health
```bash
curl http://localhost:3001/health
```

### Exposure report
```bash
curl http://localhost:3001/exposure
```

## Emergency

### Pause all contracts
```bash
cast send <PARLAY_ENGINE> "pause()" --private-key <ADMIN_KEY> --rpc-url <RPC>
cast send <HOUSE_VAULT> "pause()" --private-key <ADMIN_KEY> --rpc-url <RPC>
```

### Unpause
```bash
cast send <PARLAY_ENGINE> "unpause()" --private-key <ADMIN_KEY> --rpc-url <RPC>
cast send <HOUSE_VAULT> "unpause()" --private-key <ADMIN_KEY> --rpc-url <RPC>
```

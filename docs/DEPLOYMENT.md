# ParlayCity Deployment Guide

## Prerequisites

- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Node.js >= 18
- pnpm >= 8
- A funded wallet on Base Sepolia (get ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

## Local Deployment (Anvil)

```bash
# 1. Setup
make setup

# 2. Start local chain (new terminal)
make chain

# 3. Deploy contracts
make deploy-local

# 4. Start web app (new terminal)
make dev-web

# 5. Start services (new terminal)
make dev-services
```

Contracts deploy to Anvil with the default key. Addresses are printed to console — copy them to `.env`.

## Base Sepolia Deployment

```bash
# 1. Set environment
cp .env.example .env
# Edit .env:
#   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
#   DEPLOYER_PRIVATE_KEY=<your-funded-key>

# 2. Deploy
make deploy-sepolia
```

The deploy script will:
1. Deploy MockUSDC (or use real USDC address if configured)
2. Deploy HouseVault
3. Deploy LegRegistry
4. Deploy AdminOracleAdapter + OptimisticOracleAdapter
5. Deploy ParlayEngine
6. Configure permissions (engine authorized on vault)
7. Create sample legs
8. Print all addresses

Copy the printed addresses into `.env` for the frontend.

## Verification

Contracts are auto-verified on BaseScan if `--verify` flag is passed and `ETHERSCAN_API_KEY` is set.

Manual verification:
```bash
forge verify-contract <address> src/core/HouseVault.sol:HouseVault \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" <usdc-address>)
```

## Frontend Deployment

```bash
cd apps/web
pnpm build
# Deploy .next/out to Vercel, Netlify, or any static host
```

Set the `NEXT_PUBLIC_*` env vars on your hosting platform.

## Post-Deploy Checklist

- [ ] All contract addresses in `.env`
- [ ] Frontend connects to Base Sepolia
- [ ] MockUSDC mint works (if using mock)
- [ ] Deposit to vault works
- [ ] Buy ticket works
- [ ] Admin can resolve legs (FAST mode)
- [ ] Claim payout works

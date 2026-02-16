# Infrastructure & Services Rules — ParlayCity

Extracted from ETHSkills: tools, orchestration, l2s, gas.

## RPC & Chain Interaction

- Use viem for all chain reads/writes. Type-safe, tree-shakeable, modern.
- Local dev: Anvil on localhost:8545, chain ID 31337.
- Base Sepolia: public RPC `https://sepolia.base.org`. QuickNode if we get an API key.
- Never poll faster than 2s for tx receipts. Use `waitForTransactionReceipt` from viem.
- Handle RPC errors gracefully: rate limits, timeouts, stale data.

## L2 Context

- Base is OP Stack. Txs post data to L1 Ethereum as calldata/blobs.
- Gas model: L2 execution gas + L1 data fee. Total cost is very low (~$0.001-0.01).
- Block time: 2 seconds. Finality: soft-confirm in 2s, L1 finality in ~12 min.
- Reorgs: extremely rare on L2 but possible. For hackathon, we treat 1 confirmation as final.

## Gas

- Base gas is cheap enough that we don't need aggressive gas optimization in contracts.
- Still: avoid storage bloat, use events for data that doesn't need on-chain reads.
- Paymaster sponsorship: if integrated, our contracts need to be in the paymaster's allowlist.

## Services Architecture

- Express.js for simplicity. Single process, multiple route groups.
- Catalog: static JSON seed data. No database for hackathon.
- Quote: deterministic computation using shared math library. Stateless.
- Hedger: in-memory exposure tracking. Simulated hedges. Stateless between restarts.
- x402: payment header check middleware. Demo mode = accept any header.

## Tooling

- Foundry (forge, anvil, cast) for all contract operations.
- pnpm workspaces for monorepo.
- tsx for running TypeScript services without build step.
- vitest for service tests.
- GitHub Actions for CI.

## Operational Rules

- All env vars in `.env.example` with safe defaults.
- No secrets in code. No hardcoded private keys (except Anvil default for local dev).
- Makefile as single entry point for all operations.
- `make setup && make dev` must work from clean checkout.

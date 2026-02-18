# Web Frontend (Next.js 14 / wagmi / viem / ConnectKit)

## Stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind 3. Wallet: wagmi 2, viem 2, ConnectKit.

## Pages

- `/` -- parlay builder
- `/vault` -- LP dashboard (deposit/withdraw/lock)
- `/tickets` -- user tickets list
- `/ticket/[id]` -- ticket detail + settle/claim

## Key Files

- `lib/config.ts` -- chain config, contract addresses from env vars, `PARLAY_CONFIG` constants
- `lib/contracts.ts` -- inline ABIs + `contractAddresses` object
- `lib/hooks.ts` -- all wagmi hooks. Write hooks: `isPending -> isConfirming -> isSuccess` pattern
- `lib/wagmi.ts` -- wagmi config via ConnectKit, supports `foundry` + `baseSepolia` chains

## Rules

- Never hardcode contract addresses. Use env + `lib/config.ts`.
- Keep wagmi hook patterns consistent (`isPending -> isConfirming -> isSuccess`).
- Protocol behavior changes must be reflected in UI labels (fees, cashout, risks).
- Polling: 5s for tickets/balances, 10s for vault stats. Stale-fetch guard via `fetchIdRef` + `inFlightRef`.

## Testing

`pnpm test` runs vitest. `npx tsc --noEmit` for typecheck. `pnpm build` for production build.

## Demo Readiness

Every key action needs a clear button:
- Buy ticket / Cash out / Settle / Claim
- Deposit / Withdraw vault
- Lock / Unlock + claim rewards

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

## Transaction Button Rules (from ethskills)

Every onchain button MUST:
1. **Disable immediately** on click
2. **Show spinner text** ("Approving...", "Depositing...")
3. **Stay disabled** until onchain confirmation (not just wallet signature)
4. **Show success/error feedback** when done

Each button gets its **own loading state**. Never share `isLoading` across buttons.

### Four-State Flow
Show exactly ONE primary button at a time:
1. Not connected -> "Connect Wallet" button (never text like "connect your wallet")
2. Wrong network -> "Switch to Base" button
3. Needs USDC approval -> "Approve USDC" button
4. Ready -> Action button ("Buy Ticket", "Deposit", etc.)

### USD Values
Every USDC amount displayed should include `(~$X.XX)` equivalent.
Input fields should show live USD preview.
USDC is 6 decimals: `parseUnits("100", 6)` not `parseEther("100")`.

## Demo Readiness

Every key action needs a clear button:
- Buy ticket / Cash out / Settle / Claim
- Deposit / Withdraw vault
- Lock / Unlock + claim rewards

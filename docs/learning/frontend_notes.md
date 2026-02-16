# Frontend Engineering Rules — ParlayCity

Extracted from ETHSkills: frontend-ux, frontend-playbook, wallets.

## Wallet Connection

- Use ConnectKit (or similar) for wallet modal. Clean, tested, handles edge cases.
- Support: MetaMask, Coinbase Wallet, WalletConnect (for mobile).
- Always show connected chain; warn if user is on wrong network.
- Auto-prompt chain switch to Base Sepolia.

## Transaction UX

1. **Approval flow**: USDC requires `approve()` before contract interaction. Show this as a clear 2-step flow: "Approve USDC" then "Buy Ticket".
2. **Loading states**: Every tx-submitting button shows: idle -> pending (wallet) -> confirming (chain) -> confirmed -> error.
3. **Gas estimation**: Show estimated gas cost before tx. On Base L2, gas is cheap — mention this.
4. **Error handling**: Catch common errors (user rejected, insufficient funds, nonce issues) with human-readable messages.
5. **Receipt**: After confirmed tx, show link to BaseScan explorer + in-app confirmation.

## Base-Specific Patterns

- Base = OP Stack L2. Txs confirm in ~2s. Show fast confirmations in UI.
- Gasless UX: if paymaster is integrated, show "gasless" badge. If not, gas is ~$0.001 — show the number.
- Smart wallet support: Base's smart wallet creates accounts without seed phrases. Great for onboarding.

## Design Rules

- Dark theme primary (bg-gray-950). Neon accents (blue, purple).
- Large multiplier numbers — this is the hero metric.
- Mobile-first responsive. Cards stack vertically on narrow screens.
- Shareable ticket receipt cards: styled as social-media-friendly images.
- Show probability + multiplier + fee breakdown transparently. No hidden math.
- "Degen" tone in copy, but serious about risk warnings.

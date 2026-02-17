# Protocol Engineering Rules — ParlayCity

Extracted from ETHSkills: standards, security, concepts, addresses.

## Standards We Follow

- **ERC-20**: USDC interaction via SafeERC20 (never raw `.transfer()`). Always check return values.
- **ERC-721**: Tickets are NFTs. Use OpenZeppelin's ERC721 base. Override `_update` for transfer hooks if needed.
- **ERC-4626**: HouseVault follows the tokenized vault pattern. Deposit/withdraw use share accounting.
- **EIP-712**: Quote signatures (if implemented) use typed structured data.

## Security Rules

1. **Reentrancy**: All external calls use ReentrancyGuard. Checks-effects-interactions pattern everywhere.
2. **SafeERC20**: All token interactions wrapped. Never assume `transfer` returns true.
3. **Overflow**: Solidity 0.8+ built-in checks. No unchecked blocks unless we prove safety.
4. **Access control**: Ownable for admin functions. Role-based (ENGINE_ROLE) for vault <-> engine calls.
5. **Pausable**: All user-facing entry points. Emergency stop for discovered vulns.
6. **Pull over push**: Winners call `claimPayout()`; we never push funds.
7. **No hardcoded addresses**: Everything injected via constructor. No `0x...` literals in contract code.
8. **No `tx.origin`**: Only `msg.sender` for auth.
9. **Timestamp dependence**: We use `block.timestamp` for cutoffs — acceptable for minute-granularity windows, not for second-precision fairness.
10. **Integer precision**: PPM (parts per million) for probabilities, BPS for fees, X1e6 for multipliers. Document units in every variable name.

## Concepts

- **Vault exposure**: `totalReserved` tracks maximum possible payout. Utilization = reserved / assets.
- **Hybrid settlement**: Mode is immutable per ticket, set at purchase time based on `bootstrapEndsAt`.
- **Oracle adapter pattern**: All settlement goes through `IOracleAdapter.getStatus()`. Swapping oracles = swapping adapter addresses.

## Address Hygiene

- Never hallucinate contract addresses. All addresses come from deploy script output or environment variables.
- USDC on Base Sepolia: use MockUSDC for dev; real USDC address only from official docs if needed.
- Deployer key in `.env.example` is Anvil's default key — NEVER use it on mainnet.

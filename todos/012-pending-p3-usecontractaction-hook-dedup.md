---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, frontend, refactor, hooks, pr-10]
dependencies: []
---

# Deduplicate Contract Write Hooks with useContractAction Helper

## Problem Statement

In `apps/web/src/lib/hooks.ts`, four hooks share ~40 lines of identical state management and transaction flow boilerplate:

- `useSettleTicket` (line 587)
- `useClaimPayout` (line 637)
- `useClaimProgressive` (line 687)
- `useCashoutEarly` (line 734)

Each follows the exact same pattern: `useState` for `isPending/isConfirming/isSuccess/error`, `writeContractAsync` -> `waitForTransactionReceipt` -> status updates, identical error handling. The only differences are the `functionName` and `args`.

## Findings

- Cursor Bugbot review on PR #10, commit `040dbeb`
- Comment ID: 2823909395
- Low severity — no functional impact, purely maintainability
- Replied acknowledging and deferring to follow-up PR

## Proposed Solution

Create a generic `useContractAction` helper that accepts `functionName` and an args factory:

```typescript
function useContractAction<TArgs extends readonly unknown[]>(
  functionName: string,
  opts?: { contract?: keyof typeof contractAddresses }
) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async (...args: TArgs): Promise<boolean> => {
    if (!publicClient) return false;
    setIsPending(true); setIsConfirming(false); setIsSuccess(false); setError(null);
    try {
      const txHash = await writeContractAsync({
        address: contractAddresses[opts?.contract ?? "parlayEngine"] as `0x${string}`,
        abi: PARLAY_ENGINE_ABI,
        functionName,
        args: [...args],
      });
      setIsPending(false); setIsConfirming(true);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "reverted") throw new Error(`${functionName} reverted on-chain`);
      setIsConfirming(false); setIsSuccess(true);
      return true;
    } catch (err) {
      console.error(`${functionName} failed:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally { setIsPending(false); setIsConfirming(false); }
  };

  return { execute, isPending, isConfirming, isSuccess, error };
}
```

Then each hook becomes a thin wrapper:

```typescript
export function useSettleTicket() {
  const { execute: settle, ...rest } = useContractAction("settleTicket");
  return { settle: (id: bigint) => settle(id), ...rest };
}
```

## Acceptance Criteria

- [ ] `useContractAction` generic helper exists in `hooks.ts`
- [ ] All four hooks (`useSettleTicket`, `useClaimPayout`, `useClaimProgressive`, `useCashoutEarly`) use the helper
- [ ] No behavioral change — each hook returns the same interface
- [ ] `make gate` passes
- [ ] TicketCard buttons still work (settle, claim, progressive, cashout)

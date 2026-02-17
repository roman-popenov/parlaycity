"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, toHex, pad } from "viem";
import {
  USDC_ABI,
  HOUSE_VAULT_ABI,
  PARLAY_ENGINE_ABI,
  LEG_REGISTRY_ABI,
  LOCK_VAULT_ABI,
  ORACLE_ADAPTER_ABI,
  contractAddresses,
} from "./contracts";

// ---- Read hooks ----

export interface LegInfo {
  question: string;
  sourceRef: string;
  cutoffTime: bigint;
  earliestResolve: bigint;
  oracleAdapter: `0x${string}`;
  probabilityPPM: bigint;
  active: boolean;
}

/** Fetches leg details from LegRegistry for an array of leg IDs */
export function useLegDescriptions(legIds: readonly bigint[]) {
  const publicClient = usePublicClient();
  const [legs, setLegs] = useState<Map<string, LegInfo>>(new Map());

  const legIdsKey = JSON.stringify(legIds.map(String));

  const fetchLegs = useCallback(async () => {
    if (!publicClient || !contractAddresses.legRegistry || legIds.length === 0) return;

    const map = new Map<string, LegInfo>();
    for (const legId of legIds) {
      const key = legId.toString();
      if (map.has(key)) continue;
      try {
        const data = await publicClient.readContract({
          address: contractAddresses.legRegistry as `0x${string}`,
          abi: LEG_REGISTRY_ABI,
          functionName: "getLeg",
          args: [legId],
        });
        map.set(key, data as LegInfo);
      } catch {
        // skip
      }
    }
    setLegs(map);
  }, [publicClient, legIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLegs();
  }, [fetchLegs]);

  return legs;
}

/** LegStatus enum values from the contract: 0=Unresolved, 1=Won, 2=Lost, 3=Voided */
export interface LegOracleResult {
  resolved: boolean;
  status: number; // 0=Unresolved, 1=Won, 2=Lost, 3=Voided
}

/** Queries each leg's oracle adapter for individual resolution status */
export function useLegStatuses(
  legIds: readonly bigint[],
  legMap: Map<string, LegInfo>,
) {
  const publicClient = usePublicClient();
  const [statuses, setStatuses] = useState<Map<string, LegOracleResult>>(new Map());

  const legIdsKey = JSON.stringify(legIds.map(String));

  const fetchStatuses = useCallback(async () => {
    if (!publicClient || legIds.length === 0 || legMap.size === 0) return;

    const map = new Map<string, LegOracleResult>();
    for (const legId of legIds) {
      const key = legId.toString();
      const leg = legMap.get(key);
      if (!leg || !leg.oracleAdapter) {
        map.set(key, { resolved: false, status: 0 });
        continue;
      }
      try {
        const data = await publicClient.readContract({
          address: leg.oracleAdapter,
          abi: ORACLE_ADAPTER_ABI,
          functionName: "getStatus",
          args: [legId],
        });
        const [status] = data as [number, `0x${string}`];
        map.set(key, { resolved: status !== 0, status });
      } catch {
        map.set(key, { resolved: false, status: 0 });
      }
    }
    setStatuses(map);
  }, [publicClient, legIdsKey, legMap.size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  return statuses;
}

export function useUSDCBalance() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContract({
    address: contractAddresses.usdc as `0x${string}`,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddresses.usdc,
      refetchInterval: 5000,
    },
  });

  return {
    balance: data as bigint | undefined,
    isLoading,
    refetch,
  };
}

export function useVaultStats() {
  const totalAssetsResult = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "totalAssets",
    query: { enabled: !!contractAddresses.houseVault, refetchInterval: 10000 },
  });

  const totalReservedResult = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "totalReserved",
    query: { enabled: !!contractAddresses.houseVault, refetchInterval: 10000 },
  });

  const maxUtilResult = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "maxUtilizationBps",
    query: { enabled: !!contractAddresses.houseVault },
  });

  const freeLiquidityResult = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "freeLiquidity",
    query: { enabled: !!contractAddresses.houseVault, refetchInterval: 10000 },
  });

  const maxPayoutResult = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "maxPayout",
    query: { enabled: !!contractAddresses.houseVault, refetchInterval: 10000 },
  });

  const totalAssets = totalAssetsResult.data as bigint | undefined;
  const totalReserved = totalReservedResult.data as bigint | undefined;
  const maxUtilBps = maxUtilResult.data as bigint | undefined;
  const freeLiquidity = freeLiquidityResult.data as bigint | undefined;
  const maxPayout = maxPayoutResult.data as bigint | undefined;

  const utilization =
    totalAssets && totalAssets > 0n && totalReserved !== undefined
      ? Number((totalReserved * 10000n) / totalAssets) / 100
      : 0;

  return {
    totalAssets,
    totalReserved,
    freeLiquidity,
    maxUtilBps,
    maxPayout,
    utilization,
    isLoading:
      totalAssetsResult.isLoading ||
      totalReservedResult.isLoading ||
      maxUtilResult.isLoading ||
      freeLiquidityResult.isLoading,
    refetch: () => {
      totalAssetsResult.refetch();
      totalReservedResult.refetch();
      maxUtilResult.refetch();
      freeLiquidityResult.refetch();
      maxPayoutResult.refetch();
    },
  };
}

export function useParlayConfig() {
  const baseFeeResult = useReadContract({
    address: contractAddresses.parlayEngine as `0x${string}`,
    abi: PARLAY_ENGINE_ABI,
    functionName: "baseFee",
    query: { enabled: !!contractAddresses.parlayEngine, refetchInterval: 10000 },
  });

  const perLegFeeResult = useReadContract({
    address: contractAddresses.parlayEngine as `0x${string}`,
    abi: PARLAY_ENGINE_ABI,
    functionName: "perLegFee",
    query: { enabled: !!contractAddresses.parlayEngine, refetchInterval: 10000 },
  });

  const minStakeResult = useReadContract({
    address: contractAddresses.parlayEngine as `0x${string}`,
    abi: PARLAY_ENGINE_ABI,
    functionName: "minStake",
    query: { enabled: !!contractAddresses.parlayEngine, refetchInterval: 10000 },
  });

  const maxLegsResult = useReadContract({
    address: contractAddresses.parlayEngine as `0x${string}`,
    abi: PARLAY_ENGINE_ABI,
    functionName: "maxLegs",
    query: { enabled: !!contractAddresses.parlayEngine, refetchInterval: 10000 },
  });

  const baseFee = baseFeeResult.data as bigint | undefined;
  const perLegFee = perLegFeeResult.data as bigint | undefined;
  const minStake = minStakeResult.data as bigint | undefined;
  const maxLegs = maxLegsResult.data as bigint | undefined;

  return {
    baseFeeBps: baseFee !== undefined ? Number(baseFee) : undefined,
    perLegFeeBps: perLegFee !== undefined ? Number(perLegFee) : undefined,
    maxLegs: maxLegs !== undefined ? Number(maxLegs) : undefined,
    minStakeUSDC: minStake !== undefined ? Number(minStake) / 1e6 : undefined,
    isLoading:
      baseFeeResult.isLoading ||
      perLegFeeResult.isLoading ||
      minStakeResult.isLoading ||
      maxLegsResult.isLoading,
    refetch: () => {
      baseFeeResult.refetch();
      perLegFeeResult.refetch();
      minStakeResult.refetch();
      maxLegsResult.refetch();
    },
  };
}

export interface OnChainTicket {
  buyer: `0x${string}`;
  stake: bigint;
  legIds: readonly bigint[];
  outcomes: readonly `0x${string}`[];
  multiplierX1e6: bigint;
  potentialPayout: bigint;
  feePaid: bigint;
  mode: number;
  status: number;
  createdAt: bigint;
}

export function useTicket(ticketId: bigint | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: contractAddresses.parlayEngine as `0x${string}`,
    abi: PARLAY_ENGINE_ABI,
    functionName: "getTicket",
    args: ticketId !== undefined ? [ticketId] : undefined,
    query: {
      enabled: ticketId !== undefined && !!contractAddresses.parlayEngine,
      refetchInterval: 5000,
    },
  });

  return {
    ticket: data as OnChainTicket | undefined,
    isLoading,
    refetch,
  };
}

export function useUserTickets() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [tickets, setTickets] = useState<{ id: bigint; ticket: OnChainTicket }[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!address || !publicClient || !contractAddresses.parlayEngine) {
      ++fetchIdRef.current;
      inFlightRef.current = false;
      setTickets([]);
      setTotalCount(0);
      setIsLoading(false);
      hasFetchedRef.current = false;
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const localFetchId = ++fetchIdRef.current;

    // Only show loading spinner on first fetch, not on polls
    if (!hasFetchedRef.current) setIsLoading(true);

    try {
      const count = await publicClient.readContract({
        address: contractAddresses.parlayEngine as `0x${string}`,
        abi: PARLAY_ENGINE_ABI,
        functionName: "ticketCount",
      });

      if (localFetchId !== fetchIdRef.current) return;

      const total = Number(count as bigint);
      setTotalCount(total);
      const userTickets: { id: bigint; ticket: OnChainTicket }[] = [];

      for (let i = 0; i < total; i++) {
        if (localFetchId !== fetchIdRef.current) return;
        try {
          const owner = await publicClient.readContract({
            address: contractAddresses.parlayEngine as `0x${string}`,
            abi: PARLAY_ENGINE_ABI,
            functionName: "ownerOf",
            args: [BigInt(i)],
          });

          if ((owner as string).toLowerCase() === address.toLowerCase()) {
            const ticket = await publicClient.readContract({
              address: contractAddresses.parlayEngine as `0x${string}`,
              abi: PARLAY_ENGINE_ABI,
              functionName: "getTicket",
              args: [BigInt(i)],
            });
            userTickets.push({ id: BigInt(i), ticket: ticket as OnChainTicket });
          }
        } catch (innerErr) {
          console.error(`Failed to fetch ticket #${i}:`, innerErr);
        }
      }

      if (localFetchId !== fetchIdRef.current) return;
      setTickets(userTickets);
      setError(null);
    } catch (err) {
      if (localFetchId !== fetchIdRef.current) return;
      console.error("Failed to fetch tickets:", err);
      setError(String(err));
    } finally {
      if (localFetchId === fetchIdRef.current) {
        inFlightRef.current = false;
        setIsLoading(false);
        hasFetchedRef.current = true;
      }
    }
  }, [address, publicClient]);

  // Fetch on mount and poll every 5 seconds
  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 5000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  return { tickets, totalCount, isLoading, error, refetch: fetchTickets };
}

// ---- Write hooks ----

export function useBuyTicket() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resetSuccess = () => {
    setIsSuccess(false);
    setError(null);
  };

  const buyTicket = async (
    legIds: bigint[],
    outcomes: number[],
    stakeUsdc: number
  ): Promise<boolean> => {
    if (!address || !publicClient) return false;

    setIsPending(true);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);

    try {
      const stakeAmount = parseUnits(stakeUsdc.toString(), 6);

      // Approve exact amount
      const approveHash = await writeContractAsync({
        address: contractAddresses.usdc as `0x${string}`,
        abi: USDC_ABI,
        functionName: "approve",
        args: [contractAddresses.parlayEngine as `0x${string}`, stakeAmount],
      });
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approveReceipt.status === "reverted") {
        throw new Error("Approve transaction reverted on-chain");
      }

      // Encode outcomes as bytes32[]
      const outcomesBytes32 = outcomes.map((o) => pad(toHex(o), { size: 32 })) as `0x${string}`[];

      // Buy ticket
      setIsPending(false);
      setIsConfirming(true);
      const buyHash = await writeContractAsync({
        address: contractAddresses.parlayEngine as `0x${string}`,
        abi: PARLAY_ENGINE_ABI,
        functionName: "buyTicket",
        args: [legIds, outcomesBytes32, stakeAmount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain");
      }

      setIsConfirming(false);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Buy ticket failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  return {
    buyTicket,
    resetSuccess,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useDepositVault() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deposit = async (amountUsdc: number): Promise<boolean> => {
    if (!address || !publicClient) return false;

    setIsPending(true);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);

    try {
      const amount = parseUnits(amountUsdc.toString(), 6);

      // Approve exact amount
      const approveHash = await writeContractAsync({
        address: contractAddresses.usdc as `0x${string}`,
        abi: USDC_ABI,
        functionName: "approve",
        args: [contractAddresses.houseVault as `0x${string}`, amount],
      });
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approveReceipt.status === "reverted") {
        throw new Error("Approve transaction reverted on-chain");
      }

      // Deposit into vault
      setIsPending(false);
      setIsConfirming(true);
      const depositHash = await writeContractAsync({
        address: contractAddresses.houseVault as `0x${string}`,
        abi: HOUSE_VAULT_ABI,
        functionName: "deposit",
        args: [amount, address],
      });
      const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
      if (depositReceipt.status === "reverted") {
        throw new Error("Deposit transaction reverted on-chain");
      }

      setIsConfirming(false);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Deposit failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  const resetSuccess = () => { setIsSuccess(false); setError(null); };

  return { deposit, resetSuccess, isPending, isConfirming, isSuccess, error };
}

export function useWithdrawVault() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withdraw = async (amountUsdc: number): Promise<boolean> => {
    if (!address || !publicClient) return false;

    setIsPending(true);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);

    try {
      const amount = parseUnits(amountUsdc.toString(), 6);

      setIsPending(false);
      setIsConfirming(true);
      const withdrawHash = await writeContractAsync({
        address: contractAddresses.houseVault as `0x${string}`,
        abi: HOUSE_VAULT_ABI,
        functionName: "withdraw",
        args: [amount, address],
      });
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
      if (withdrawReceipt.status === "reverted") {
        throw new Error("Withdraw transaction reverted on-chain");
      }

      setIsConfirming(false);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Withdraw failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  const resetSuccess = () => { setIsSuccess(false); setError(null); };

  return { withdraw, resetSuccess, isPending, isConfirming, isSuccess, error };
}

export function useSettleTicket() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const settle = async (ticketId: bigint): Promise<boolean> => {
    if (!publicClient) return false;

    setIsPending(true);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);
    setHash(undefined);

    try {
      const txHash = await writeContractAsync({
        address: contractAddresses.parlayEngine as `0x${string}`,
        abi: PARLAY_ENGINE_ABI,
        functionName: "settleTicket",
        args: [ticketId],
      });
      setHash(txHash);

      setIsPending(false);
      setIsConfirming(true);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "reverted") {
        throw new Error("Settle transaction reverted on-chain");
      }

      setIsConfirming(false);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Settle ticket failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  return { settle, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimPayout() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claim = async (ticketId: bigint): Promise<boolean> => {
    if (!publicClient) return false;

    setIsPending(true);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);
    setHash(undefined);

    try {
      const txHash = await writeContractAsync({
        address: contractAddresses.parlayEngine as `0x${string}`,
        abi: PARLAY_ENGINE_ABI,
        functionName: "claimPayout",
        args: [ticketId],
      });
      setHash(txHash);

      setIsPending(false);
      setIsConfirming(true);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "reverted") {
        throw new Error("Claim payout transaction reverted on-chain");
      }

      setIsConfirming(false);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Claim payout failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

// ---- Lock Vault hooks ----

export interface LockPosition {
  owner: `0x${string}`;
  shares: bigint;
  tier: number;
  lockedAt: bigint;
  unlockAt: bigint;
  feeMultiplierBps: bigint;
  rewardDebt: bigint;
}

export function useLockVault() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lock = async (shares: bigint, tier: number): Promise<boolean> => {
    if (!address || !publicClient || !contractAddresses.lockVault) return false;

    setIsPending(true);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);

    try {
      // Approve exact vUSDC transfer to lockVault
      const approveHash = await writeContractAsync({
        address: contractAddresses.houseVault as `0x${string}`,
        abi: USDC_ABI,
        functionName: "approve",
        args: [contractAddresses.lockVault as `0x${string}`, shares],
      });
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approveReceipt.status === "reverted") {
        throw new Error("Approve transaction reverted on-chain");
      }

      // Lock shares
      setIsPending(false);
      setIsConfirming(true);
      const lockHash = await writeContractAsync({
        address: contractAddresses.lockVault as `0x${string}`,
        abi: LOCK_VAULT_ABI,
        functionName: "lock",
        args: [shares, tier],
      });
      const lockReceipt = await publicClient.waitForTransactionReceipt({ hash: lockHash });
      if (lockReceipt.status === "reverted") {
        throw new Error("Lock transaction reverted on-chain");
      }

      setIsConfirming(false);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Lock failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  return { lock, isPending, isConfirming, isSuccess, error };
}

export function useUnlockVault() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unlock = async (positionId: bigint) => {
    if (!publicClient || !contractAddresses.lockVault) return;

    setIsPending(true);
    setIsSuccess(false);
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: contractAddresses.lockVault as `0x${string}`,
        abi: LOCK_VAULT_ABI,
        functionName: "unlock",
        args: [positionId],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Unlock transaction reverted on-chain");
      }
      setIsSuccess(true);
    } catch (err) {
      console.error("Unlock failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  };

  return { unlock, isPending, isSuccess, error };
}

export function useEarlyWithdraw() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const earlyWithdraw = async (positionId: bigint) => {
    if (!publicClient || !contractAddresses.lockVault) return;

    setIsPending(true);
    setIsSuccess(false);
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: contractAddresses.lockVault as `0x${string}`,
        abi: LOCK_VAULT_ABI,
        functionName: "earlyWithdraw",
        args: [positionId],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Early withdraw transaction reverted on-chain");
      }
      setIsSuccess(true);
    } catch (err) {
      console.error("Early withdraw failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  };

  return { earlyWithdraw, isPending, isSuccess, error };
}

export function useLockPositions() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [positions, setPositions] = useState<{ id: bigint; position: LockPosition }[]>([]);
  const [userTotalLocked, setUserTotalLocked] = useState(0n);
  const [isLoading, setIsLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const fetchPositions = useCallback(async () => {
    if (!address || !publicClient || !contractAddresses.lockVault) {
      ++fetchIdRef.current;
      inFlightRef.current = false;
      setPositions([]);
      setUserTotalLocked(0n);
      setIsLoading(false);
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const localFetchId = ++fetchIdRef.current;

    try {
      const nextId = await publicClient.readContract({
        address: contractAddresses.lockVault as `0x${string}`,
        abi: LOCK_VAULT_ABI,
        functionName: "nextPositionId",
      });

      if (localFetchId !== fetchIdRef.current) return;

      const total = Number(nextId as bigint);
      const userPositions: { id: bigint; position: LockPosition }[] = [];

      for (let i = 0; i < total; i++) {
        if (localFetchId !== fetchIdRef.current) return;
        try {
          const data = await publicClient.readContract({
            address: contractAddresses.lockVault as `0x${string}`,
            abi: LOCK_VAULT_ABI,
            functionName: "positions",
            args: [BigInt(i)],
          });

          const pos = data as [string, bigint, number, bigint, bigint, bigint, bigint];
          if (pos[0].toLowerCase() === address.toLowerCase() && pos[1] > 0n) {
            userPositions.push({
              id: BigInt(i),
              position: {
                owner: pos[0] as `0x${string}`,
                shares: pos[1],
                tier: pos[2],
                lockedAt: pos[3],
                unlockAt: pos[4],
                feeMultiplierBps: pos[5],
                rewardDebt: pos[6],
              },
            });
          }
        } catch {
          // skip
        }
      }

      if (localFetchId !== fetchIdRef.current) return;
      setPositions(userPositions);
      setUserTotalLocked(userPositions.reduce((sum, { position }) => sum + position.shares, 0n));
    } catch (err) {
      if (localFetchId !== fetchIdRef.current) return;
      console.error("Failed to fetch lock positions:", err);
    } finally {
      if (localFetchId === fetchIdRef.current) {
        inFlightRef.current = false;
        setIsLoading(false);
      }
    }
  }, [address, publicClient]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return { positions, userTotalLocked, isLoading, refetch: fetchPositions };
}

export function useLockStats() {
  const totalLockedResult = useReadContract({
    address: contractAddresses.lockVault as `0x${string}`,
    abi: LOCK_VAULT_ABI,
    functionName: "totalLockedShares",
    query: { enabled: !!contractAddresses.lockVault, refetchInterval: 10000 },
  });

  const { address } = useAccount();
  const pendingRewardsResult = useReadContract({
    address: contractAddresses.lockVault as `0x${string}`,
    abi: LOCK_VAULT_ABI,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddresses.lockVault, refetchInterval: 10000 },
  });

  return {
    totalLocked: totalLockedResult.data as bigint | undefined,
    pendingRewards: pendingRewardsResult.data as bigint | undefined,
    isLoading: totalLockedResult.isLoading,
    refetch: () => {
      totalLockedResult.refetch();
      pendingRewardsResult.refetch();
    },
  };
}

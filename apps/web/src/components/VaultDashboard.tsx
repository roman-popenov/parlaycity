"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  useVaultStats,
  useDepositVault,
  useWithdrawVault,
  useUSDCBalance,
  useLockVault,
  useUnlockVault,
  useEarlyWithdraw,
  useLockPositions,
  useLockStats,
} from "@/lib/hooks";
import { useReadContract } from "wagmi";
import { HOUSE_VAULT_ABI, contractAddresses } from "@/lib/contracts";

function formatUSDC(amount: bigint | undefined): string {
  if (amount === undefined) return "---";
  return Number(formatUnits(amount, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TIER_LABELS = ["30 Days (1.1x)", "60 Days (1.25x)", "90 Days (1.5x)"];
const TIER_MULTIPLIERS = ["1.1x", "1.25x", "1.5x"];

type Tab = "deposit" | "withdraw" | "lock";

export function VaultDashboard() {
  const { address, isConnected } = useAccount();
  const vaultStats = useVaultStats();
  const { balance: usdcBalance } = useUSDCBalance();
  const depositHook = useDepositVault();
  const withdrawHook = useWithdrawVault();
  const lockHook = useLockVault();
  const unlockHook = useUnlockVault();
  const earlyWithdrawHook = useEarlyWithdraw();
  const { positions, userTotalLocked, refetch: refetchPositions } = useLockPositions();
  const lockStats = useLockStats();

  const [tab, setTab] = useState<Tab>("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [lockAmount, setLockAmount] = useState("");
  const [lockTier, setLockTier] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // User's vault share balance
  const { data: userShares } = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddresses.houseVault, refetchInterval: 5000 },
  });

  const { data: sharesValue } = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "convertToAssets",
    args: userShares ? [userShares as bigint] : undefined,
    query: { enabled: !!userShares && (userShares as bigint) > 0n, refetchInterval: 5000 },
  });

  const userSharesBigInt = (userShares as bigint) ?? 0n;
  const userSharesValueBigInt = (sharesValue as bigint) ?? 0n;
  const hasShares = userSharesBigInt > 0n;

  const totalAssets = vaultStats.totalAssets ?? 0n;
  const totalReserved = vaultStats.totalReserved ?? 0n;
  const utilization = vaultStats.totalAssets ? vaultStats.utilization : 0;
  const freeLiquidity = vaultStats.freeLiquidity ?? 0n;

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    await depositHook.deposit(amount);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;
    if (!hasShares) return;
    await withdrawHook.withdraw(amount);
  };

  const handleLock = async () => {
    const amount = parseFloat(lockAmount);
    if (!amount || amount <= 0) return;
    const shares = parseUnits(amount.toString(), 6);
    await lockHook.lock(shares, lockTier);
    setLockAmount("");
    await refetchPositions();
    lockStats.refetch();
  };

  const handleUnlock = async (positionId: bigint) => {
    await unlockHook.unlock(positionId);
    refetchPositions();
  };

  const handleEarlyWithdraw = async (positionId: bigint) => {
    await earlyWithdrawHook.earlyWithdraw(positionId);
    refetchPositions();
  };

  const depositTxSuccess = depositHook.isSuccess && !depositHook.error;
  const withdrawTxSuccess = withdrawHook.isSuccess && !withdrawHook.error;

  const hasUSDC = (usdcBalance ?? 0n) > 0n;

  const safeParse = (val: string): bigint => {
    try { return val && parseFloat(val) > 0 ? parseUnits(val, 6) : 0n; } catch { return 0n; }
  };
  const depositAmountBigInt = safeParse(depositAmount);
  const withdrawAmountBigInt = safeParse(withdrawAmount);
  const lockAmountBigInt = safeParse(lockAmount);
  const depositExceedsBalance = depositAmountBigInt > 0n && depositAmountBigInt > (usdcBalance ?? 0n);
  const withdrawExceedsShares = withdrawAmountBigInt > 0n && withdrawAmountBigInt > userSharesBigInt;
  const lockExceedsShares = lockAmountBigInt > 0n && lockAmountBigInt > userSharesBigInt;

  return (
    <div className="space-y-8">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total TVL" value={`$${formatUSDC(totalAssets)}`} accent="blue" />
        <StatCard label="Utilization" value={`${utilization.toFixed(1)}%`} accent="purple" />
        <StatCard label="Free Liquidity" value={`$${formatUSDC(freeLiquidity)}`} accent="green" />
        <StatCard
          label="Your Position"
          value={hasShares ? `$${formatUSDC(userSharesValueBigInt)}` : "$0.00"}
          accent="blue"
        />
      </div>

      {/* Your position detail */}
      {mounted && isConnected && (
        <div className="rounded-xl border border-white/5 bg-gray-900/50 p-6">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
            Your Vault Position
          </h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Vault Shares</p>
              <p className="text-lg font-semibold text-white">{formatUSDC(userSharesBigInt)} vUSDC</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Value</p>
              <p className="text-lg font-semibold text-neon-green">${formatUSDC(userSharesValueBigInt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">USDC Balance</p>
              <p className="text-lg font-semibold text-white">${formatUSDC(usdcBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Locked Shares</p>
              <p className="text-lg font-semibold text-accent-purple">
                {formatUSDC(userTotalLocked)} vUSDC
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Utilization bar */}
      <div className="rounded-xl border border-white/5 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Vault Utilization
        </h3>
        <div className="relative h-6 overflow-hidden rounded-full bg-gray-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-blue to-accent-purple transition-all duration-700"
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
            {utilization.toFixed(1)}% utilized
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>Max 80%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        {(["deposit", "withdraw", "lock"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === t
                ? "bg-accent-blue/20 text-accent-blue"
                : "text-gray-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "deposit" && (
        <div className="rounded-xl border border-white/5 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Deposit</h3>
          <p className="mb-4 text-sm text-gray-400">
            Deposit USDC to earn yield from parlay fees and losses.
          </p>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>Available USDC</span>
            <span className="font-semibold text-white">{formatUSDC(usdcBalance)}</span>
          </div>
          <div className="relative mb-4">
            <input
              type="number"
              min="1"
              step="1"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount (USDC)"
              disabled={!hasUSDC}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-16 text-white placeholder-gray-600 outline-none transition-colors focus:border-accent-blue/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {hasUSDC && (
              <button
                onClick={() => setDepositAmount(formatUnits(usdcBalance!, 6))}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-accent-blue/20 px-2 py-1 text-xs font-semibold text-accent-blue transition-colors hover:bg-accent-blue/30"
              >
                Max
              </button>
            )}
          </div>
          {depositExceedsBalance && (
            <p className="mb-2 text-center text-xs text-neon-red">Exceeds your USDC balance</p>
          )}
          <button
            onClick={handleDeposit}
            disabled={!isConnected || !hasUSDC || !depositAmount || depositExceedsBalance || depositHook.isPending || depositHook.isConfirming}
            className="w-full rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:shadow-lg hover:shadow-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!isConnected
              ? "Connect Wallet"
              : !hasUSDC
                ? "No USDC Balance"
                : depositExceedsBalance
                  ? "Insufficient Balance"
                  : depositHook.isPending
                    ? "Signing..."
                    : depositHook.isConfirming
                      ? "Confirming..."
                      : depositTxSuccess
                        ? "Deposited!"
                        : "Deposit"}
          </button>
          {depositHook.error && (
            <p className="mt-2 rounded-lg bg-neon-red/10 px-3 py-2 text-center text-xs text-neon-red">
              {depositHook.error.message.length > 120
                ? depositHook.error.message.slice(0, 120) + "..."
                : depositHook.error.message}
            </p>
          )}
        </div>
      )}

      {tab === "withdraw" && (
        <div className="rounded-xl border border-white/5 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Withdraw</h3>
          <p className="mb-4 text-sm text-gray-400">
            {hasShares
              ? "Withdraw your USDC. Subject to available (unreserved) liquidity."
              : "You have no vault shares to withdraw."}
          </p>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>Available Shares</span>
            <span className="font-semibold text-white">{formatUSDC(userSharesBigInt)} vUSDC</span>
          </div>
          <div className="relative mb-4">
            <input
              type="number"
              min="1"
              step="1"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Shares (vUSDC)"
              disabled={!hasShares}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-16 text-white placeholder-gray-600 outline-none transition-colors focus:border-accent-blue/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {hasShares && (
              <button
                onClick={() => setWithdrawAmount(formatUnits(userSharesBigInt, 6))}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-accent-blue/20 px-2 py-1 text-xs font-semibold text-accent-blue transition-colors hover:bg-accent-blue/30"
              >
                Max
              </button>
            )}
          </div>
          {withdrawExceedsShares && (
            <p className="mb-2 text-center text-xs text-neon-red">Exceeds your vault shares</p>
          )}
          <button
            onClick={handleWithdraw}
            disabled={!isConnected || !hasShares || !withdrawAmount || withdrawExceedsShares || withdrawHook.isPending || withdrawHook.isConfirming}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!isConnected
              ? "Connect Wallet"
              : !hasShares
                ? "No Shares"
                : withdrawExceedsShares
                  ? "Insufficient Shares"
                  : withdrawHook.isPending
                    ? "Signing..."
                    : withdrawHook.isConfirming
                      ? "Confirming..."
                      : withdrawTxSuccess
                        ? "Withdrawn!"
                        : "Withdraw"}
          </button>
          {withdrawHook.error && (
            <p className="mt-2 rounded-lg bg-neon-red/10 px-3 py-2 text-center text-xs text-neon-red">
              {withdrawHook.error.message.length > 120
                ? withdrawHook.error.message.slice(0, 120) + "..."
                : withdrawHook.error.message}
            </p>
          )}
        </div>
      )}

      {tab === "lock" && (
        <div className="space-y-6">
          {/* Lock form */}
          <div className="rounded-xl border border-white/5 bg-gray-900/50 p-6">
            <h3 className="mb-2 text-lg font-semibold text-white">Lock vUSDC Shares</h3>
            <p className="mb-4 text-sm text-gray-400">
              Lock your vault shares for a fixed period to earn boosted fee share.
              Longer locks get higher multipliers.
            </p>

            {/* Available shares */}
            <div className="mb-4 rounded-lg bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Available vUSDC Shares</span>
                <span className="text-lg font-bold text-white">
                  {formatUSDC(userSharesBigInt)}
                </span>
              </div>
              {hasShares && (
                <p className="mt-1 text-xs text-gray-500">
                  Worth ${formatUSDC(userSharesValueBigInt)} USDC
                </p>
              )}
              {!hasShares && mounted && isConnected && (
                <p className="mt-1 text-xs text-yellow-400">
                  Deposit USDC first to get vault shares, then you can lock them here.
                </p>
              )}
              {!hasShares && mounted && !isConnected && (
                <p className="mt-1 text-xs text-gray-500">
                  Connect your wallet to see your shares.
                </p>
              )}
            </div>

            {/* Tier selector */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {TIER_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setLockTier(i)}
                  className={`rounded-lg border px-3 py-3 text-center text-xs font-semibold transition-all ${
                    lockTier === i
                      ? "border-accent-purple/50 bg-accent-purple/10 text-accent-purple"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                  }`}
                >
                  <div>{label.split(" (")[0]}</div>
                  <div className="mt-1 text-sm font-bold">{TIER_MULTIPLIERS[i]}</div>
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <input
                type="number"
                min="1"
                step="1"
                value={lockAmount}
                onChange={(e) => setLockAmount(e.target.value)}
                placeholder="vUSDC shares to lock"
                disabled={!hasShares}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-16 text-white placeholder-gray-600 outline-none transition-colors focus:border-accent-purple/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {hasShares && (
                <button
                  onClick={() => setLockAmount(formatUnits(userSharesBigInt, 6))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-accent-purple/20 px-2 py-1 text-xs font-semibold text-accent-purple transition-colors hover:bg-accent-purple/30"
                >
                  Max
                </button>
              )}
            </div>

            {lockExceedsShares && (
              <p className="mb-2 text-center text-xs text-neon-red">Exceeds your vault shares</p>
            )}
            <button
              onClick={handleLock}
              disabled={!isConnected || !hasShares || !lockAmount || lockExceedsShares || lockHook.isPending || lockHook.isConfirming}
              className="w-full rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:shadow-lg hover:shadow-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!isConnected
                ? "Connect Wallet"
                : !hasShares
                  ? "Deposit USDC First"
                  : lockExceedsShares
                    ? "Insufficient Shares"
                    : lockHook.isPending
                      ? "Signing..."
                      : lockHook.isConfirming
                        ? "Confirming..."
                        : lockHook.isSuccess
                          ? "Locked!"
                          : "Lock Shares"}
            </button>
            {lockHook.error && (
              <p className="mt-2 rounded-lg bg-neon-red/10 px-3 py-2 text-center text-xs text-neon-red">
                {lockHook.error.message.length > 120
                  ? lockHook.error.message.slice(0, 120) + "..."
                  : lockHook.error.message}
              </p>
            )}
          </div>

          {/* Existing positions */}
          {positions.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-gray-900/50 p-6">
              <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
                Your Lock Positions
              </h3>
              <div className="space-y-3">
                {positions.map(({ id, position }) => {
                  const now = Math.floor(Date.now() / 1000);
                  const matured = now >= Number(position.unlockAt);
                  const daysLeft = matured
                    ? 0
                    : Math.ceil((Number(position.unlockAt) - now) / 86400);

                  return (
                    <div
                      key={id.toString()}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {formatUSDC(position.shares)} vUSDC
                        </p>
                        <p className="text-xs text-gray-500">
                          {TIER_MULTIPLIERS[position.tier]} fee boost
                          {matured ? " -- Matured" : ` -- ${daysLeft}d left`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {matured ? (
                          <button
                            onClick={() => handleUnlock(id)}
                            disabled={unlockHook.isPending}
                            className="rounded-lg bg-neon-green/20 px-3 py-1.5 text-xs font-semibold text-neon-green transition-all hover:bg-neon-green/30 disabled:opacity-50"
                          >
                            {unlockHook.isPending ? "..." : "Unlock"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEarlyWithdraw(id)}
                            disabled={earlyWithdrawHook.isPending}
                            className="rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-all hover:bg-yellow-500/30 disabled:opacity-50"
                          >
                            {earlyWithdrawHook.isPending ? "..." : "Early Exit"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending rewards */}
          {lockStats.pendingRewards && lockStats.pendingRewards > 0n && (
            <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4 text-center">
              <p className="text-sm text-gray-400">Pending Fee Rewards</p>
              <p className="text-xl font-bold text-neon-green">
                ${formatUSDC(lockStats.pendingRewards)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "purple" | "green";
}) {
  const colors = {
    blue: "from-accent-blue/20 to-transparent border-accent-blue/20",
    purple: "from-accent-purple/20 to-transparent border-accent-purple/20",
    green: "from-neon-green/20 to-transparent border-neon-green/20",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-6 ${colors[accent]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

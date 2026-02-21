"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { sanitizeNumericInput, blockNonNumericKeys } from "@/lib/utils";
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
  useMintTestUSDC,
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
  const mintHook = useMintTestUSDC();

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
    query: { enabled: !!address && !!contractAddresses.houseVault, refetchInterval: 10_000 },
  });

  const { data: sharesValue } = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "convertToAssets",
    args: userShares ? [userShares as bigint] : undefined,
    query: { enabled: !!userShares && (userShares as bigint) > 0n, refetchInterval: 10_000 },
  });

  const userSharesBigInt = (userShares as bigint) ?? 0n;
  const userSharesValueBigInt = (sharesValue as bigint) ?? 0n;

  // Convert locked shares to asset value
  const { data: lockedValue } = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "convertToAssets",
    args: userTotalLocked ? [userTotalLocked] : undefined,
    query: { enabled: !!userTotalLocked && userTotalLocked > 0n, refetchInterval: 10_000 },
  });
  const lockedValueBigInt = (lockedValue as bigint) ?? 0n;
  const totalPositionValue = userSharesValueBigInt + lockedValueBigInt;

  const hasShares = userSharesBigInt > 0n;

  const totalAssets = vaultStats.totalAssets ?? 0n;
  const totalReserved = vaultStats.totalReserved ?? 0n;
  const utilization = vaultStats.totalAssets ? vaultStats.utilization : 0;
  const freeLiquidity = vaultStats.freeLiquidity ?? 0n;

  // Cap withdrawable shares to what free liquidity can cover
  const withdrawableShares = userSharesValueBigInt > 0n && userSharesValueBigInt > freeLiquidity
    ? (userSharesBigInt * freeLiquidity) / userSharesValueBigInt
    : userSharesBigInt;

  const setDepositAmountAndReset = (val: string) => {
    depositHook.resetSuccess();
    setDepositAmount(val);
  };

  const setWithdrawAmountAndReset = (val: string) => {
    withdrawHook.resetSuccess();
    setWithdrawAmount(val);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 1) return;
    const success = await depositHook.deposit(amount);
    if (success) setDepositAmount("");
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;
    if (!hasShares) return;
    const success = await withdrawHook.withdraw(amount);
    if (success) setWithdrawAmount("");
  };

  const handleLock = async () => {
    const amount = parseFloat(lockAmount);
    if (!amount || amount <= 0) return;
    const shares = parseUnits(amount.toString(), 6);
    const success = await lockHook.lock(shares, lockTier);
    if (success) {
      setLockAmount("");
      await refetchPositions();
      lockStats.refetch();
    }
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
  const depositParsed = depositAmount ? parseFloat(depositAmount) : NaN;
  const depositBelowMinimum = depositAmount !== "" && !isNaN(depositParsed) && depositParsed >= 0 && depositAmountBigInt < 1_000_000n;
  const depositNegative = depositAmount !== "" && !isNaN(depositParsed) && depositParsed < 0;
  const depositExceedsBalance = depositAmountBigInt > 0n && !depositBelowMinimum && depositAmountBigInt > (usdcBalance ?? 0n);
  const withdrawParsed = withdrawAmount ? parseFloat(withdrawAmount) : NaN;
  const withdrawBelowMinimum = withdrawAmount !== "" && !isNaN(withdrawParsed) && withdrawParsed > 0 && withdrawAmountBigInt === 0n;
  const withdrawExceedsShares = withdrawAmountBigInt > 0n && withdrawAmountBigInt > userSharesBigInt;
  const withdrawExceedsLiquidity = withdrawAmountBigInt > 0n && !withdrawExceedsShares && withdrawAmountBigInt > withdrawableShares;
  const lockParsed = lockAmount ? parseFloat(lockAmount) : NaN;
  const lockBelowMinimum = lockAmount !== "" && !isNaN(lockParsed) && lockParsed >= 0 && lockAmountBigInt < 1_000_000n;
  const lockExceedsShares = lockAmountBigInt > 0n && lockAmountBigInt > userSharesBigInt;
  // Guard: "." or other non-numeric strings parse to NaN — disable buttons
  const depositNotANumber = depositAmount !== "" && isNaN(depositParsed);
  const withdrawNotANumber = withdrawAmount !== "" && isNaN(withdrawParsed);
  const lockNotANumber = lockAmount !== "" && isNaN(lockParsed);

  // Post-withdrawal utilization warning (convert shares to assets for correct unit basis)
  const withdrawAmountAssets = userSharesBigInt > 0n
    ? (withdrawAmountBigInt * userSharesValueBigInt) / userSharesBigInt
    : 0n;
  const postWithdrawUtil = (() => {
    if (withdrawAmountAssets <= 0n || totalAssets <= 0n || totalReserved <= 0n) return 0;
    const remaining = totalAssets > withdrawAmountAssets ? totalAssets - withdrawAmountAssets : 0n;
    if (remaining === 0n) return 100;
    return Number((totalReserved * 10000n) / remaining) / 100;
  })();
  const withdrawHighUtilWarning = withdrawAmountBigInt > 0n && !withdrawExceedsShares && !withdrawExceedsLiquidity && postWithdrawUtil > 80;

  // Priority order: wallet > prerequisite > tx state > input validation > default
  function depositButtonLabel(): string {
    if (!isConnected) return "Connect Wallet";
    if (!hasUSDC) return "No USDC Balance";
    if (depositHook.isPending) return "Signing...";
    if (depositHook.isConfirming) return "Confirming...";
    if (depositTxSuccess) return "Deposited!";
    if (depositNegative) return "Invalid Amount";
    if (depositBelowMinimum) return "Minimum 1 USDC";
    if (depositExceedsBalance) return "Insufficient Balance";
    return "Deposit";
  }

  function withdrawButtonLabel(): string {
    if (!isConnected) return "Connect Wallet";
    if (!hasShares) return "No Shares";
    if (withdrawHook.isPending) return "Signing...";
    if (withdrawHook.isConfirming) return "Confirming...";
    if (withdrawTxSuccess) return "Withdrawn!";
    if (withdrawBelowMinimum) return "Amount Too Small";
    if (withdrawExceedsShares) return "Insufficient Shares";
    if (withdrawExceedsLiquidity) return "Insufficient Liquidity";
    return "Withdraw";
  }

  function lockButtonLabel(): string {
    if (!isConnected) return "Connect Wallet";
    if (!hasShares) return "Deposit USDC First";
    if (lockHook.isPending) return "Signing...";
    if (lockHook.isConfirming) return "Confirming...";
    if (lockHook.isSuccess) return "Locked!";
    if (lockBelowMinimum) return "Minimum 1 vUSDC";
    if (lockExceedsShares) return "Insufficient Shares";
    return "Lock Shares";
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Left column: Stats + Position + Utilization + Mechanics */}
      <div className="space-y-6">
        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Total TVL" value={`$${formatUSDC(totalAssets)}`} accent="pink" />
          <StatCard label="Utilization" value={`${utilization.toFixed(1)}%`} accent="purple" />
          <StatCard label="Free Liquidity" value={`$${formatUSDC(freeLiquidity)}`} accent="green" />
          <StatCard
            label="Your Position"
            value={totalPositionValue > 0n ? `$${formatUSDC(totalPositionValue)}` : "$0.00"}
            accent="gold"
          />
        </div>

        {/* Your position detail */}
        {mounted && isConnected && (
          <div className="glass-card p-6">
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
              Your Vault Position
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Vault Shares</p>
                <p className="text-lg font-semibold text-white">{formatUSDC(userSharesBigInt)} vUSDC</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Value</p>
                <p className="text-lg font-semibold text-neon-green">${formatUSDC(userSharesValueBigInt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Locked Shares</p>
                <p className="text-lg font-semibold text-brand-purple-1">
                  {formatUSDC(userTotalLocked)} vUSDC
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Utilization bar */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
            Vault Utilization
          </h3>
          <div className="relative h-6 overflow-hidden rounded-full bg-gray-800">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple transition-all duration-700"
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
            {/* 80% cap marker */}
            <div
              className="absolute inset-y-0 border-l-2 border-dashed border-yellow-400/50"
              style={{ left: "80%" }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {utilization.toFixed(1)}% utilized
            </div>
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span className="text-yellow-400/70">Max 80%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Vault Mechanics */}
        <div className="glass-card p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
            Vault Mechanics
          </h2>
          <ul className="space-y-3 text-sm text-gray-400">
            {[
              { color: "bg-brand-pink", text: "Deposits earn a pro-rata share of all fees collected from parlay ticket purchases." },
              { color: "bg-brand-purple-1", text: "The vault underwrites potential payouts. Reserved liquidity backs active tickets." },
              { color: "bg-neon-green", text: "Withdrawals are available up to the unreserved balance (max 80% utilization cap)." },
              { color: "bg-brand-gold", text: "When bettors lose, their stakes flow to the vault -- increasing share value for all depositors." },
              { color: "bg-brand-blue", text: "Lock your vUSDC shares for 30/60/90 days to earn boosted fee share (up to 1.5x multiplier)." },
            ].map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.color}`} />
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Existing lock positions */}
        {positions.length > 0 && (
          <div className="glass-card p-6">
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

      {/* Right column: Sticky action panel */}
      <div>
        <div className="glass-card-glow sticky top-20 space-y-6 p-6">
          {/* Tab buttons */}
          <div className="flex gap-1 rounded-xl bg-white/5 p-1">
            {(["deposit", "withdraw", "lock"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                data-state={tab === t ? "active" : "inactive"}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                  tab === t
                    ? "gradient-bg text-white shadow-lg"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Deposit */}
          {tab === "deposit" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Deposit USDC to earn yield from parlay fees and losses.
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Available USDC</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{formatUSDC(usdcBalance)}</span>
                  {isConnected && (
                    <button
                      onClick={() => mintHook.mint()}
                      disabled={mintHook.isPending || mintHook.isConfirming}
                      className="rounded-md bg-brand-pink/20 px-2 py-0.5 text-[10px] font-semibold text-brand-pink transition-colors hover:bg-brand-pink/30 disabled:opacity-50"
                    >
                      {mintHook.isPending ? "Signing..." : mintHook.isConfirming ? "Minting..." : mintHook.isSuccess ? "Minted!" : "+ Mint 1000"}
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={depositAmount}
                  onKeyDown={blockNonNumericKeys}
                  onChange={(e) => setDepositAmountAndReset(sanitizeNumericInput(e.target.value))}
                  placeholder="Min 1 USDC"
                  disabled={!hasUSDC}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-16 text-white placeholder-gray-600 outline-none transition-colors focus:border-brand-pink/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {hasUSDC && (
                  <button
                    onClick={() => setDepositAmountAndReset(formatUnits(usdcBalance!, 6))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-brand-pink/20 px-2 py-1 text-xs font-semibold text-brand-pink transition-colors hover:bg-brand-pink/30"
                  >
                    Max
                  </button>
                )}
              </div>
              {depositNegative && (
                <p className="text-center text-xs text-neon-red">Amount must be positive</p>
              )}
              {depositBelowMinimum && (
                <p className="text-center text-xs text-neon-red">Minimum deposit is 1 USDC</p>
              )}
              {depositExceedsBalance && (
                <p className="text-center text-xs text-neon-red">Exceeds your USDC balance</p>
              )}
              <button
                onClick={handleDeposit}
                disabled={!isConnected || !hasUSDC || !depositAmount || depositNotANumber || depositNegative || depositBelowMinimum || depositExceedsBalance || depositHook.isPending || depositHook.isConfirming}
                className="btn-gradient w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:!bg-none disabled:!bg-gray-800 disabled:!text-gray-500 disabled:!shadow-none"
              >
                {depositButtonLabel()}
              </button>
              {depositHook.error && (
                <p className="rounded-lg bg-neon-red/10 px-3 py-2 text-center text-xs text-neon-red">
                  {depositHook.error.message.length > 120
                    ? depositHook.error.message.slice(0, 120) + "..."
                    : depositHook.error.message}
                </p>
              )}
            </div>
          )}

          {/* Withdraw */}
          {tab === "withdraw" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {hasShares
                  ? "Withdraw your USDC. Subject to available (unreserved) liquidity."
                  : "You have no vault shares to withdraw."}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Available Shares</span>
                <span className="font-semibold text-white">{formatUSDC(withdrawableShares)} vUSDC</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={withdrawAmount}
                  onKeyDown={blockNonNumericKeys}
                  onChange={(e) => setWithdrawAmountAndReset(sanitizeNumericInput(e.target.value))}
                  placeholder="Shares (vUSDC)"
                  disabled={!hasShares}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-16 text-white placeholder-gray-600 outline-none transition-colors focus:border-brand-pink/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {hasShares && (
                  <button
                    onClick={() => setWithdrawAmountAndReset(formatUnits(withdrawableShares, 6))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-brand-pink/20 px-2 py-1 text-xs font-semibold text-brand-pink transition-colors hover:bg-brand-pink/30"
                  >
                    Max
                  </button>
                )}
              </div>
              {withdrawBelowMinimum && (
                <p className="text-center text-xs text-neon-red">Amount too small</p>
              )}
              {withdrawExceedsShares && (
                <p className="text-center text-xs text-neon-red">Exceeds your vault shares</p>
              )}
              {withdrawExceedsLiquidity && (
                <p className="text-center text-xs text-neon-red">Exceeds available vault liquidity</p>
              )}
              {withdrawHighUtilWarning && (
                <p className="text-center text-xs text-yellow-400">
                  This withdrawal will push utilization to {postWithdrawUtil.toFixed(0)}%. New bets may be blocked.
                </p>
              )}
              <button
                onClick={handleWithdraw}
                disabled={!isConnected || !hasShares || !withdrawAmount || withdrawNotANumber || withdrawBelowMinimum || withdrawExceedsShares || withdrawExceedsLiquidity || withdrawHook.isPending || withdrawHook.isConfirming}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {withdrawButtonLabel()}
              </button>
              {withdrawHook.error && (
                <p className="rounded-lg bg-neon-red/10 px-3 py-2 text-center text-xs text-neon-red">
                  {withdrawHook.error.message.length > 120
                    ? withdrawHook.error.message.slice(0, 120) + "..."
                    : withdrawHook.error.message}
                </p>
              )}
            </div>
          )}

          {/* Lock */}
          {tab === "lock" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Lock your vault shares for a fixed period to earn boosted fee share.
              </p>

              {/* Available shares */}
              <div className="rounded-lg bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Available vUSDC</span>
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
                    Deposit USDC first to get vault shares.
                  </p>
                )}
                {!hasShares && mounted && !isConnected && (
                  <p className="mt-1 text-xs text-gray-500">
                    Connect your wallet to see your shares.
                  </p>
                )}
              </div>

              {/* Tier selector */}
              <div className="grid grid-cols-3 gap-2">
                {TIER_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setLockTier(i)}
                    className={`rounded-lg border px-3 py-3 text-center text-xs font-semibold transition-all ${
                      lockTier === i
                        ? "border-brand-purple/50 gradient-bg text-white glow-purple"
                        : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <div>{label.split(" (")[0]}</div>
                    <div className="mt-1 text-sm font-bold">{TIER_MULTIPLIERS[i]}</div>
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={lockAmount}
                  onKeyDown={blockNonNumericKeys}
                  onChange={(e) => setLockAmount(sanitizeNumericInput(e.target.value))}
                  placeholder="vUSDC shares to lock"
                  disabled={!hasShares}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-16 text-white placeholder-gray-600 outline-none transition-colors focus:border-brand-purple/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {hasShares && (
                  <button
                    onClick={() => setLockAmount(formatUnits(userSharesBigInt, 6))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-brand-purple/20 px-2 py-1 text-xs font-semibold text-brand-purple-1 transition-colors hover:bg-brand-purple/30"
                  >
                    Max
                  </button>
                )}
              </div>

              {lockBelowMinimum && (
                <p className="text-center text-xs text-neon-red">Minimum lock is 1 vUSDC</p>
              )}
              {lockExceedsShares && (
                <p className="text-center text-xs text-neon-red">Exceeds your vault shares</p>
              )}
              <button
                onClick={handleLock}
                disabled={!isConnected || !hasShares || !lockAmount || lockNotANumber || lockBelowMinimum || lockExceedsShares || lockHook.isPending || lockHook.isConfirming}
                className="btn-gradient w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:!bg-none disabled:!bg-gray-800 disabled:!text-gray-500 disabled:!shadow-none"
              >
                {lockButtonLabel()}
              </button>
              {lockHook.error && (
                <p className="rounded-lg bg-neon-red/10 px-3 py-2 text-center text-xs text-neon-red">
                  {lockHook.error.message.length > 120
                    ? lockHook.error.message.slice(0, 120) + "..."
                    : lockHook.error.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
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
  accent: "pink" | "purple" | "green" | "gold";
}) {
  const colors = {
    pink: "from-brand-pink/10 to-transparent border-brand-pink/20",
    purple: "from-brand-purple/10 to-transparent border-brand-purple/20",
    green: "from-neon-green/10 to-transparent border-neon-green/20",
    gold: "from-brand-gold/10 to-transparent border-brand-gold/20",
  };
  return (
    <div className={`glass-card bg-gradient-to-br p-6 ${colors[accent]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

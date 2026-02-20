import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface DeployedAddresses {
  MockUSDC: `0x${string}`;
  HouseVault: `0x${string}`;
  LegRegistry: `0x${string}`;
  AdminOracleAdapter: `0x${string}`;
  OptimisticOracleAdapter: `0x${string}`;
  ParlayEngine: `0x${string}`;
  LockVault: `0x${string}`;
  MockYieldAdapter: `0x${string}`;
}

export const ADDRESSES_FILE = join(tmpdir(), "parlaycity-e2e-addresses.json");

export function writeAddresses(addrs: DeployedAddresses): void {
  writeFileSync(ADDRESSES_FILE, JSON.stringify(addrs, null, 2));
}

export function readAddresses(): DeployedAddresses {
  if (!existsSync(ADDRESSES_FILE)) {
    throw new Error(
      `E2E addresses file not found at ${ADDRESSES_FILE}. Did globalSetup run?`
    );
  }
  return JSON.parse(readFileSync(ADDRESSES_FILE, "utf-8")) as DeployedAddresses;
}

export function cleanupAddresses(): void {
  if (existsSync(ADDRESSES_FILE)) {
    unlinkSync(ADDRESSES_FILE);
  }
}

/**
 * Parse Foundry broadcast JSON to extract deployed contract addresses.
 * Matches the logic in scripts/sync-env.sh.
 */
export function parseBroadcast(broadcastPath: string): DeployedAddresses {
  const raw = JSON.parse(readFileSync(broadcastPath, "utf-8"));
  const txs: Array<{
    transactionType: string;
    contractName: string;
    contractAddress: string;
  }> = raw.transactions;

  const creates = txs.filter((tx) => tx.transactionType === "CREATE");
  const findAddr = (name: string): `0x${string}` => {
    const tx = creates.find((t) => t.contractName === name);
    if (!tx) throw new Error(`Contract ${name} not found in broadcast`);
    return tx.contractAddress as `0x${string}`;
  };

  return {
    MockUSDC: findAddr("MockUSDC"),
    HouseVault: findAddr("HouseVault"),
    LegRegistry: findAddr("LegRegistry"),
    AdminOracleAdapter: findAddr("AdminOracleAdapter"),
    OptimisticOracleAdapter: findAddr("OptimisticOracleAdapter"),
    ParlayEngine: findAddr("ParlayEngine"),
    LockVault: findAddr("LockVault"),
    MockYieldAdapter: findAddr("MockYieldAdapter"),
  };
}

import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  http,
  publicActions,
  walletActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

export const RPC_URL = "http://127.0.0.1:8546";

// Anvil pre-funded accounts
export const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const USER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

export const DEPLOYER_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
export const USER_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;

const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);
const userAccount = privateKeyToAccount(USER_KEY);

export function getPublicClient() {
  return createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
  });
}

export function getTestClient() {
  return createTestClient({
    chain: foundry,
    mode: "anvil",
    transport: http(RPC_URL),
  }).extend(publicActions).extend(walletActions);
}

export function getDeployerClient() {
  return createWalletClient({
    account: deployerAccount,
    chain: foundry,
    transport: http(RPC_URL),
  }).extend(publicActions);
}

export function getUserClient() {
  return createWalletClient({
    account: userAccount,
    chain: foundry,
    transport: http(RPC_URL),
  }).extend(publicActions);
}

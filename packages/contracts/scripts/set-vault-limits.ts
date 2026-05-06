import fs from "node:fs";
import path from "node:path";
import { parseEther } from "ethers";
import { ethers, network } from "hardhat";

async function main() {
  const chainId = Number(network.config.chainId);
  const minBetEth = process.env.MIN_BET_ETH;
  const maxBetEth = process.env.MAX_BET_ETH;
  const vaultAddress = process.env.VAULT_ADDRESS || readSharedAddresses()[chainId]?.GameVault;

  if (!vaultAddress) {
    throw new Error(`No GameVault address found for ${network.name} (${chainId}).`);
  }
  if (!minBetEth || !maxBetEth) {
    throw new Error("Set MIN_BET_ETH and MAX_BET_ETH before running this script.");
  }
  if (chainId === 8453 && process.env.ALLOW_MAINNET_DEPLOY !== "true") {
    throw new Error("Refusing Base mainnet update. Set ALLOW_MAINNET_DEPLOY=true after checking the values.");
  }

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("GameVaultV2", vaultAddress);
  const minBetWei = parseEther(minBetEth);
  const maxBetWei = parseEther(maxBetEth);

  if (minBetWei <= 0n || maxBetWei <= minBetWei) {
    throw new Error("Invalid limits. MAX_BET_ETH must be greater than MIN_BET_ETH.");
  }

  console.log(`[Vault Limits] Network: ${network.name} (${chainId})`);
  console.log(`[Vault Limits] Vault: ${vaultAddress}`);
  console.log(`[Vault Limits] Signer: ${signer.address}`);
  console.log(`[Vault Limits] Setting min=${minBetEth} ETH max=${maxBetEth} ETH`);

  const currentMin = await vault.minBet();
  if (currentMin !== minBetWei) {
    const minTx = await vault.setMinBet(minBetWei);
    await minTx.wait();
    console.log(`[Vault Limits] Min bet updated: ${minTx.hash}`);
  } else {
    console.log("[Vault Limits] Min bet already set.");
  }

  const currentMax = await vault.maxBet();
  if (currentMax !== maxBetWei) {
    const maxTx = await vault.setMaxBet(maxBetWei);
    await maxTx.wait();
    console.log(`[Vault Limits] Max bet updated: ${maxTx.hash}`);
  } else {
    console.log("[Vault Limits] Max bet already set.");
  }

  console.log(`[Vault Limits] Final min=${ethers.formatEther(await vault.minBet())} ETH max=${ethers.formatEther(await vault.maxBet())} ETH`);
}

function readSharedAddresses() {
  const outputPath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const current = fs.readFileSync(outputPath, "utf8");
  const allAddresses: Record<number, Record<string, string>> = {};
  const chainBlockPattern = /(\d+):\s*\{([^}]*)\}/g;
  let block: RegExpExecArray | null;

  while ((block = chainBlockPattern.exec(current))) {
    const chainId = Number(block[1]);
    allAddresses[chainId] = {};

    const addressPattern = /(\w+):\s*"(0x[0-9a-fA-F]{40})"/g;
    let entry: RegExpExecArray | null;
    while ((entry = addressPattern.exec(block[2]))) {
      allAddresses[chainId][entry[1]] = entry[2];
    }
  }

  return allAddresses;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

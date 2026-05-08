import fs from "node:fs";
import path from "node:path";
import { network, run } from "hardhat";

const GAME_CONTRACTS = [
  "CoinFlipGame",
  "DiceGame",
  "CrashGame",
  "MinesGame",
  "HiLoGame",
  "OverUnderGame",
  "LimboGame",
  "WheelGame",
  "PlinkoLiteGame",
  "ColorPickGame",
  "TreasureChestGame",
  "LuckySevenGame",
  "RouletteLiteGame",
  "ScratchCardGame",
  "RockPaperScissorsGame",
  "SlotsGame"
];

async function main() {
  const chainId = Number(network.config.chainId);
  const addresses = readSharedAddresses()[chainId];
  const vaultContractName = process.env.VAULT_CONTRACT_NAME || "GameVaultV2";
  const failures: Array<{ contractName: string; address: string; message: string }> = [];

  if (!addresses?.GameVault) {
    throw new Error(`No deployed addresses found for ${network.name} (${chainId}).`);
  }

  if (process.env.SKIP_VAULT_VERIFY === "true") {
    console.log(`[Blockscout] Skipping vault verification for ${addresses.GameVault}`);
  } else {
    const error = await verifyContract(vaultContractName, addresses.GameVault);
    if (error) failures.push({ contractName: vaultContractName, address: addresses.GameVault, message: error });
  }

  for (const contractName of GAME_CONTRACTS) {
    const address = addresses[contractName];
    if (!address) continue;
    const error = await verifyContract(contractName, address);
    if (error) failures.push({ contractName, address, message: error });
  }

  if (failures.length > 0) {
    console.error("[Blockscout] Verification completed with failures:");
    for (const failure of failures) {
      console.error(`- ${failure.contractName} ${failure.address}: ${failure.message}`);
    }
    process.exitCode = 1;
  }
}

async function verifyContract(contractName: string, address: string): Promise<string | null> {
  const contract = contractName === "GameVault"
    ? "contracts/core/GameVault.sol:GameVault"
    : contractName === "GameVaultV2"
      ? "contracts/core/GameVaultV2.sol:GameVaultV2"
      : `contracts/games/${contractName}.sol:${contractName}`;

  try {
    console.log(`[Blockscout] ${contractName}: ${address}`);
    await run("verify:blockscout", {
      address,
      contract,
      force: process.env.BLOCKSCOUT_FORCE === "true"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.toLowerCase().includes("already been verified") || message.toLowerCase().includes("already verified")) {
      console.log(`[Blockscout] ${contractName} already verified.`);
      return null;
    }
    console.error(`[Blockscout] ${contractName} failed: ${message}`);
    return message;
  }

  return null;
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

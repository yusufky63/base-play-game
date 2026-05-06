import fs from "node:fs";
import path from "node:path";
import { ethers, network, run } from "hardhat";

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

const gameConstructorAbi = [
  "function vault() view returns (address)",
  "function coordinator() view returns (address)",
  "function keyHash() view returns (bytes32)",
  "function subscriptionId() view returns (uint256)",
  "function callbackGasLimit() view returns (uint32)",
  "function requestConfirmations() view returns (uint16)"
];

async function main() {
  const chainId = Number(network.config.chainId);
  const addresses = readSharedAddresses()[chainId];
  const vaultContractName = process.env.VAULT_CONTRACT_NAME || "GameVault";
  if (!addresses?.GameVault) {
    throw new Error(`No deployed addresses found for ${network.name} (${chainId}).`);
  }
  if (!process.env.BASESCAN_API_KEY && !process.env.ETHERSCAN_API_KEY) {
    throw new Error("Set BASESCAN_API_KEY or ETHERSCAN_API_KEY before running Basescan verification.");
  }

  await verifyContract(vaultContractName, addresses.GameVault, []);

  for (const contractName of GAME_CONTRACTS) {
    const address = addresses[contractName];
    if (!address) continue;
    const deployedGame = new ethers.Contract(address, gameConstructorAbi, ethers.provider);
    const constructorArguments = [
      await deployedGame.vault(),
      await deployedGame.coordinator(),
      await deployedGame.keyHash(),
      await deployedGame.subscriptionId(),
      await deployedGame.callbackGasLimit(),
      await deployedGame.requestConfirmations()
    ];
    await verifyContract(contractName, address, constructorArguments);
  }
}

async function verifyContract(contractName: string, address: string, constructorArguments: unknown[]) {
  const contract = contractName === "GameVault"
    ? "contracts/core/GameVault.sol:GameVault"
    : contractName === "GameVaultV2"
      ? "contracts/core/GameVaultV2.sol:GameVaultV2"
    : `contracts/games/${contractName}.sol:${contractName}`;

  try {
    console.log(`[Verify] ${contractName}: ${address}`);
    await run("verify:verify", {
      address,
      constructorArguments,
      contract
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.toLowerCase().includes("already verified")) {
      console.log(`[Verify] ${contractName} already verified.`);
      return;
    }
    throw error;
  }
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

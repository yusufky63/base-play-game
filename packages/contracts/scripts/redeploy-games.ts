import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

const KEY_HASHES: Record<number, string> = {
  84532: "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71",
  8453: "0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd"
};

const COORDINATORS: Record<number, string> = {
  84532: "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
  8453: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
};

const CALLBACK_GAS_LIMIT = 300_000;
const REQUEST_CONFIRMATIONS = 3;
const VRF_SUBSCRIPTION_ABI = ["function addConsumer(uint256 subId, address consumer) external"];

async function main() {
  const chainId = Number(network.config.chainId);
  if (!chainId || !COORDINATORS[chainId] || !KEY_HASHES[chainId]) {
    throw new Error(`Unsupported deploy network: ${network.name} (${chainId})`);
  }

  const gameContracts = (process.env.GAMES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (gameContracts.length === 0) {
    throw new Error("Set GAMES to a comma-separated contract list, e.g. GAMES=CrashGame,MinesGame,HiLoGame");
  }

  const subscriptionEnvName = `VRF_SUB_ID_${chainId === 8453 ? "MAINNET" : "SEPOLIA"}`;
  const subscriptionId = process.env[subscriptionEnvName];
  if (!subscriptionId || subscriptionId === "0") {
    throw new Error(`${subscriptionEnvName} is required before deploying VRF games.`);
  }

  const existing = readSharedAddresses();
  const vaultAddress = existing[chainId]?.GameVault;
  if (!vaultAddress) {
    throw new Error(`GameVault address is missing for chainId ${chainId}. Deploy core contracts first.`);
  }

  const [deployer] = await ethers.getSigners();
  const coordinator = new ethers.Contract(COORDINATORS[chainId], VRF_SUBSCRIPTION_ABI, deployer);
  const vault = await ethers.getContractAt("GameVault", vaultAddress);
  const constructorArgs: Parameters<typeof ethers.deployContract>[1] = [
    vaultAddress,
    COORDINATORS[chainId],
    KEY_HASHES[chainId],
    subscriptionId,
    CALLBACK_GAS_LIMIT,
    REQUEST_CONFIRMATIONS
  ];

  const deployed: Record<string, string> = {};

  for (const contractName of gameContracts) {
    const game = await ethers.deployContract(contractName, constructorArgs);
    await game.waitForDeployment();
    const address = await game.getAddress();
    deployed[contractName] = address;

    await (await vault.approveGame(address)).wait();
    await (await coordinator.addConsumer(subscriptionId, address)).wait();
  }

  existing[chainId] = { ...(existing[chainId] ?? {}), ...deployed };
  writeSharedAddresses(existing);
  copyAbiFiles(gameContracts);

  console.log(`[Redeploy Games] Network: ${network.name} (${chainId})`);
  console.log(`[Redeploy Games] Deployer: ${deployer.address}`);
  console.table(deployed);
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

function writeSharedAddresses(allAddresses: Record<number, Record<string, string>>) {
  const outputPath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const chains = Object.entries(allAddresses)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([chainId, chainAddresses]) => {
      const entries = Object.entries(chainAddresses)
        .map(([name, address]) => `    ${name}: "${address}"`)
        .join(",\n");
      return entries ? `  ${chainId}: {\n${entries}\n  }` : `  ${chainId}: {}`;
    })
    .join(",\n");

  fs.writeFileSync(
    outputPath,
    `export const CONTRACT_ADDRESSES: Record<number, Record<string, \`0x\${string}\`>> = {\n${chains}\n};\n\nexport function getContractAddress(chainId: number, name: string): \`0x\${string}\` {\n  const address = CONTRACT_ADDRESSES[chainId]?.[name];\n  if (!address) {\n    throw new Error(\`Contract "\${name}" not found for chainId \${chainId}\`);\n  }\n  return address;\n}\n`
  );
}

function copyAbiFiles(contractNames: string[]) {
  const abiDir = path.resolve(__dirname, "../../shared/abis");
  fs.mkdirSync(abiDir, { recursive: true });

  for (const contractName of contractNames) {
    const artifactPath = path.resolve(__dirname, `../artifacts/contracts/games/${contractName}.sol/${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi: unknown };
    fs.writeFileSync(path.join(abiDir, `${contractName}.json`), JSON.stringify(artifact.abi, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

const KEY_HASHES: Record<number, string> = {
  8453: "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70"
};

const COORDINATORS: Record<number, string> = {
  8453: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
};

const CALLBACK_GAS_LIMIT = 300_000;
const REQUEST_CONFIRMATIONS = 3;
const VRF_SUBSCRIPTION_ABI = ["function addConsumer(uint256 subId, address consumer) external"];

async function main() {
  const chainId = Number(network.config.chainId);
  if (!chainId || !COORDINATORS[chainId] || !KEY_HASHES[chainId]) {
    throw new Error(`Unsupported network: ${network.name} (${chainId})`);
  }

  const subscriptionId = process.env.VRF_SUB_ID_MAINNET;
  if (!subscriptionId || subscriptionId === "0") {
    throw new Error("VRF_SUB_ID_MAINNET is required.");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`[Deploy PvP] Network: ${network.name} (${chainId})`);
  console.log(`[Deploy PvP] Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`[Deploy PvP] Deployer balance: ${ethers.formatEther(balance)} ETH`);

  const existing = readSharedAddresses();
  const treasuryAddress = existing[chainId]?.GameVault || deployer.address;
  console.log(`[Deploy PvP] Treasury: ${treasuryAddress}`);

  const constructorArgs = [
    treasuryAddress,
    COORDINATORS[chainId],
    KEY_HASHES[chainId],
    subscriptionId,
    CALLBACK_GAS_LIMIT,
    REQUEST_CONFIRMATIONS
  ];

  console.log("[Deploy PvP] Deploying PvPArena contract...");
  const arena = await ethers.deployContract("PvPArena", constructorArgs);
  await arena.waitForDeployment();
  const arenaAddress = await arena.getAddress();
  console.log(`[Deploy PvP] PvPArena deployed at: ${arenaAddress}`);

  console.log("[Deploy PvP] Adding PvPArena as VRF Consumer...");
  const coordinator = new ethers.Contract(COORDINATORS[chainId], VRF_SUBSCRIPTION_ABI, deployer);
  const tx = await coordinator.addConsumer(subscriptionId, arenaAddress);
  await tx.wait();
  console.log(`[Deploy PvP] PvPArena added to VRF subscription ${subscriptionId}`);

  existing[chainId] = {
    ...(existing[chainId] ?? {}),
    PvPArena: arenaAddress
  };
  writeSharedAddresses(existing);
  copyAbiFile();

  console.log("[Deploy PvP] Deployment complete!");
}

function readSharedAddresses() {
  const outputPath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const current = fs.readFileSync(outputPath, "utf8");
  const allAddresses: Record<number, Record<string, string>> = {};
  const chainBlockPattern = /(\d+):\s*\{([^}]*)\}/g;
  let block: RegExpExecArray | null;

  while ((block = chainBlockPattern.exec(current))) {
    const chainId = Number(block[1]);
    const lines = block[2].split("\n");
    allAddresses[chainId] = {};

    for (const line of lines) {
      const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
      if (match) {
        allAddresses[chainId][match[1]] = match[2];
      }
    }
  }

  return allAddresses;
}

function writeSharedAddresses(allAddresses: Record<number, Record<string, string>>) {
  const outputPath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const content = `export const CONTRACT_ADDRESSES: Record<number, Record<string, \`0x\${string}\`>> = {\n` +
    Object.entries(allAddresses)
      .map(([chainId, contracts]) => {
        const lines = Object.entries(contracts)
          .map(([name, addr]) => `    "${name}": "${addr}" as \`0x\${string}\``)
          .join(",\n");
        return `  "${chainId}": {\n${lines}\n  }`;
      })
      .join(",\n") +
    `\n};\n\nexport function getContractAddress(chainId: number, name: string): \`0x\${string}\` {\n  const address = CONTRACT_ADDRESSES[chainId]?.[name];\n  if (!address) {\n    throw new Error(\`Contract "\${name}" not found for chainId \${chainId}\`);\n  }\n  return address;\n}\n`;

  fs.writeFileSync(outputPath, content, "utf8");
}

function copyAbiFile() {
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/games/PvPArena.sol/PvPArena.json");
  const sharedAbiPath = path.resolve(__dirname, "../../shared/abis/PvPArena.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    fs.writeFileSync(sharedAbiPath, JSON.stringify(artifact.abi, null, 2), "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import { parseEther } from "ethers";
import { ethers, network } from "hardhat";

const KEY_HASHES: Record<number, string> = {
  8453: "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70"
};

const COORDINATORS: Record<number, string> = {
  8453: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
};

const CALLBACK_GAS_LIMIT = 250_000;
const REQUEST_CONFIRMATIONS = 3;
const VRF_SUBSCRIPTION_ABI = ["function addConsumer(uint256 subId, address consumer) external"];
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
  if (!chainId || !COORDINATORS[chainId] || !KEY_HASHES[chainId]) {
    throw new Error(`Unsupported deploy network: ${network.name} (${chainId})`);
  }
  if (chainId === 8453 && process.env.ALLOW_MAINNET_DEPLOY !== "true") {
    throw new Error("Refusing Base mainnet deploy. Set ALLOW_MAINNET_DEPLOY=true after completing the production checklist.");
  }

  const subscriptionId = process.env.VRF_SUB_ID_MAINNET;
  if (!subscriptionId || subscriptionId === "0") {
    throw new Error("VRF_SUB_ID_MAINNET is required before deploying LuckyDraw.");
  }

  const existing = readSharedAddresses();
  if (existing[chainId]?.LuckyDraw) {
    throw new Error(`LuckyDraw is already configured for chainId ${chainId}: ${existing[chainId].LuckyDraw}`);
  }

  const [deployer] = await ethers.getSigners();
  const coordinator = new ethers.Contract(COORDINATORS[chainId], VRF_SUBSCRIPTION_ABI, deployer);
  const gameAddresses = GAME_CONTRACTS.map((name) => existing[chainId]?.[name]).filter((address): address is string => Boolean(address));
  if (gameAddresses.length !== GAME_CONTRACTS.length) {
    throw new Error("All game addresses must be configured before deploying LuckyDraw.");
  }

  const luckyDraw = await ethers.deployContract("LuckyDraw", [
    COORDINATORS[chainId],
    KEY_HASHES[chainId],
    subscriptionId,
    CALLBACK_GAS_LIMIT,
    REQUEST_CONFIRMATIONS
  ]);
  await luckyDraw.waitForDeployment();

  const fundingEth = process.env.LUCKY_DRAW_FUND_ETH_MAINNET ?? "0";
  if (parseEther(fundingEth) > 0n) {
    await (await luckyDraw.fund({ value: parseEther(fundingEth) })).wait();
  }

  await (await luckyDraw.setApprovedGames(gameAddresses, true)).wait();
  await (await coordinator.addConsumer(subscriptionId, await luckyDraw.getAddress())).wait();

  existing[chainId] = { ...(existing[chainId] ?? {}), LuckyDraw: await luckyDraw.getAddress() };
  writeSharedAddresses(existing);
  copyAbiFile();

  console.log(`[Deploy LuckyDraw] Network: ${network.name} (${chainId})`);
  console.log(`[Deploy LuckyDraw] Deployer: ${deployer.address}`);
  console.log(`[Deploy LuckyDraw] Address: ${await luckyDraw.getAddress()}`);
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

function copyAbiFile() {
  const abiDir = path.resolve(__dirname, "../../shared/abis");
  fs.mkdirSync(abiDir, { recursive: true });
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/rewards/LuckyDraw.sol/LuckyDraw.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi: unknown };
  fs.writeFileSync(path.join(abiDir, "LuckyDraw.json"), JSON.stringify(artifact.abi, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

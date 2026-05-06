import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

const VRF_COORDINATORS: Record<number, string> = {
  84532: "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
  8453: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
};

const RECOVERED_BASE_V2_ADDRESSES: Record<string, string> = {
  GameVault: "0x9690226283942203e1580bdf3c3b0e9f26b3820f",
  GameVaultV2: "0x9690226283942203e1580bdf3c3b0e9f26b3820f",
  CoinFlipGame: "0x40983083bce51b7d36f17ab8a84a0ad078430f5b",
  DiceGame: "0x9b7de1b6048d5520ecf83190a356afce3d768d94",
  CrashGame: "0x9632631d8fb4afeb48bee8c70f9652d1d16cc865",
  MinesGame: "0x631347ae0178b14e216ed11b9559e334657063b4",
  HiLoGame: "0x321c981c56a2914027522963c537295df2b24ad8",
  OverUnderGame: "0x4905dab331607902b2f921d0295a65fe15c47d48",
  LimboGame: "0x805e6206b52cd33be2992e954d7f9d0e60698588",
  WheelGame: "0xefb9663863b8ac97ca049782ed83bbe93c1aad25",
  PlinkoLiteGame: "0x6ad2290f69033e0592b02093f58f271653de88c2",
  ColorPickGame: "0x522fa3265d077b34572e088748164529641fa5fc",
  TreasureChestGame: "0x11ec51f2eca6048fb0fd5fdb5ce4d61544cf3845",
  LuckySevenGame: "0x7117ea3d43d6175ea30deea6206d8aa2ce157216",
  RouletteLiteGame: "0x6f3f319e2cfe256aacf573d035cdb06c6ff7dd5c",
  ScratchCardGame: "0x2d1178376eb23053b5474ebad8437fc2018ee469",
  RockPaperScissorsGame: "0x40cc80d6a4f14d958c692998d9279d8e6aac8eeb",
  SlotsGame: "0x89290afe9f2b11d482d2684ce1d299da58b05c7a"
};

const VRF_SUBSCRIPTION_ABI = ["function addConsumer(uint256 subId, address consumer) external"];

async function main() {
  const chainId = Number(network.config.chainId);
  if (chainId !== 8453) {
    throw new Error("This recovery script is only for the recovered Base mainnet GameVaultV2 deployment.");
  }
  if (process.env.ALLOW_MAINNET_DEPLOY !== "true") {
    throw new Error("Set ALLOW_MAINNET_DEPLOY=true before activating recovered mainnet contracts.");
  }

  const subscriptionId = process.env.VRF_SUB_ID_MAINNET;
  if (!subscriptionId || subscriptionId === "0") {
    throw new Error("VRF_SUB_ID_MAINNET is required.");
  }

  const [deployer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("GameVaultV2", RECOVERED_BASE_V2_ADDRESSES.GameVault);
  const coordinator = new ethers.Contract(VRF_COORDINATORS[chainId], VRF_SUBSCRIPTION_ABI, deployer);
  const gameEntries = Object.entries(RECOVERED_BASE_V2_ADDRESSES).filter(([name]) => !name.startsWith("GameVault"));

  console.log(`[Resume V2] Network: ${network.name} (${chainId})`);
  console.log(`[Resume V2] Deployer: ${deployer.address}`);
  console.log(`[Resume V2] Vault: ${RECOVERED_BASE_V2_ADDRESSES.GameVault}`);

  for (const [name, address] of gameEntries) {
    const approved = await vault.approvedGames(address);
    if (approved) {
      console.log(`[Resume V2] ${name} already approved.`);
      continue;
    }
    const tx = await vault.approveGame(address);
    await tx.wait();
    console.log(`[Resume V2] Approved ${name}: ${address}`);
  }

  for (const [name, address] of gameEntries) {
    try {
      const tx = await coordinator.addConsumer(subscriptionId, address);
      await tx.wait();
      console.log(`[Resume V2] Added VRF consumer ${name}: ${address}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (message.toLowerCase().includes("consumer") && message.toLowerCase().includes("already")) {
        console.log(`[Resume V2] ${name} already a VRF consumer.`);
        continue;
      }
      throw error;
    }
  }

  const addresses = readSharedAddresses();
  addresses[chainId] = RECOVERED_BASE_V2_ADDRESSES;
  writeSharedAddresses(addresses);
  copyAbiFiles(["GameVaultV2", ...gameEntries.map(([name]) => name)]);
  copyAbiAlias("GameVaultV2", "GameVault");

  console.log("[Resume V2] Shared addresses updated.");
  console.table(RECOVERED_BASE_V2_ADDRESSES);
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
    const artifactPath = path.resolve(__dirname, `../artifacts/contracts/${contractPath(contractName)}/${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi: unknown };
    fs.writeFileSync(path.join(abiDir, `${contractName}.json`), JSON.stringify(artifact.abi, null, 2));
  }
}

function copyAbiAlias(contractName: string, aliasName: string) {
  const abiDir = path.resolve(__dirname, "../../shared/abis");
  const artifactPath = path.resolve(__dirname, `../artifacts/contracts/${contractPath(contractName)}/${contractName}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi: unknown };
  fs.writeFileSync(path.join(abiDir, `${aliasName}.json`), JSON.stringify(artifact.abi, null, 2));
}

function contractPath(contractName: string) {
  if (contractName === "GameVaultV2") return "core/GameVaultV2.sol";
  if (contractName === "GameVault") return "core/GameVault.sol";
  return `games/${contractName}.sol`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

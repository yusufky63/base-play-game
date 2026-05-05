import fs from "node:fs";
import path from "node:path";
import { Contract, parseEther, type Log } from "ethers";
import { ethers, network } from "hardhat";

const KEY_HASHES: Record<number, string> = {
  84532: "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71",
  8453: "0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd"
};

const COORDINATORS: Record<number, string> = {
  84532: "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
  8453: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
};

const CALLBACK_GAS_LIMIT = 200_000;
const REQUEST_CONFIRMATIONS = 3;
const DEFAULT_VAULT_FUNDING: Record<number, string> = {
  84532: "0.05",
  8453: "0"
};
const DEFAULT_NATIVE_SUBSCRIPTION_FUNDING: Record<number, string> = {
  84532: "0.1",
  8453: "0.001"
};
const VRF_SUBSCRIPTION_ABI = [
  "function createSubscription() external returns (uint256)",
  "function fundSubscriptionWithNative(uint256 subId) external payable",
  "function addConsumer(uint256 subId, address consumer) external",
  "event SubscriptionCreated(uint256 indexed subId, address owner)"
];

async function main() {
  const chainId = Number(network.config.chainId);
  if (!chainId || !COORDINATORS[chainId] || !KEY_HASHES[chainId]) {
    throw new Error(`Unsupported deploy network: ${network.name} (${chainId})`);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    throw new Error(`Deployer has 0 ETH on ${network.name}. Fund ${deployer.address} before deploying.`);
  }

  const subscriptionEnvName = `VRF_SUB_ID_${chainId === 8453 ? "MAINNET" : "SEPOLIA"}`;
  let subscriptionId = process.env[subscriptionEnvName];
  const coordinator = new ethers.Contract(COORDINATORS[chainId], VRF_SUBSCRIPTION_ABI, deployer);

  if (!subscriptionId || subscriptionId === "0") {
    subscriptionId = await createAndFundSubscription(coordinator, chainId, subscriptionEnvName);
  }

  console.log(`[Deploy] Network: ${network.name} (${chainId})`);
  console.log(`[Deploy] Deployer: ${deployer.address}`);
  console.log(`[Deploy] VRF Subscription: ${subscriptionId}`);

  const vault = await ethers.deployContract("GameVault");
  await vault.waitForDeployment();
  const vaultFunding = process.env[`VAULT_FUND_ETH_${chainId === 8453 ? "MAINNET" : "SEPOLIA"}`] ?? DEFAULT_VAULT_FUNDING[chainId] ?? "0";
  if (parseEther(vaultFunding) > 0n) {
    const fundTx = await deployer.sendTransaction({ to: await vault.getAddress(), value: parseEther(vaultFunding) });
    await fundTx.wait();
    console.log(`[Deploy] Funded vault with ${vaultFunding} ETH.`);
  }

  const constructorArgs: Parameters<typeof ethers.deployContract>[1] = [
    await vault.getAddress(),
    COORDINATORS[chainId],
    KEY_HASHES[chainId],
    subscriptionId,
    CALLBACK_GAS_LIMIT,
    REQUEST_CONFIRMATIONS
  ];

  const coinFlip = await ethers.deployContract("CoinFlipGame", constructorArgs);
  await coinFlip.waitForDeployment();

  const dice = await ethers.deployContract("DiceGame", constructorArgs);
  await dice.waitForDeployment();

  const crash = await ethers.deployContract("CrashGame", constructorArgs);
  await crash.waitForDeployment();

  const mines = await ethers.deployContract("MinesGame", constructorArgs);
  await mines.waitForDeployment();

  const hilo = await ethers.deployContract("HiLoGame", constructorArgs);
  await hilo.waitForDeployment();

  const overUnder = await ethers.deployContract("OverUnderGame", constructorArgs);
  await overUnder.waitForDeployment();

  const limbo = await ethers.deployContract("LimboGame", constructorArgs);
  await limbo.waitForDeployment();

  const wheel = await ethers.deployContract("WheelGame", constructorArgs);
  await wheel.waitForDeployment();

  const plinkoLite = await ethers.deployContract("PlinkoLiteGame", constructorArgs);
  await plinkoLite.waitForDeployment();

  const colorPick = await ethers.deployContract("ColorPickGame", constructorArgs);
  await colorPick.waitForDeployment();

  const treasureChest = await ethers.deployContract("TreasureChestGame", constructorArgs);
  await treasureChest.waitForDeployment();

  const luckySeven = await ethers.deployContract("LuckySevenGame", constructorArgs);
  await luckySeven.waitForDeployment();

  const rouletteLite = await ethers.deployContract("RouletteLiteGame", constructorArgs);
  await rouletteLite.waitForDeployment();

  const scratchCard = await ethers.deployContract("ScratchCardGame", constructorArgs);
  await scratchCard.waitForDeployment();

  const rockPaperScissors = await ethers.deployContract("RockPaperScissorsGame", constructorArgs);
  await rockPaperScissors.waitForDeployment();

  const slots = await ethers.deployContract("SlotsGame", constructorArgs);
  await slots.waitForDeployment();

  const addresses = {
    GameVault: await vault.getAddress(),
    CoinFlipGame: await coinFlip.getAddress(),
    DiceGame: await dice.getAddress(),
    CrashGame: await crash.getAddress(),
    MinesGame: await mines.getAddress(),
    HiLoGame: await hilo.getAddress(),
    OverUnderGame: await overUnder.getAddress(),
    LimboGame: await limbo.getAddress(),
    WheelGame: await wheel.getAddress(),
    PlinkoLiteGame: await plinkoLite.getAddress(),
    ColorPickGame: await colorPick.getAddress(),
    TreasureChestGame: await treasureChest.getAddress(),
    LuckySevenGame: await luckySeven.getAddress(),
    RouletteLiteGame: await rouletteLite.getAddress(),
    ScratchCardGame: await scratchCard.getAddress(),
    RockPaperScissorsGame: await rockPaperScissors.getAddress(),
    SlotsGame: await slots.getAddress()
  };

  for (const address of Object.entries(addresses).filter(([name]) => name !== "GameVault").map(([, address]) => address)) {
    const tx = await vault.approveGame(address);
    await tx.wait();
  }

  for (const address of Object.entries(addresses).filter(([name]) => name !== "GameVault").map(([, address]) => address)) {
    const tx = await coordinator.addConsumer(subscriptionId, address);
    await tx.wait();
  }

  writeSharedAddresses(chainId, addresses);
  copyAbiFiles(Object.keys(addresses));

  console.log("[Deploy] Addresses:");
  console.table(addresses);
  console.log("[Deploy] VRF consumers added.");
}

async function createAndFundSubscription(
  coordinator: Contract,
  chainId: number,
  subscriptionEnvName: string
) {
  const createTx = await coordinator.createSubscription();
  const createReceipt = await createTx.wait();
  let subscriptionId: string | undefined;

  for (const log of createReceipt?.logs ?? []) {
    try {
      const parsedLog = coordinator.interface.parseLog(log as Log);
      if (parsedLog?.name === "SubscriptionCreated") {
        subscriptionId = parsedLog.args.subId.toString();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!subscriptionId) {
    throw new Error("Could not read created VRF subscription id from transaction logs.");
  }

  const fundingEth =
    process.env[`VRF_NATIVE_FUND_ETH_${chainId === 8453 ? "MAINNET" : "SEPOLIA"}`] ??
    DEFAULT_NATIVE_SUBSCRIPTION_FUNDING[chainId];
  const fundTx = await coordinator.fundSubscriptionWithNative(subscriptionId, {
    value: parseEther(fundingEth)
  });
  await fundTx.wait();

  updateEnvValue(subscriptionEnvName, subscriptionId);
  console.log(`[Deploy] Created and funded VRF subscription with ${fundingEth} ETH.`);
  return subscriptionId;
}

function updateEnvValue(name: string, value: string) {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) return;

  const current = fs.readFileSync(envPath, "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const next = pattern.test(current)
    ? current.replace(pattern, `${name}=${value}`)
    : `${current.trimEnd()}\n${name}=${value}\n`;
  fs.writeFileSync(envPath, next);
}

function writeSharedAddresses(chainId: number, addresses: Record<string, string>) {
  const outputPath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const current = fs.readFileSync(outputPath, "utf8");
  const allAddresses = readSharedAddresses(current);
  allAddresses[chainId] = addresses;
  fs.writeFileSync(outputPath, renderSharedAddresses(allAddresses));
}

function readSharedAddresses(current: string) {
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

function renderSharedAddresses(allAddresses: Record<number, Record<string, string>>) {
  const chains = Object.entries(allAddresses)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([chainId, chainAddresses]) => {
      const entries = Object.entries(chainAddresses)
        .map(([name, address]) => `    ${name}: "${address}"`)
        .join(",\n");
      return entries ? `  ${chainId}: {\n${entries}\n  }` : `  ${chainId}: {}`;
    })
    .join(",\n");

  return `export const CONTRACT_ADDRESSES: Record<number, Record<string, \`0x\${string}\`>> = {\n${chains}\n};\n\nexport function getContractAddress(chainId: number, name: string): \`0x\${string}\` {\n  const address = CONTRACT_ADDRESSES[chainId]?.[name];\n  if (!address) {\n    throw new Error(\`Contract "\${name}" not found for chainId \${chainId}\`);\n  }\n  return address;\n}\n`;
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

function contractPath(contractName: string) {
  if (contractName === "GameVault") return "core/GameVault.sol";
  return `games/${contractName}.sol`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

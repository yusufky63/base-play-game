import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

function readSharedAddresses(): Record<number, Record<string, string>> {
  const filePath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/export const CONTRACT_ADDRESSES: Record<number, Record<string, `0x\$\{string\}`>> = (\{[\s\S]*?\n\};)/);
  if (!match) {
    throw new Error("Could not parse CONTRACT_ADDRESSES from shared config.");
  }
  return eval(`(${match[1].replace(/;\s*$/, "")})`);
}

function writeSharedAddresses(addresses: Record<number, Record<string, string>>) {
  const filePath = path.resolve(__dirname, "../../shared/src/config/addresses.ts");
  const serialized = JSON.stringify(addresses, null, 2).replace(/"(0x[a-fA-F0-9]+)"/g, '"$1" as `0x${string}`');
  const fileContent = `export const CONTRACT_ADDRESSES: Record<number, Record<string, \`0x\${string}\`>> = ${serialized};\n\nexport function getContractAddress(chainId: number, name: string): \`0x\${string}\` {\n  const address = CONTRACT_ADDRESSES[chainId]?.[name];\n  if (!address) {\n    throw new Error(\`Contract "\${name}" not found for chainId \${chainId}\`);\n  }\n  return address;\n}\n`;
  fs.writeFileSync(filePath, fileContent);
}

async function main() {
  const chainId = Number(network.config.chainId) || 8453;
  const [deployer] = await ethers.getSigners();
  console.log(`[Deploy] Deploying BasePlayBadges to chainId ${chainId}...`);
  console.log(`[Deploy] Deployer Address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`[Deploy] Balance: ${ethers.formatEther(balance)} ETH`);

  const initialBaseURI = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/badges/` 
    : "https://baseplay.app/api/badges/";

  const trustedSigner = deployer.address;

  console.log(`[Deploy] Initial Base URI: ${initialBaseURI}`);
  console.log(`[Deploy] Trusted Signer: ${trustedSigner}`);

  const factory = await ethers.getContractFactory("BasePlayBadges", deployer);
  const badges = await factory.deploy(trustedSigner, initialBaseURI);
  await badges.waitForDeployment();

  const badgesAddress = await badges.getAddress();
  console.log(`[Deploy] ✅ BasePlayBadges successfully deployed at: ${badgesAddress}`);

  const addresses = readSharedAddresses();
  if (!addresses[chainId]) {
    addresses[chainId] = {};
  }
  addresses[chainId].BasePlayBadges = badgesAddress;
  writeSharedAddresses(addresses);

  console.log(`[Deploy] ✅ Updated shared addresses with BasePlayBadges = ${badgesAddress}`);
}

main().catch((err) => {
  console.error("[Deploy] Failed:", err);
  process.exit(1);
});

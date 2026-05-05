import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: "../../.env" });
dotenv.config({ path: ".env" });

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const baseMainnetRpcUrl = process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    baseSepolia: {
      chainId: 84532,
      url: baseSepoliaRpcUrl,
      accounts
    },
    base: {
      chainId: 8453,
      url: baseMainnetRpcUrl,
      accounts
    }
  }
};

export default config;

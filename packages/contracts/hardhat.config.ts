import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: "../../.env" });
dotenv.config({ path: ".env" });

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const baseMainnetRpcUrl = process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "";

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
  },
  etherscan: {
    apiKey: etherscanApiKey
  },
  blockscout: {
    enabled: false,
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://base.blockscout.com/api",
          browserURL: "https://base.blockscout.com/"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://base-sepolia.blockscout.com/api",
          browserURL: "https://base-sepolia.blockscout.com/"
        }
      }
    ]
  }
};

export default config;

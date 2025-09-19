import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-artifactor";
import { task, subtask } from "hardhat/config";
// import "./tasks/merge";
// import "./tasks/prove";
// import "./tasks/genResults";
// import "./tasks/submitOnChain";
import "./tasks/deploy";
import "./tasks/runner/benchmarks";
import "./tasks/runner/deployFull";
import "./tasks/runner/deployPoll";
import "./tasks/runner/encodeErrors";
import "./tasks/runner/joinPoll";
import "./tasks/runner/merge";
import "./tasks/runner/prove";
import "./tasks/runner/signup";
import "./tasks/runner/submitOnChain";
import "./tasks/runner/vote";
import "./tasks/runner/getTallyResults";
import "./tasks/runner/encodeErrors";
import "./tasks/runner/deployPollWrapper";

// Import all policy tasks
import "./tasks/policy";

/**
 * Allow to copy a directory from source to target
 * @param source - the source directory
 * @param target - the target directory
 */
function copyDirectory(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  if (!fs.existsSync(source)) {
    return;
  }

  const files = fs.readdirSync(source);

  files.forEach((file: string) => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// Define a subtask to copy artifacts
subtask("copy-maci-artifacts", async (_, { config }) => {
  const sourceDir = path.resolve(__dirname, "node_modules/@maci-protocol/contracts/build/artifacts/contracts/");
  const destDir = path.resolve(config.paths.artifacts, "@maci-protocol/contracts", "contracts");

  copyDirectory(sourceDir, destDir);
});

// Define a subtask to copy excubiae artifacts
subtask("copy-excubiae-artifacts", async (_, { config }) => {
  const sourceDir = path.resolve(__dirname, "node_modules/@excubiae/contracts/build/artifacts/contracts/");
  const destDir = path.resolve(config.paths.artifacts, "@excubiae/contracts", "contracts");

  if (fs.existsSync(sourceDir)) {
    copyDirectory(sourceDir, destDir);
  }
});

// Override the existing compile task
task("compile", async (args, hre, runSuper) => {
  // Before compilation move over artifacts
  await hre.run("copy-maci-artifacts");
  await hre.run("copy-excubiae-artifacts");

  // Run the original compile task
  await runSuper(args);

  // After compilation, run the subtask to copy artifacts
  await hre.run("copy-maci-artifacts");
  await hre.run("copy-excubiae-artifacts");
});

// If not set, it uses ours Alchemy's default API key.
// You can get your own at https://dashboard.alchemyapi.io
const providerApiKey = process.env.INFURA_API_KEY;
// If not set, it uses the hardhat account 0 private key.
const deployerPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// If not set, it uses ours Etherscan default API key.
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
    
  },
  defaultNetwork: "localhost",
  namedAccounts: {
    deployer: {
      // By default, it will take the first Hardhat account as the deployer
      default: 0,
    },
  },
  networks: {
    // View the networks that are pre-configured.
    // If the network you are looking for is not here you can add new network settings
    hardhat: {
      // forking: {
      //   url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
      //   enabled: process.env.MAINNET_FORKING_ENABLED === "true",
      // },
      loggingEnabled: false,
    },
    localhost: {
      accounts: ["0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a","0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6","0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"  ],
    },
    anvil: {
      url: "http://127.0.0.1:8545",
      accounts: [deployerPrivateKey],
    },
    holesky: {
      url: `https://holesky.infura.io/v3/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    "base-sepolia": {
      url: `https://base-sepolia.gateway.tenderly.co`,
      accounts: [deployerPrivateKey],
      // gasPrice: 2000000000, // 2 gwei - higher base price
      // gasMultiplier: 2.0,    // Increased from 1.5 to 2.0
    },
    "optimism-sepolia": {
      url: `https://optimism-sepolia.gateway.tenderly.co`,
      accounts: [deployerPrivateKey],
    },
  },
  // configuration for harhdat-verify plugin
  etherscan: {
    apiKey: `${etherscanApiKey}`,
  },
  // configuration for etherscan-verify from hardhat-deploy plugin
  verify: {
    etherscan: {
      apiKey: `${etherscanApiKey}`,
    },
  },
  sourcify: {
    enabled: false,
  },
};

export default config;

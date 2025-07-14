/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { 
  generateMerkleProofData,
} from "../../utils/policyDataGenerator";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate MerkleProof policy data task
 */
task("generate-merkle-proof-data", "Generate signup data for MerkleProof policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ 
    deploy,
    updateConfig
  }, hre) => {
    try {
      console.log(info(`Generating signup data for MerkleProof policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying supporting contracts..."));
        // MerkleProof doesn't need additional contracts deployed
        logYellow({ text: "ℹ️  MerkleProof policy doesn't require additional contract deployment" });
      }
      
      // Generate the signup data using hardcoded values
      const signupData = generateMerkleProofData();
      
      logGreen({ text: `✅ MerkleProof signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig("MerkleProof", signupData, deployedContracts, hre);
        logGreen({ text: `✅ Deploy config updated with MerkleProofPolicy signupDataHex` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"MerkleProofPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "signupDataHex": "${signupData}",`);
        console.log(`  "root": "0x2461fcc4c0965cb7f482dd28f1ca8057b7a62a35e8b7a86bb3ad6523f4bb21c0"`);
        console.log(`}`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating MerkleProof policy data: ${(error as Error).message}`);
      throw error;
    }
  });

/**
 * Update deploy config with generated signup data and deployed contract addresses
 */
async function updateDeployConfig(policy: string, signupData: string, deployedContracts: any, hre: any): Promise<void> {
  const deployment = Deployment.getInstance();
  deployment.setHre(hre);
  
  const configPath = path.resolve(__dirname, "../../deploy-config.json");
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Deploy config file not found at ${configPath}`);
  }
  
  try {
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);
    
    const networkName = hre.network.name;
    const policyKey = `${policy}Policy`;
    
    if (!config[networkName]) {
      config[networkName] = {};
    }
    
    if (!config[networkName][policyKey]) {
      config[networkName][policyKey] = { deploy: false };
    }
    
    // Update the signupDataHex field
    config[networkName][policyKey].signupDataHex = signupData;
    
    // Update deployed contract addresses if available
    if (deployedContracts.token) {
      config[networkName][policyKey].token = deployedContracts.token;
    }
    if (deployedContracts.easAddress) {
      config[networkName][policyKey].easAddress = deployedContracts.easAddress;
    }
    if (deployedContracts.attester) {
      config[networkName][policyKey].attester = deployedContracts.attester;
    }
    
    // Write back to file with proper formatting
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(info(`Updated ${networkName}.${policyKey}.signupDataHex in deploy-config.json`));
    
    // Log deployed contract updates
    if (Object.keys(deployedContracts).length > 0) {
      console.log(info("Updated deployed contract addresses:"));
      Object.entries(deployedContracts).forEach(([key, value]) => {
        console.log(info(`  ${key}: ${value}`));
      });
    }
    
  } catch (error) {
    throw new Error(`Error updating deploy config: ${(error as Error).message}`);
  }
} 
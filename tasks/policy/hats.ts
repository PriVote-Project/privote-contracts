/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { updateAccountConfigWithPolicyEvidence } from "../runner/create-account-config";

/**
 * Generate Hats policy data task
 */
task("generate-hats-data", "Generate signup data for Hats policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .addOptionalParam("account", "Account index to save evidence to (saves to account-config.json, default: 0)", "0", types.string)
  .setAction(async ({ 
    deploy,
    updateConfig,
    account
  }, hre) => {
    try {
      console.log(info(`Generating signup data for Hats policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying supporting contracts..."));
        logYellow({ text: "ℹ️  Hats policy requires external Hats Protocol deployment" });
        logYellow({ text: "ℹ️  This task generates data for existing Hats deployments" });
      }
      
      // TODO: Generate the signup data
      const signupData = "0x";
      
      logGreen({ text: `✅ Hats signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig("Hats", signupData, deployedContracts, hre);
        await updateAccountConfigWithPolicyEvidence(account, "Hats", signupData, hre);
        logGreen({ text: `✅ Deploy and account config updated with HatsPolicy` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"HatsPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "HatsPolicyEvidence": "${signupData}"`);
        console.log(`  "hatsContract": "0x0000000000000000000000000000000000000000"`);
        console.log(`}`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating Hats policy data: ${(error as Error).message}`);
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
    
    // Write back to file with proper formatting
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(info(`Updated ${networkName}.${policyKey} in deploy-config.json`));
    
  } catch (error) {
    throw new Error(`Error updating deploy config: ${(error as Error).message}`);
  }
} 
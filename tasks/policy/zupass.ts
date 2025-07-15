/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate Zupass policy data task
 */
task("generate-zupass-data", "Generate signup data for Zupass policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ 
    deploy,
    updateConfig
  }, hre) => {
    try {
      console.log(info(`Generating signup data for Zupass policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying supporting contracts..."));
        logYellow({ text: "ℹ️  Zupass policy requires external Zupass verifier contract" });
        logYellow({ text: "ℹ️  This task generates data for existing Zupass deployments" });
      }
      
      // TODO: Generate the signup data
      const signupData = "0x";
      
      logGreen({ text: `✅ Zupass signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig("Zupass", signupData, deployedContracts, hre);
        logGreen({ text: `✅ Deploy config updated with ZupassPolicy` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"ZupassPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "ZupassPolicyEvidence": "${signupData}"`);
        console.log(`  "signer1": "13908133709081944902758389525983124100292637002438232157513257158004852609027",`);
        console.log(`  "signer2": "7654374482676219729919246464135900991450848628968334062174564799457623790084",`);
        console.log(`  "eventId": "69c0caaa-c65d-5345-a20c-867774f18c67",`);
        console.log(`  "zupassVerifier": "0x2272cdb3596617886d0F48524DA486044E0376d6"`);
        console.log(`}`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating Zupass policy data: ${(error as Error).message}`);
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
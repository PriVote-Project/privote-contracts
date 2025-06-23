/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { 
  generateSignupDataForPolicy,
  EXAMPLE_POLICY_DATA
} from "../../utils/policyDataGenerator";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate policy data task
 */
task("generate-policy-data", "Generate signup data for different policy types")
  .addParam("policy", "Policy type (FreeForAll, MerkleProof, EAS, ERC20, ERC20Votes, Semaphore, GitcoinPassport, Zupass, Hats, AnonAadhaar, Token)", undefined, types.string)
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ 
    policy, 
    updateConfig
  }, hre) => {
    try {
      console.log(info(`Generating signup data for ${policy} policy...`));
      
      // Generate the signup data using hardcoded values
      const signupData = generateSignupDataForPolicy(policy);
      
      logGreen({ text: `✅ ${policy} signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig(policy, signupData, hre);
        logGreen({ text: `✅ Deploy config updated with ${policy}Policy signupDataHex` });
             } else {
         console.log("\n" + info("To update deploy-config.json, run with --update-config"));
         console.log("\n" + info("Manual config entry:"));
        console.log(`"${policy}Policy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "signupDataHex": "${signupData}",`);
        console.log(`  // ... other policy specific fields`);
        console.log(`}`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating policy data: ${(error as Error).message}`);
      throw error;
    }
  });

/**
 * Update deploy config with generated signup data
 */
async function updateDeployConfig(policy: string, signupData: string, hre: any): Promise<void> {
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
    
    // Write back to file with proper formatting
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(info(`Updated ${networkName}.${policyKey}.signupDataHex in deploy-config.json`));
    
  } catch (error) {
    throw new Error(`Error updating deploy config: ${(error as Error).message}`);
  }
}

/**
 * Show examples task
 */
task("show-policy-examples", "Show example signup data for all policy types")
  .setAction(async (_, hre) => {
    console.log(info("Example signup data for different policy types:\n"));
    
    Object.entries(EXAMPLE_POLICY_DATA).forEach(([policyType, data]) => {
      logGreen({ text: `${policyType}Policy:` });
      console.log(`  signupDataHex: "${data}"`);
      console.log(`  length: ${data.length} characters\n`);
    });
    
    console.log(info("Usage examples:"));
    console.log("npx hardhat generate-policy-data --policy FreeForAll");
         console.log("npx hardhat generate-policy-data --policy MerkleProof --update-config");
     console.log("npx hardhat generate-policy-data --policy EAS --update-config");
     console.log("npx hardhat generate-policy-data --policy AnonAadhaar --update-config");
     console.log("npx hardhat generate-policy-data --policy Token --update-config");
    
    console.log("\n" + info("Supported policy types:"));
    console.log("- FreeForAll (no signup data required)");
    console.log("- MerkleProof (merkle proof verification)");
    console.log("- EAS (Ethereum Attestation Service)");
    console.log("- ERC20 (ERC20 token balance)");
    console.log("- ERC20Votes (ERC20Votes token with snapshot)");
    console.log("- Semaphore (Semaphore group membership)");
    console.log("- GitcoinPassport (Gitcoin Passport score)");
    console.log("- Zupass (Zupass event verification)");
    console.log("- Hats (Hats Protocol membership)");
    console.log("- AnonAadhaar (Anonymous Aadhaar verification)");
    console.log("- Token (ERC721/NFT token ownership)");
    
    console.log("\n" + info("Special commands:"));
    console.log("- generate-all-policy-data: Generate data for all policy types");
  }); 

/**
 * Generate all policy data task
 */
task("generate-all-policy-data", "Generate signup data for all policy types")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ updateConfig }, hre) => {
    const policies = Object.keys(EXAMPLE_POLICY_DATA);
    
    console.log(info(`Generating signup data for ${policies.length} policy types...`));
    
    for (const policy of policies) {
      try {
        console.log("\n" + info(`Processing ${policy}...`));
        const signupData = generateSignupDataForPolicy(policy);
        
        logGreen({ text: `✅ ${policy}: ${signupData.substring(0, 20)}...` });
        
        if (updateConfig) {
          await updateDeployConfig(policy, signupData, hre);
        }
        
      } catch (error) {
        console.error(`❌ Error generating ${policy} data: ${(error as Error).message}`);
      }
    }
    
    if (updateConfig) {
      logGreen({ text: `✅ All policy signup data updated in deploy-config.json` });
         } else {
       console.log("\n" + info("To update deploy-config.json for all policies, run with --update-config"));
     }
  }); 
/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate ERC20 policy data task
 */
task("generate-erc20-data", "Generate signup data for ERC20 policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ 
    deploy,
    updateConfig
  }, hre) => {
    try {
      console.log(info(`Generating signup data for ERC20 policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying SimpleERC20 contract..."));
        
        // Deploy SimpleERC20 contract
        const SimpleERC20Factory = await hre.ethers.getContractFactory("SimpleERC20");
        const simpleERC20 = await SimpleERC20Factory.deploy();
        await simpleERC20.waitForDeployment();
        const contractAddress = await simpleERC20.getAddress();
        
        deployedContracts.token = contractAddress;
        
        // Log deployment details
        const name = await simpleERC20.name();
        const symbol = await simpleERC20.symbol();
        
        logGreen({ text: `✅ SimpleERC20 deployed to: ${contractAddress}` });
        console.log(info(`   Name: ${name}`));
        console.log(info(`   Symbol: ${symbol}`));
      }
      
      // No signup data for ERC20 policy
      const signupData = "0x";
      
      logGreen({ text: `✅ ERC20 signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig("ERC20", signupData, deployedContracts, hre);
        logGreen({ text: `✅ Deploy config updated with ERC20Policy signupDataHex` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"ERC20Policy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "signupDataHex": "${signupData}",`);
        console.log(`  "token": "${deployedContracts.token || '0x0000000000000000000000000000000000000000'}",`);
        console.log(`  "threshold": 1`);
        console.log(`}`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating ERC20 policy data: ${(error as Error).message}`);
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
    if (deployedContracts.schemaRegistry) {
      config[networkName][policyKey].schemaRegistry = deployedContracts.schemaRegistry;
    }
    if (deployedContracts.schema) {
      config[networkName][policyKey].schema = deployedContracts.schema;
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
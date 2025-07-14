/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate Token (ERC721) policy data task
 */
task("generate-token-data", "Generate signup data for Token (ERC721) policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .addFlag("mintNft", "Mint an NFT from the configured token contract and use its token ID for signup data")
  .addOptionalParam("tokenId", "Specific token ID to use for signup data (overrides mint-nft)", undefined, types.int)
  .setAction(async ({ 
    deploy,
    updateConfig,
    mintNft,
    tokenId
  }, hre) => {
    try {
      console.log(info(`Generating signup data for Token (ERC721) policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying SimpleERC721 contract..."));
        
        // Deploy SimpleERC721 contract
        const SimpleERC721Factory = await hre.ethers.getContractFactory("SimpleERC721");
        const simpleERC721 = await SimpleERC721Factory.deploy();
        await simpleERC721.waitForDeployment();
        const contractAddress = await simpleERC721.getAddress();
        
        deployedContracts.token = contractAddress;
        
        // Log deployment details
        const name = await simpleERC721.name();
        const symbol = await simpleERC721.symbol();
        const deployer = await hre.ethers.provider.getSigner(0);
        const deployerBalance = await simpleERC721.balanceOf(deployer.address);
        
        logGreen({ text: `✅ SimpleERC721 deployed to: ${contractAddress}` });
        console.log(info(`   Name: ${name}`));
        console.log(info(`   Symbol: ${symbol}`));
        console.log(info(`   Deployer initial balance: ${deployerBalance.toString()} tokens`));
      }
      
      // Generate signup data based on token ID
      let finalTokenId = tokenId;
      let signupData: string;
      
      // If mintNft flag is set and no specific token ID provided, mint an NFT
      if (mintNft && !tokenId) {
        // Get token address from deploy config or deployed contracts
        let tokenAddress = deployedContracts.token;
        
        if (!tokenAddress) {
          const deployment = Deployment.getInstance();
          deployment.setHre(hre);
          
          try {
            tokenAddress = deployment.getDeployConfigField("TokenPolicy", "token");
          } catch (error) {
            throw new Error("Cannot mint NFT without token address. Use --deploy flag first or ensure TokenPolicy.token is configured in deploy-config.json");
          }
        }
        
        console.log(info("🎨 Minting NFT..."));
        const SimpleERC721Factory = await hre.ethers.getContractFactory("SimpleERC721");
        const tokenContract = SimpleERC721Factory.attach(tokenAddress);
        
        // Get current signer (deployer)
        const signer = await hre.ethers.provider.getSigner(0);
        
        // Mint NFT to the signer
        const mintTx = await (tokenContract as any).mint();
        const mintReceipt = await mintTx.wait();
        
        // Get token ID from the Transfer event
        const transferEvent = mintReceipt?.logs.find((log: any) => {
          try {
            const parsed = tokenContract.interface.parseLog(log);
            return parsed?.name === "Transfer" && parsed?.args.from === "0x0000000000000000000000000000000000000000";
          } catch {
            return false;
          }
        });
        
        if (transferEvent) {
          const parsed = tokenContract.interface.parseLog(transferEvent);
          finalTokenId = Number(parsed?.args.tokenId);
          logGreen({ text: `✅ NFT minted with token ID: ${finalTokenId}` });
          console.log(info(`   Minted to: ${signer.address}`));
        } else {
          throw new Error("Failed to get token ID from mint transaction");
        }
      }
      
      // Generate signup data with token ID
      if (finalTokenId !== undefined) {
        const abiCoder = new hre.ethers.AbiCoder();
        signupData = abiCoder.encode(
          ["uint256"],
          [BigInt(finalTokenId)]
        );
        
        console.log(info(`Using token ID: ${finalTokenId}`));
      } else {
        // Use default token ID if no specific ID or minting
        const abiCoder = new hre.ethers.AbiCoder();
        signupData = abiCoder.encode(
          ["uint256"],
          [BigInt(0)]
        );
        
        console.log(info("Using default token ID: 0"));
      }
      
      logGreen({ text: `✅ Token (ERC721) signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig("Token", signupData, deployedContracts, hre);
        logGreen({ text: `✅ Deploy config updated with TokenPolicy signupDataHex` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"TokenPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "signupDataHex": "${signupData}",`);
        console.log(`  "token": "${deployedContracts.token || '0x0000000000000000000000000000000000000000'}"`);
        console.log(`}`);
        console.log("\n" + info("Usage examples:"));
        console.log("npx hardhat generate-token-data --deploy --update-config");
        console.log("npx hardhat generate-token-data --mint-nft --update-config");
        console.log("npx hardhat generate-token-data --token-id 5 --update-config");
      }
      
    } catch (error) {
      console.error(`❌ Error generating Token policy data: ${(error as Error).message}`);
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
/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate AnonAadhaar policy data task
 */
task("generate-anon-aadhaar-data", "Generate signup data for AnonAadhaar policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ 
    deploy,
    updateConfig
  }, hre) => {
    try {
      console.log(info(`Generating signup data for AnonAadhaar policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying AnonAadhaar contracts..."));
        
        // Deploy the AnonAadhaarVerifier contract first (Groth16 verifier)
        console.log(info("📋 Step 1: Deploying AnonAadhaarVerifier..."));
        const AnonAadhaarGroth16VerifierFactory = await hre.ethers.getContractFactory("AnonAadhaarGroth16Verifier");
        const anonAadhaarGroth16Verifier = await AnonAadhaarGroth16VerifierFactory.deploy();
        await anonAadhaarGroth16Verifier.waitForDeployment();
        const groth16VerifierAddress = await anonAadhaarGroth16Verifier.getAddress();

        deployedContracts.groth16Verifier = groth16VerifierAddress;
        logGreen({ text: `✅ AnonAadhaarGroth16Verifier deployed to: ${groth16VerifierAddress}` });

        // Deploy the main AnonAadhaar contract with verifier and pubkey hash
        console.log(info("📋 Step 2: Deploying AnonAadhaar contract..."));
        
        // Get pubkey hash from deploy config or use default
        const deployment = Deployment.getInstance();
        deployment.setHre(hre);
        
        let pubkeyHash;
        try {
          pubkeyHash = deployment.getDeployConfigField("AnonAadhaarPolicy", "pubkeyHash");
        } catch (error) {
          // Use default testnet pubkey hash if not configured
          pubkeyHash = "15134874015316324267425466444584014077184337590635665158241104437045239495873";
          console.log(info(`Using default testnet pubkey hash: ${pubkeyHash}`));
        }
        
        const AnonAadhaarVerifierFactory = await hre.ethers.getContractFactory("AnonAadhaarVerifier");
        const anonAadhaarVerifier = await AnonAadhaarVerifierFactory.deploy(groth16VerifierAddress, BigInt(pubkeyHash));
        await anonAadhaarVerifier.waitForDeployment();
        const anonAadhaarVerifierAddress = await anonAadhaarVerifier.getAddress();
        
        deployedContracts.anonAadhaarVerifier = anonAadhaarVerifierAddress;
        logGreen({ text: `✅ AnonAadhaarVerifier deployed to: ${anonAadhaarVerifierAddress}` });
        
        console.log(info("🎉 AnonAadhaar contracts deployment completed successfully!"));
        console.log(info("🔗 Contract Chain: AnonAadhaarGroth16Verifier → AnonAadhaarVerifier"));
      }
      
      // Generate the signup data using hardcoded values
    //   const signupData = generateAnonAadhaarData();
    let signupData;
    if (hre.network.name === "localhost") {
        const nullifierSeed = "4534";
        const nullifier = "10106489451831694175686105594084244223757091351145393284926689497346436753241";
        // unix timestamp
        const timestamp = "1750613400";
        // signal = uint256(uint160(msg.sender)), uses 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 as example which is
        // one of default anvil accounts
        const signal = "642829559307850963015472508762062935916233390536";  
        // revealArray = uint256[4]
        const revealArray = ["0", "0", "0", "0"];
        const groth16Proof = [
          "15954551707873129555711629956607532118404333309916554756892215525130939695676",
          "8239468569006120879267005135042798894554237473569459127104948087517383230995",
          "7569910317891855226401245108505748269957301084621467224423528186782550911197",
          "17494842777099248116059167452104143896794204909498051154775340709752226090928",
          "14587277977527487502372543147472199411401450533020118643651855163143391594934",
          "15525696724996264190975696356375477209981731300350522209594933545234810157074",
          "12886552238349993293270677622021723794792670883308355077719101771071901279069",
          "11059113823946956849715986879812806569480151634293531664992835954915693161719"
        ];

        const abiCoder = new hre.ethers.AbiCoder();
        signupData = abiCoder.encode(   
            ["uint256", "uint256", "uint256", "uint256", "uint256[4]", "uint256[8]"],
            [nullifierSeed, nullifier, timestamp, signal, revealArray, groth16Proof]
          );
    } else {
    //   TODO: Add signup data for with anon aadhaar proof 
    signupData = "0x";
    }
      
      logGreen({ text: `✅ AnonAadhaar signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
      if (updateConfig) {
        await updateDeployConfig("AnonAadhaar", signupData, deployedContracts, hre);
        logGreen({ text: `✅ Deploy config updated with AnonAadhaarPolicy signupDataHex` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"AnonAadhaarPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "signupDataHex": "${signupData}",`);
        console.log(`  "verifierAddress": "${deployedContracts.anonAadhaarVerifier || '0x0000000000000000000000000000000000000000'}",`);
        console.log(`  "pubkeyHash": "15134874015316324267425466444584014077184337590635665158241104437045239495873",`);
        console.log(`  "nullifierSeed": "4534"`);
        console.log(`}`);
        console.log("\n" + info("Usage examples:"));
        console.log("npx hardhat generate-anon-aadhaar-data --deploy --update-config");
        console.log("npx hardhat generate-anon-aadhaar-data --update-config");
      }
      
    } catch (error) {
      console.error(`❌ Error generating AnonAadhaar policy data: ${(error as Error).message}`);
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
    if (deployedContracts.anonAadhaarVerifier) {
      config[networkName][policyKey].verifierAddress = deployedContracts.anonAadhaarVerifier;
    }
    if (deployedContracts.groth16Verifier) {
      config[networkName][policyKey].groth16Verifier = deployedContracts.groth16Verifier;
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
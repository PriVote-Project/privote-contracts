/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { logGreen, logYellow, info } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { updateAccountConfigWithPolicyEvidence } from "../runner/create-account-config";

/**
 * Generate EAS policy data task
 */
task("generate-eas-data", "Generate signup data for EAS policy")
  .addFlag("deploy", "Deploy supporting contracts for the policy")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .addFlag("createSimpleAttestation", "Create a simple attestation and use its ID for signup data")
  .addOptionalParam("attestationId", "Custom attestation ID (bytes32 hex format) to use for signup data", undefined, types.string)
  .addOptionalParam("attestValue", "Value to attest when creating simple attestation", 0, types.int)
  .addOptionalParam("account", "Account index to save evidence to (saves to account-config.json, default: 0)", "0", types.string)
  .setAction(async ({ 
    deploy,
    updateConfig,
    createSimpleAttestation,
    attestationId,
    attestValue,
    account
  }, hre) => {
    try {
      console.log(info(`Generating signup data for EAS policy...`));
      
      let deployedContracts: any = {};
      
      // Deploy supporting contracts if flag is provided
      if (deploy) {
        console.log(info("🚀 Deploying EAS ecosystem contracts..."));
        
        // Deploy the SimpleSchemaRegistry contract first
        console.log(info("📋 Step 1: Deploying SimpleSchemaRegistry..."));
        const SimpleSchemaRegistryFactory = await hre.ethers.getContractFactory("SimpleSchemaRegistry");
        const simpleSchemaRegistry = await SimpleSchemaRegistryFactory.deploy();
        await simpleSchemaRegistry.waitForDeployment();
        const schemaRegistryAddress = await simpleSchemaRegistry.getAddress();
        
        deployedContracts.schemaRegistry = schemaRegistryAddress;
        logGreen({ text: `✅ SimpleSchemaRegistry deployed to: ${schemaRegistryAddress}` });

        // Deploy the SimpleEAS contract using the deployed schema registry
        console.log(info("📋 Step 2: Deploying SimpleEAS with SchemaRegistry..."));
        const SimpleEASFactory = await hre.ethers.getContractFactory("SimpleEAS");
        const simpleEAS = await SimpleEASFactory.deploy(schemaRegistryAddress);
        await simpleEAS.waitForDeployment();
        const easAddress = await simpleEAS.getAddress();
        
        deployedContracts.easAddress = easAddress;
        logGreen({ text: `✅ SimpleEAS deployed to: ${easAddress}` });

        // Deploy the SimpleAttester contract using the deployed EAS
        console.log(info("📋 Step 3: Deploying SimpleAttester with EAS..."));
        const SimpleAttesterFactory = await hre.ethers.getContractFactory("SimpleAttester");
        const simpleAttester = await SimpleAttesterFactory.deploy(easAddress);
        await simpleAttester.waitForDeployment();
        const attesterAddress = await simpleAttester.getAddress();
        
        deployedContracts.attester = attesterAddress;
        logGreen({ text: `✅ SimpleAttester deployed to: ${attesterAddress}` });

        // Create a schema for EAS
        console.log(info("📋 Step 4: Creating schema..."));
        const schemaString = "bool isValid";
        const resolverAddress = "0x0000000000000000000000000000000000000000"; // No resolver
        const revocable = true;
        
        const tx = await simpleSchemaRegistry.register(schemaString, resolverAddress, revocable);
        const receipt = await tx.wait();
        
        // Get schema UID from the event logs
        const schemaCreatedEvent = receipt?.logs.find((log: any) => {
          try {
            const parsed = simpleSchemaRegistry.interface.parseLog(log);
            return parsed?.name === "Registered";
          } catch {
            return false;
          }
        });
        
        let schemaUID = "0xe2636f31239f7948afdd9a9c477048b7fc2a089c347af60e3aa1251e5bf63e5c"; // Default
        if (schemaCreatedEvent) {
          const parsed = simpleSchemaRegistry.interface.parseLog(schemaCreatedEvent);
          schemaUID = parsed?.args.uid;
        }
        
        deployedContracts.schema = schemaUID;
        logGreen({ text: `✅ Schema created with UID: ${schemaUID}` });
        
        console.log(info("🎉 EAS ecosystem deployment completed successfully!"));
        console.log(info("🔗 Contract Chain: SchemaRegistry → EAS → Attester"));
      }
      
      // Generate signup data
      let finalAttestationId = attestationId;
      let signupData: string;
      
      // If createSimpleAttestation flag is set, create an attestation
      if (createSimpleAttestation) {
        // If contracts weren't deployed in this session, try to fetch from deploy config
        if (!deployedContracts.easAddress || !deployedContracts.attester || !deployedContracts.schema) {
          const deployment = Deployment.getInstance();
          deployment.setHre(hre);
          
          // Try to get addresses from deploy config
          try {
            deployedContracts.easAddress = deployedContracts.easAddress || 
              deployment.getDeployConfigField("EASPolicy", "easAddress");
            deployedContracts.attester = deployedContracts.attester || 
              deployment.getDeployConfigField("EASPolicy", "attester");
            deployedContracts.schema = deployedContracts.schema || 
              deployment.getDeployConfigField("EASPolicy", "schema");
          } catch (error) {
            // Config fields might not exist, continue with validation
          }
        }
        
        if (!deployedContracts.easAddress || !deployedContracts.attester || !deployedContracts.schema) {
          throw new Error("Cannot create attestation without deployed EAS contracts. Use --deploy flag first or ensure EAS contracts are configured in deploy-config.json");
        }
        
        console.log(info("📋 Creating simple attestation..."));
        const SimpleAttesterFactory = await hre.ethers.getContractFactory("SimpleAttester");
        const attesterContract = SimpleAttesterFactory.attach(deployedContracts.attester);
        
        // Create attestation with the specified value
        const tx = await (attesterContract as any).attestUint(deployedContracts.schema, attestValue || 0);
        const receipt = await tx.wait();
        
        // Get attestation ID from transaction receipt
        // Look for the Attested event from the EAS contract
        const SimpleEASFactory = await hre.ethers.getContractFactory("SimpleEAS");
        const easContract = SimpleEASFactory.attach(deployedContracts.easAddress);
        
        const attestedEvent = receipt?.logs.find((log: any) => {
          try {
            const parsed = easContract.interface.parseLog(log);
            return parsed?.name === "Attested";
          } catch {
            return false;
          }
        });
        
        if (attestedEvent) {
          const parsed = easContract.interface.parseLog(attestedEvent);
          finalAttestationId = parsed?.args.uid;
          logGreen({ text: `✅ Attestation created with ID: ${finalAttestationId}` });
          console.log(info(`   Attested value: ${attestValue || 0}`));
        } else {
          throw new Error("Failed to get attestation ID from transaction");
        }
      }
      
      // Generate signup data based on attestation ID
      if (finalAttestationId) {
        // Validate attestation ID format
        if (!finalAttestationId.match(/^0x[a-fA-F0-9]{64}$/)) {
          throw new Error("Invalid attestation ID format. Must be bytes32 hex string (0x...)");
        }
        
        // Create signup data with custom attestation ID (only attestation ID, no signature)
        const abiCoder = new hre.ethers.AbiCoder();
        signupData = abiCoder.encode(
          ["bytes32"],
          [finalAttestationId]
        );
        
        console.log(info(`Using custom attestation ID: ${finalAttestationId}`));
      } else {
        // THROW ERROR
        throw new Error("No attestation ID provided");
      }
      
      logGreen({ text: `✅ EAS signup data generated successfully!` });
      console.log(info(`Data: ${signupData}`));
      console.log(info(`Length: ${signupData.length} characters`));
      
        if (updateConfig) {
        await updateDeployConfig("EAS", signupData, deployedContracts, hre);
        await updateAccountConfigWithPolicyEvidence(account, "EAS", signupData, hre);
        logGreen({ text: `✅ Deploy and account config updated with EASPolicy` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"EASPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "EASPolicyEvidence": "${signupData}"`);
        console.log(`  "easAddress": "${deployedContracts.easAddress || '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'}",`);
        console.log(`  "schema": "${deployedContracts.schema || '0xe2636f31239f7948afdd9a9c477048b7fc2a089c347af60e3aa1251e5bf63e5c'}",`);
        console.log(`  "attester": "${deployedContracts.attester || 'the-attester-address'}"`);
        console.log(`}`);
        console.log("\n" + info("Usage examples:"));
        console.log("npx hardhat generate-eas-data --deploy --update-config");
        console.log("npx hardhat generate-eas-data --attestation-id 0x1234567890abcdef... --update-config");
        console.log("npx hardhat generate-eas-data --deploy --create-simple-attestation --attest-value 42 --update-config");
        console.log("npx hardhat generate-eas-data --account 0  # Save to account 0");
      }
      
    } catch (error) {
      console.error(`❌ Error generating EAS policy data: ${(error as Error).message}`);
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
    
    console.log(info(`Updated ${networkName}.${policyKey} in deploy-config.json`));
    
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
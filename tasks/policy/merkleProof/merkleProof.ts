/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { logGreen, logYellow, info, logRed } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

/**
 * Generate MerkleProof policy data task
 */
task("generate-merkle-proof-data", "Generate signup data for MerkleProof policy")
  .addFlag("createTree", "Create a new Merkle tree and save it as tree.json")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .addOptionalParam("whitelist", "Path to JSON file containing whitelisted addresses", undefined, types.string)
  .addOptionalParam("treeFile", "Path to the tree.json file", "./tree.json", types.string)
  .addOptionalParam("address", "Address to generate proof for (defaults to current signer)", undefined, types.string)
  .setAction(async ({ 
    createTree,
    updateConfig,
    whitelist,
    treeFile,
    address
  }, hre) => {
    try {
      console.log(info(`Generating signup data for MerkleProof policy...`));
      
      let merkleRoot = "";
      let signupData = "";
      
      // Step 1: Create tree if requested
      if (createTree) {
        console.log(info("🌳 Creating Merkle tree..."));
        
        let addresses: string[] = [];
        
        if (whitelist) {
          // Read addresses from whitelist file
          const whitelistPath = path.resolve(whitelist);
          if (!fs.existsSync(whitelistPath)) {
            throw new Error(`Whitelist file not found at ${whitelistPath}`);
          }
          
          const whitelistContent = fs.readFileSync(whitelistPath, "utf8");
          const whitelistData = JSON.parse(whitelistContent);
          
          if (Array.isArray(whitelistData)) {
            addresses = whitelistData;
          } else if (whitelistData.addresses && Array.isArray(whitelistData.addresses)) {
            addresses = whitelistData.addresses;
          } else {
            throw new Error("Invalid whitelist format. Expected array of addresses or object with 'addresses' field");
          }
          
          console.log(info(`📋 Loaded ${addresses.length} addresses from whitelist`));
        } else {
          // Use default signer address
          const [signer] = await hre.ethers.getSigners();
          addresses = [signer.address];
          console.log(info(`📋 Using default signer address: ${signer.address}`));
        }
        
        // Validate addresses
        addresses.forEach((addr, index) => {
          if (!hre.ethers.isAddress(addr)) {
            throw new Error(`Invalid address at index ${index}: ${addr}`);
          }
        });
        
        // Create the Merkle tree with address encoding
        const tree = StandardMerkleTree.of(
          addresses.map(addr => [addr]),
          ["address"]
        );
        
        merkleRoot = tree.root;
        
        // Save tree to file
        const treeData = tree.dump();
        const treePath = path.resolve(treeFile);
        fs.writeFileSync(treePath, JSON.stringify(treeData, null, 2));
        
        logGreen({ text: `✅ Merkle tree created and saved to ${treePath}` });
        console.log(info(`🌲 Tree root: ${merkleRoot}`));
        console.log(info(`📊 Tree contains ${addresses.length} addresses`));
      }
      
      // Step 2: Generate signup data (proof)
      console.log(info("🔑 Generating Merkle proof..."));
      
      // Load tree
      const treePath = path.resolve(treeFile);
      if (!fs.existsSync(treePath)) {
        throw new Error(`Tree file not found at ${treePath}. Run with --create-tree first or put location of your tree.json.`);
      }
      
      const treeContent = fs.readFileSync(treePath, "utf8");
      const treeData = JSON.parse(treeContent);
      const tree = StandardMerkleTree.load(treeData);
      
      if (!merkleRoot) {
        merkleRoot = tree.root;
      }
      
      // Determine address to generate proof for
      let targetAddress = address;
      if (!targetAddress) {
        const [signer] = await hre.ethers.getSigners();
        targetAddress = signer.address;
      }
      
      console.log(info(`🎯 Generating proof for address: ${targetAddress}`));
      
      // Find the address in the tree and generate proof
      let proof: string[] | null = null;
      for (const [i, v] of tree.entries()) {
        if (v[0].toLowerCase() === targetAddress.toLowerCase()) {
          proof = tree.getProof(i);
          console.log(info(`✅ Found address at index ${i}`));
          break;
        }
      }
      
      if (!proof) {
        throw new Error(`Address ${targetAddress} not found in the Merkle tree. Make sure it's in the whitelist.`);
      }
      
      // Encode the proof for contract
      const abiCoder = new hre.ethers.AbiCoder();
      signupData = abiCoder.encode(["bytes32[]"], [proof]);
      
      logGreen({ text: `✅ MerkleProof signup data generated successfully!` });
      console.log(info(`📝 Proof: [${proof.map(p => `"${p}"`).join(", ")}]`));
      console.log(info(`📦 Encoded data: ${signupData}`));
      console.log(info(`📏 Length: ${signupData.length} characters`));
      
      // Step 3: Update config if requested
      if (updateConfig) {
        await updateDeployConfig("MerkleProof", signupData, { root: merkleRoot }, hre);
        logGreen({ text: `✅ Deploy config updated with MerkleProofPolicy signupDataHex and root` });
      } else {
        console.log("\n" + info("To update deploy-config.json, run with --update-config"));
        console.log("\n" + info("Manual config entry:"));
        console.log(`"MerkleProofPolicy": {`);
        console.log(`  "deploy": true,`);
        console.log(`  "signupDataHex": "${signupData}",`);
        console.log(`  "root": "${merkleRoot}"`);
        console.log(`}`);
      }
      
      // Usage examples
      console.log("\n" + info("📚 Usage examples:"));
      console.log("# Create tree with default signer and generate proof:");
      console.log("npx hardhat generate-merkle-proof-data --create-tree --update-config");
      console.log("\n# Create tree from whitelist file:");
      console.log("npx hardhat generate-merkle-proof-data --create-tree --whitelist ./whitelist.json --update-config");
      console.log("\n# Generate proof for specific address from existing tree:");
      console.log("npx hardhat generate-merkle-proof-data --address 0x1234... --tree-file ./tree.json");
      console.log("\n# Use custom tree file location:");
      console.log("npx hardhat generate-merkle-proof-data --create-tree --tree-file ./custom-tree.json");
      
    } catch (error) {
      logRed({ text: `❌ Error: ${(error as Error).message}` });
      throw error;
    }
  });

/**
 * Update deploy config with generated signup data and merkle root
 */
async function updateDeployConfig(policy: string, signupData: string, deployedContracts: any, hre: any): Promise<void> {
  const deployment = Deployment.getInstance();
  deployment.setHre(hre);
  
  const configPath = path.resolve(__dirname, "../../../deploy-config.json");
  
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
    
    // Update merkle root if available
    if (deployedContracts.root) {
      config[networkName][policyKey].root = deployedContracts.root;
    }
    
    // Write back to file with proper formatting
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(info(`Updated ${networkName}.${policyKey}.signupDataHex in deploy-config.json`));
    console.log(info(`Updated ${networkName}.${policyKey}.root in deploy-config.json`));
    
  } catch (error) {
    throw new Error(`Error updating deploy config: ${(error as Error).message}`);
  }
} 
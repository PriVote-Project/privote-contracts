/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";

import { Keypair, PrivateKey } from "@maci-protocol/domainobjs";
import { Deployment } from "@maci-protocol/contracts";
import { info, logGreen, logRed, logYellow } from "@maci-protocol/contracts";

interface AccountConfig {
  [accountIndex: string]: {
    signerAddress: string;
    maciPrivateKey: string;
    maciPublicKey: string;
    // Policy evidence fields
    FreeForAllPolicyEvidence?: string;
    AnonAadhaarPolicyEvidence?: string;
    EASPolicyEvidence?: string;
    MerkleProofPolicyEvidence?: string;
    TokenPolicyEvidence?: string;
    ERC20PolicyEvidence?: string;
    SemaphorePolicyEvidence?: string;
    ZupassPolicyEvidence?: string;
    HatsPolicyEvidence?: string;
    GitcoinPassportPolicyEvidence?: string;
    ERC20VotesPolicyEvidence?: string;
  };
}

const ACCOUNT_CONFIG_PATH = path.resolve(__dirname, "../../account-config.json");

/**
 * Load account configuration from file
 */
function loadAccountConfig(): AccountConfig {
  if (!fs.existsSync(ACCOUNT_CONFIG_PATH)) {
    logYellow({ text: `Account config file not found at ${ACCOUNT_CONFIG_PATH}. Creating new one...` });
    fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify({}, null, 2));
    return {};
  }
  
  try {
    const content = fs.readFileSync(ACCOUNT_CONFIG_PATH, "utf8");
    return JSON.parse(content);
  } catch (error) {
    logRed({ text: `Error reading account config: ${(error as Error).message}` });
    return {};
  }
}

/**
 * Save account configuration to file
 */
function saveAccountConfig(config: AccountConfig): void {
  try {
    fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify(config, null, 2));
    logGreen({ text: `Account config saved to ${ACCOUNT_CONFIG_PATH}` });
  } catch (error) {
    logRed({ text: `Error saving account config: ${(error as Error).message}` });
    throw error;
  }
}

/**
 * Generate deterministic MACI keypair from signer signature
 */
async function generateDeterministicKeypair(
  signer: any,
  signerAddress: string,
  hre: any
): Promise<{ privateKey: string; publicKey: string }> {

  let message;
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    message = `Login to PriVote with address ${signerAddress}`;
  } else {
    message = `Login to https://privote.live`;
  }

  try {
    // Sign the message
    const signature = await signer.signMessage(message);
    
    // Use the signature hash as seed for the private key
    // We'll hash the signature to get a 32-byte value
    const signatureHash = await hre.ethers.solidityPackedKeccak256(["string"], [signature]);
    
    // Convert to BigInt for MACI PrivateKey constructor
    const privateKeyBigInt = BigInt(signatureHash);
    
    // Create MACI private key from BigInt
    const maciPrivateKey = new PrivateKey(privateKeyBigInt);
    const maciKeypair = new Keypair(maciPrivateKey);
    
    
    // Validate the generated private key
    if (!PrivateKey.isValidSerialized(maciKeypair.privateKey.serialize())) {
      throw new Error("Generated private key is invalid");
    }
    
    return {
      privateKey: maciKeypair.privateKey.serialize(),
      publicKey: maciKeypair.publicKey.serialize(),
    };
  } catch (error) {
    throw new Error(`Failed to generate deterministic keypair: ${(error as Error).message}`);
  }
}

/**
 * Create account config task - generates deterministic MACI keypair for a given signer
 */
task("create-account-config", "Create account config with deterministic MACI keypair for a signer")
  .addParam("account", "Account index (signer order)", undefined, types.string)
  .setAction(async ({ account }, hre) => {
    try {
      // Get all available signers
      const signers = await hre.ethers.getSigners();
      const accountIndex = parseInt(account);
      
      if (accountIndex >= signers.length) {
        throw new Error(`Account index ${accountIndex} exceeds available signers (${signers.length}). Available indices: 0-${signers.length - 1}`);
      }
      
      const signer = signers[accountIndex];
      const signerAddress = await signer.getAddress();
      
      console.log(info(`Creating account config for signer ${accountIndex}: ${signerAddress}`));
      
      // Load existing config
      let config = loadAccountConfig();
      
      // Check if account already exists and signer matches
      if (config[account] && config[account].signerAddress === signerAddress) {
        console.log(info(`ℹ️  Account ${account} already exists with matching signer address`));
        logGreen({ text: `✅ Account config already up to date` });
        return config[account];
      }
      
      // Generate deterministic keypair from signer signature
      console.log(info(`🔐 Generating deterministic MACI keypair for ${signerAddress}...`));
      console.log(info(`📝 Please sign the message to generate your deterministic MACI keypair`));
      
      const keypairData = await generateDeterministicKeypair(signer, signerAddress, hre);
      
      // Update config
      config[account] = {
        signerAddress,
        maciPrivateKey: keypairData.privateKey,
        maciPublicKey: keypairData.publicKey,
      };
      
      // Save config
      saveAccountConfig(config);
      
      logGreen({ text: `✅ Account config created successfully!` });
      logGreen({ text: `   Account Index: ${account}` });
      logGreen({ text: `   Signer Address: ${signerAddress}` });
      logGreen({ text: `   MACI Public Key: ${keypairData.publicKey}` });
      
      return config[account];
      
    } catch (error) {
      logRed({ text: `❌ Create account config failed: ${(error as Error).message}` });
      throw error;
    }
  });

/**
 * Update account config with policy evidence
 */
async function updateAccountConfigWithPolicyEvidence(
  account: string,
  policyName: string,
  evidence: string,
  hre: any
): Promise<void> {
  try {
    // Ensure account config exists
    let config = loadAccountConfig();
    
    if (!config[account]) {
      console.log(info(`Account ${account} not found in config. Creating account config...`));
      await hre.run("create-account-config", { account });
      config = loadAccountConfig(); // Reload after creation
    }
    
    if (!config[account]) {
      throw new Error(`Failed to create account config for account ${account}`);
    }
    
    // Update the policy evidence field
    const evidenceField = `${policyName}PolicyEvidence` as keyof AccountConfig[string];
    config[account][evidenceField] = evidence;
    
    // Save config
    saveAccountConfig(config);
    
    logGreen({ text: `✅ Updated ${policyName}PolicyEvidence for account ${account}` });
    console.log(info(`   Evidence: ${evidence}`));
    
  } catch (error) {
    logRed({ text: `❌ Failed to update account config: ${(error as Error).message}` });
    throw error;
  }
}

// Export functions for use by other tasks
export { 
  loadAccountConfig, 
  saveAccountConfig, 
  generateDeterministicKeypair, 
  updateAccountConfigWithPolicyEvidence,
  ACCOUNT_CONFIG_PATH 
}; 
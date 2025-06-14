/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";

import { Keypair, PrivateKey, PublicKey } from "@maci-protocol/domainobjs";
import { ContractStorage, EContracts, Deployment } from "@maci-protocol/contracts";
import { info, logGreen, logRed, logYellow } from "@maci-protocol/contracts";
import { FULL_POLICY_NAMES } from "@maci-protocol/contracts/build/tasks/helpers/constants";
import { CustomEContracts } from "../helpers/constants";
import { Privote } from "../../typechain-types";

interface SignupConfig {
  [accountNumber: string]: {
    privateKey: string;
    publicKey: string;
    signupPolicyData: string;
  };
}

const SIGNUP_CONFIG_PATH = path.resolve(__dirname, "../../signup-config.json");

/**
 * Load signup configuration from file
 */
function loadSignupConfig(): SignupConfig {
  if (!fs.existsSync(SIGNUP_CONFIG_PATH)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(SIGNUP_CONFIG_PATH, "utf8");
    return JSON.parse(content);
  } catch (error) {
    logRed({ text: `Error reading signup config: ${(error as Error).message}` });
    return {};
  }
}

/**
 * Save signup configuration to file
 */
function saveSignupConfig(config: SignupConfig): void {
  try {
    fs.writeFileSync(SIGNUP_CONFIG_PATH, JSON.stringify(config, null, 2));
    logGreen({ text: `Signup config saved to ${SIGNUP_CONFIG_PATH}` });
  } catch (error) {
    logRed({ text: `Error saving signup config: ${(error as Error).message}` });
    throw error;
  }
}

/**
 * Generate a new MACI keypair
 */
function generateKeypair(): { privateKey: string; publicKey: string } {
  const keypair = new Keypair();
  return {
    privateKey: keypair.privateKey.serialize(),
    publicKey: keypair.publicKey.serialize(),
  };
}

/**
 * Get policy data based on deploy configuration
 */
async function getPolicyData(deployment: Deployment): Promise<string> {
  try {
    // Get the policy from MACI config, similar to poll.ts
    const maciPolicy = deployment.getDeployConfigField<EContracts | null>(EContracts.MACI, "policy") || EContracts.FreeForAllPolicy;
    
    // Check which policies are enabled (deploy: true) using FULL_POLICY_NAMES
    const availablePolicies = Object.keys(FULL_POLICY_NAMES) as EContracts[];

    for (const policy of availablePolicies) {
      const isEnabled = deployment.getDeployConfigField<boolean>(policy, "deploy");
      
      if (isEnabled === true) {
        if (policy === EContracts.FreeForAllPolicy) {
          console.log("ℹ️  Using FreeForAllPolicy - no policy data required");
          return "0x";
        } else {
          logYellow({ text: `Policy ${policy} is enabled but policy data implementation is pending` });
          // TODO: Implement policy-specific data generation
          // For example:
          // - ERC20Policy: could return encoded token balance proof
          // - MerkleProofPolicy: could return merkle proof data
          // - EASPolicy: could return attestation data
          return "0x";
        }
      }
    }

    // Fallback to MACI policy if no explicit policy is enabled
    if (maciPolicy === EContracts.FreeForAllPolicy) {
      console.log("ℹ️  Using default FreeForAllPolicy from MACI config - no policy data required");
      return "0x";
    }

    logYellow({ text: "No policy found enabled, using default policy data" });
    return "0x";
  } catch (error) {
    logYellow({ text: `Error reading deploy config: ${(error as Error).message}, using default policy data` });
    return "0x";
  }
}

/**
 * Get next available account number
 */
function getNextAccountNumber(config: SignupConfig): string {
  let index = 0;
  while (config[index.toString()]) {
    index++;
  }
  return index.toString();
}

/**
 * Signup task for Privote contract
 */
task("signup", "Sign up to Privote with a MACI keypair")
  .addOptionalParam("account", "Account number to use (default: 0)", "0", types.string)
  .addFlag("new", "Always generate a new keypair")
  .setAction(async ({ account, new: generateNew }, hre) => {
    const storage = ContractStorage.getInstance();
    const deployment = Deployment.getInstance();
    deployment.setHre(hre);
    
    try {
      // Get Privote contract using deployment pattern similar to poll.ts
      const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, hre.network.name);
      const privote = await deployment.getContract<Privote>({ 
        name: CustomEContracts.Privote as any,
        address: privoteContractAddress
      });
      
      console.log(info(`Using Privote contract at: ${privoteContractAddress}`));

      // Load existing config
      let config = loadSignupConfig();
      
      let accountNumber = account;
      let keypairData: { privateKey: string; publicKey: string };
      
      if (generateNew) {
        // Generate new keypair and find next available account number
        accountNumber = getNextAccountNumber(config);
        keypairData = generateKeypair();
        logGreen({ text: `Generated new keypair for account ${accountNumber}` });
      } else if (config[accountNumber]) {
        // Use existing keypair
        keypairData = {
          privateKey: config[accountNumber].privateKey,
          publicKey: config[accountNumber].publicKey
        };
        console.log(`ℹ️  Using existing keypair for account ${accountNumber}`);
      } else {
        // Generate new keypair for specified account
        keypairData = generateKeypair();
        logGreen({ text: `Generated new keypair for account ${accountNumber}` });
      }

      // Get policy data using deployment instance
      const signupPolicyData = await getPolicyData(deployment);
      
      // Update config
      config[accountNumber] = {
        privateKey: keypairData.privateKey,
        publicKey: keypairData.publicKey,
        signupPolicyData
      };
      
      // Save config
      saveSignupConfig(config);

      // Create PublicKey object for contract call
      const publicKey = PublicKey.deserialize(keypairData.publicKey);
      const publicKeyStruct = publicKey.asContractParam();

      console.log(info(`Signing up with public key: ${keypairData.publicKey}`));
      console.log(info(`Using policy data: ${signupPolicyData}`));

      // Call signup function
      const tx = await privote.signUp(publicKeyStruct, signupPolicyData);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      logGreen({ text: `✅ Successfully signed up!` });
      logGreen({ text: `   Account: account ${accountNumber}` });
      logGreen({ text: `   Public Key: ${keypairData.publicKey}` });
      logGreen({ text: `   Transaction Hash: ${receipt.hash}` });
      logGreen({ text: `   Gas Used: ${receipt.gasUsed.toString()}` });

      // Log the signup event details
      if (receipt.logs.length > 0) {
        try {
          const signupEvent = receipt.logs.find((log: any) => {
            try {
              const parsed = privote.interface.parseLog(log);
              return parsed?.name === "SignUp";
            } catch {
              return false;
            }
          });

          if (signupEvent) {
            const parsed = privote.interface.parseLog(signupEvent);
            console.log(info(`   State Index: ${parsed?.args.stateIndex.toString()}`));
          }
        } catch (error) {
          // Ignore event parsing errors
        }
      }

    } catch (error) {
      logRed({ text: `❌ Signup failed: ${(error as Error).message}` });
      throw error;
    }
  }); 
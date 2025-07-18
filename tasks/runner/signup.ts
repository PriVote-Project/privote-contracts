/* eslint-disable no-console */
import { task, types } from "hardhat/config";

import { PublicKey } from "@maci-protocol/domainobjs";
import { ContractStorage, Deployment } from "@maci-protocol/contracts";
import { info, logGreen, logRed, logYellow } from "@maci-protocol/contracts";
import { CustomEContracts } from "../helpers/constants";
import { loadAccountConfig } from "./create-account-config";
import { Privote } from "../../typechain-types";

/**
 * Get policy data dynamically from Privote contract's signUpPolicy
 */
async function getPolicyData(
  privoteContract: any,
  accountConfig: any,
  hre: any
): Promise<string> {
  try {
    // Get the signUpPolicy address from Privote contract
    const policyAddress = await privoteContract.signUpPolicy();
    
    // Get policy contract instance
    const policyContract = await hre.ethers.getContractAt("IBasePolicy", policyAddress);
    
    // Call trait() to get the policy type
    const policyTrait = await policyContract.trait();
    
    console.log(info(`Policy trait detected: ${policyTrait}`));

    // Look for policy evidence in account config
    const evidenceField = `${policyTrait}PolicyEvidence`;
    const policyEvidence = accountConfig[evidenceField];
    
    if (policyEvidence) {
      console.log(info(`Using ${policyTrait} policy evidence from account config: ${policyEvidence}`));
      return policyEvidence;
    }
    
    // Default to "0x" if no evidence found
    console.log(info(`No ${evidenceField} found in account config, using default "0x"`));
    if (policyTrait !== "FreeForAll") {
      logYellow({ text: `To generate evidence, run: npx hardhat generate-${policyTrait.toLowerCase()}-data --account <account> --update-config` });
    }
    return "0x";
    
  } catch (error) {
    logYellow({ text: `Error determining policy signup data: ${(error as Error).message}, using default "0x"` });
    return "0x";
  }
}

/**
 * Signup task for Privote contract with deterministic MACI keypairs tied to signer addresses
 */
task("signup", "Sign up to Privote with a deterministic MACI keypair tied to signer address")
  .addOptionalParam("account", "Account index (signer order, default: 0)", "0", types.string)
  .setAction(async ({ account }, hre) => {
    const storage = ContractStorage.getInstance();
    const deployment = Deployment.getInstance();
    deployment.setHre(hre);
    
    try {
      // Check if account config exists, if not create it
      let config = loadAccountConfig();
      
      if (!config[account]) {
        console.log(info(`Account ${account} not found in config. Creating account config...`));
        await hre.run("create-account-config", { account });
        config = loadAccountConfig(); // Reload after creation
      }
      
      const accountConfig = config[account];
      if (!accountConfig) {
        throw new Error(`Failed to create account config for account ${account}`);
      }
      
      console.log(info(`Using account ${account}: ${accountConfig.signerAddress}`));
      
      // Get Privote contract using direct contract instantiation to avoid type issues
      const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, hre.network.name);
      if (!privoteContractAddress) {
        throw new Error("Privote contract address not found");
      }
      
      // Get the signer for this account
      const signers = await hre.ethers.getSigners();
      const accountIndex = parseInt(account);
      
      if (accountIndex >= signers.length) {
        throw new Error(`Account index ${accountIndex} exceeds available signers (${signers.length}). Available indices: 0-${signers.length - 1}`);
      }

      const signer = signers[accountIndex];

      // const privote = await hre.ethers.getContractAt(CustomEContracts.Privote, privoteContractAddress, signer);
      const privote = await deployment.getContract<Privote>({
        name: CustomEContracts.Privote as any,
        address: privoteContractAddress,
        signer: signer
      });
      console.log(info(`Using Privote contract at: ${privoteContractAddress}`));

      // Create PublicKey object for contract call
      const publicKey = PublicKey.deserialize(accountConfig.maciPublicKey);
      const publicKeyStruct = publicKey.asContractParam();

      // Get policy data dynamically from contract
      const policyData = await getPolicyData(privote, accountConfig, hre);

      console.log(info(`📤 Signing up with MACI public key: ${accountConfig.maciPublicKey}`));
      console.log(info(`🔒 Using policy data: ${policyData}`));

      // Call signup function with the signer
      const tx = await privote.signUp(publicKeyStruct, policyData);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      logGreen({ text: `✅ Successfully signed up!` });
      logGreen({ text: `   Account Index: ${account}` });
      logGreen({ text: `   Signer Address: ${accountConfig.signerAddress}` });
      logGreen({ text: `   MACI Public Key: ${accountConfig.maciPublicKey}` });
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
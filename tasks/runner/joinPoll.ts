/* eslint-disable no-console */
import { task, types } from "hardhat/config";

import { joinPoll } from "@maci-protocol/sdk";
import { ContractStorage, EContracts, Deployment } from "@maci-protocol/contracts";
import { info, logGreen, logRed, logYellow } from "@maci-protocol/contracts";
import { CustomEContracts } from "../helpers/constants";
import { loadAccountConfig } from "./create-account-config";
import { Privote } from "../../typechain-types";

/**
 * Get policy signup data based on poll's policy contract
 */
async function getPolicySignupData(
  pollContract: any,
  accountConfig: any,
  hre: any
): Promise<string> {
  try {
    // Get the policy contract from poll's extContracts
    const policyAddress = await pollContract.extContracts().then((extContracts: any) => extContracts.policy);
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
 * Join poll task
 */
task("join-poll", "Join a poll using MACI keypair")
  .addParam("poll", "The poll ID to join", undefined, types.string)
  .addOptionalParam("account", "Account number to use (default: 0)", "0", types.string)
  .addOptionalParam("startBlock", "The block number to start fetching logs from", undefined, types.int)
  .addOptionalParam("blocksPerBatch", "The number of blocks to fetch logs from", 500, types.int)
  .addOptionalParam("useWasm", "Whether to use wasm or rapidsnark (default: true)", true, types.boolean)
  .addOptionalParam("rapidsnark", "Rapidsnark binary path", undefined, types.string)
  .addOptionalParam("pollWitnessGenerator", "Poll witness generator binary path", undefined, types.string)
  .setAction(async ({ 
    poll, 
    account, 
    startBlock, 
    blocksPerBatch,
    useWasm,
    rapidsnark,
    pollWitnessGenerator
  }, hre) => {
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
      
      const { maciPrivateKey: privateKey } = accountConfig;
      
      // Get signer
      const signer = await deployment.getDeployer();
      // Get Privote contract address
      const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, hre.network.name);
      if (privoteContractAddress == undefined) {
        throw new Error(`Privote contract not found at the provided address`);
      }
      
      console.log(info(`Using Privote contract at: ${privoteContractAddress}`));
      
      // Get Privote contract instance to fetch poll data
      const privoteContract = await deployment.getContract<Privote>({
        name: CustomEContracts.Privote as any,
        address: privoteContractAddress
      });
      
      const pollData = await privoteContract.polls(poll);
      const pollContractAddress = pollData.poll;
      
      // Get Poll contract instance
      const pollContract = await hre.ethers.getContractAt("Poll", pollContractAddress);
      
      // Get policy-specific signup data
      const sgDataArg = await getPolicySignupData(pollContract, accountConfig, hre);
      
      // Get deployment configuration for zkey paths
      const pollJoiningZkey = deployment.getDeployConfigField<string>(
        EContracts.VerifyingKeysRegistry,
        "zkeys.pollJoiningZkey.zkey",
        true,
      );
      
      const pollWasm = deployment.getDeployConfigField<string>(
        EContracts.VerifyingKeysRegistry,
        "zkeys.pollJoiningZkey.wasm",
        true,
      );
      
      console.log(info(`Using poll joining zkey: ${pollJoiningZkey}`));
      console.log(info(`Using poll wasm: ${pollWasm}`));
      
      // Determine start block if not provided
      let effectiveStartBlock = startBlock;
    //   if (!effectiveStartBlock) {
    //     effectiveStartBlock = await getMaciDeploymentBlock(hre, maciAddress);
    //     console.log(info(`Using start block: ${effectiveStartBlock}`));
    //   }
      
      console.log(info(`Joining poll ${poll} with account ${account}...`));
      
      // Call joinPoll from SDK
      const result = await joinPoll({
        maciAddress: privoteContractAddress,
        privateKey,
        pollId: BigInt(poll),
        signer,
        startBlock: effectiveStartBlock,
        blocksPerBatch,
        pollJoiningZkey,
        useWasm,
        rapidsnark,
        pollWitnessGenerator,
        pollWasm,
        sgDataArg, // Dynamic policy data instead of hardcoded "0x"
        ivcpDataArg: "0x", // Constant proxy data
      });
      
      logGreen({ text: `✅ Successfully joined poll!` });
      logGreen({ text: `   Poll ID: ${poll}` });
      logGreen({ text: `   Account: ${account}` });
      logGreen({ text: `   Poll State Index: ${result.pollStateIndex}` });
      logGreen({ text: `   Voice Credits: ${result.voiceCredits}` });
      logGreen({ text: `   Nullifier: ${result.nullifier}` });
      logGreen({ text: `   Transaction Hash: ${result.hash}` });
      logGreen({ text: `   Signup Data Used: ${sgDataArg}` });
      
    } catch (error) {
      logRed({ text: `❌ Join poll failed: ${(error as Error).message}` });
      throw error;
    }
  }); 
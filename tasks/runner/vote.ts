/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";

import { VoteCommand } from "@maci-protocol/domainobjs";
import { Keypair, PrivateKey, PublicKey, Message } from "@maci-protocol/domainobjs";
import { ContractStorage, EContracts, Deployment } from "@maci-protocol/contracts";
import { info, logGreen, logRed, logYellow } from "@maci-protocol/contracts";
import { CustomEContracts } from "../helpers/constants";

import type { MACI, Poll, Privote } from "../../typechain-types";

interface SignupConfig {
  [accountNumber: string]: {
    privateKey: string;
    publicKey: string;
    signupPolicyData: string;
  };
}

interface VoteParams {
  optionIndex: number;
  weight: number;
}

const SIGNUP_CONFIG_PATH = path.resolve(__dirname, "../../signup-config.json");

/**
 * Load signup configuration from file
 */
function loadSignupConfig(): SignupConfig {
  if (!fs.existsSync(SIGNUP_CONFIG_PATH)) {
    throw new Error(`Signup config file not found at ${SIGNUP_CONFIG_PATH}. Please run signup task first.`);
  }
  
  try {
    const content = fs.readFileSync(SIGNUP_CONFIG_PATH, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Error reading signup config: ${(error as Error).message}`);
  }
}

/**
 * Parse vote parameters from string format "0:5,1:10" to array of vote objects
 */
function parseVoteParams(votesStr: string): VoteParams[] {
  try {
    const votes: VoteParams[] = [];
    const voteEntries = votesStr.split(',');
    
    for (const entry of voteEntries) {
      const [optionStr, weightStr] = entry.trim().split(':');
      const optionIndex = parseInt(optionStr, 10);
      const weight = parseInt(weightStr, 10);
      
      if (isNaN(optionIndex) || isNaN(weight)) {
        throw new Error(`Invalid vote format: ${entry}`);
      }
      
      if (weight <= 0) {
        throw new Error(`Vote weight must be positive: ${weight}`);
      }
      
      votes.push({ optionIndex, weight });
    }
    
    return votes;
  } catch (error) {
    throw new Error(`Error parsing votes: ${(error as Error).message}. Expected format: "0:5,1:10"`);
  }
}

/**
 * Vote task
 */
task("vote", "Submit votes to a poll")
  .addParam("poll", "The poll ID to vote in", undefined, types.string)
  .addParam("votes", "Vote format: 'optionIndex:weight,optionIndex:weight' (e.g., '0:5,1:10')", undefined, types.string)
  .addOptionalParam("account", "Account number to use (default: 0)", "0", types.string)
  .setAction(async ({ 
    poll, 
    votes,
    account
  }, hre) => {
    const storage = ContractStorage.getInstance();
    const deployment = Deployment.getInstance();
    deployment.setHre(hre);
    
    try {
      // Load signup config to get user's private key
      const config = loadSignupConfig();
      
      if (!config[account]) {
        throw new Error(`Account ${account} not found in signup config. Please run signup task first.`);
      }
      
      const { privateKey, publicKey } = config[account];
      
      // Parse vote parameters
      const voteParams = parseVoteParams(votes);
      console.log(info(`Parsed ${voteParams.length} vote(s):`));
      voteParams.forEach((vote, i) => {
        console.log(info(`  Vote ${i + 1}: Option ${vote.optionIndex} with weight ${vote.weight}`));
      });
      
             // Get signer
       const signer = await deployment.getDeployer();
       
       // Get Privote contract (which inherits from MACI)
       const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, hre.network.name);
       if (!privoteContractAddress) {
         throw new Error("Privote contract not found");
       }
       
       const privoteContract = await deployment.getContract<Privote>({ 
         name: CustomEContracts.Privote as any,
         address: privoteContractAddress
       });
       
       console.log(info(`Using Privote contract at: ${privoteContractAddress}`));
       console.log(info(`Voting in poll ${poll} with account ${account}...`));
       
       // Get poll contract from Privote (which has MACI functionality)
       const pollContracts = await privoteContract.polls(poll);
       const pollContract = await deployment.getContract<Poll>({ 
         name: EContracts.Poll, 
         address: pollContracts.poll 
       });
       
       console.log(info(`Using Poll contract at: ${pollContracts.poll}`));
       
       // Get poll mode and validate votes based on mode
       const pollMode = deployment.getDeployConfigField<number>(EContracts.Poll, "mode", true);
       console.log(info(`Poll mode: ${pollMode} (0=QV, 1=Non-QV, 2=Full)`));
       
       // Validate votes based on poll mode
       if (pollMode === 0) {
         // QV mode: Apply square root to vote weights and floor them
         console.log(info("QV mode detected - applying quadratic voting rules"));
         for (const vote of voteParams) {
           const originalWeight = vote.weight;
           vote.weight = Math.floor(Math.sqrt(vote.weight));
           console.log(info(`  Option ${vote.optionIndex}: ${originalWeight} votes → ${vote.weight} effective votes (√${originalWeight})`));
         }
       } else if (pollMode === 1) {
         // Non-QV mode: Keep original weights
         console.log(info("Non-QV mode detected - using original vote weights"));
       } else if (pollMode === 2) {
         // Full mode: All votes must go to one option
         console.log(info("Full mode detected - validating single option voting"));
         const uniqueOptions = new Set(voteParams.map(v => v.optionIndex));
         if (uniqueOptions.size > 1) {
           throw new Error(`Full mode requires all votes to go to a single option. Found votes for options: ${Array.from(uniqueOptions).join(', ')}`);
         }
         console.log(info(`  All votes going to option ${Array.from(uniqueOptions)[0]} - validation passed`));
       } else {
         throw new Error(`Unknown poll mode: ${pollMode}`);
       }
      
      // Create keypair objects
      const userPrivateKey = PrivateKey.deserialize(privateKey);
      const userKeypair = new Keypair(userPrivateKey);
      const userPublicKey = PublicKey.deserialize(publicKey);
      
      // Get coordinator public key from deployment config
      const coordinatorPubKeyStr = deployment.getDeployConfigField<string>(EContracts.Poll, "coordinatorPublicKey", true);
      const coordinatorPublicKey = PublicKey.deserialize(coordinatorPubKeyStr);
      
      console.log(info(`Using coordinator public key: ${coordinatorPubKeyStr}`));
      
             // Get state index from Privote contract
       const userStateIndex = await privoteContract.getStateIndex(userPublicKey.hash()).catch(() => {
         throw new Error("Could not determine state index. Please ensure user is signed up to MACI.");
       });
       
       console.log(info(`Using state index: ${userStateIndex}`));
      
      // Generate shared key for encryption
      const sharedKey = Keypair.generateEcdhSharedKey(userPrivateKey, coordinatorPublicKey);
      
             // Create vote commands and messages
       // Nonces should be sequential but sent in reverse order, starting from 1
       const messages: [Message, PublicKey][] = [];
       const startingNonce = 1n;
       const totalVotes = voteParams.length;
       
       for (let i = 0; i < voteParams.length; i++) {
         const vote = voteParams[i];
         // Assign nonces in descending order: if we have 3 votes, nonces are 3, 2, 1
         const currentNonce = startingNonce + BigInt(totalVotes - 1 - i);
         
         const command = new VoteCommand(
           userStateIndex,
           userPublicKey, // Keep same public key
           BigInt(vote.optionIndex),
           BigInt(vote.weight),
           currentNonce,
           BigInt(poll)
         );
         
         const signature = command.sign(userPrivateKey);
         const message = command.encrypt(signature, sharedKey);
         messages.push([message, userPublicKey]);
         
         console.log(info(`Created vote command: Option ${vote.optionIndex}, Weight ${vote.weight}, Nonce ${currentNonce}`));
       }
      
      // Submit message batch
      console.log(info(`Submitting batch of ${messages.length} messages...`));
      
      const tx = await pollContract.publishMessageBatch(
        messages.map(([m]) => m.asContractParam()),
        messages.map(([, k]) => k.asContractParam()),
      );
      
      const receipt = await tx.wait();
      
      if (receipt?.status !== 1) {
        throw new Error("Transaction failed");
      }
      
      logGreen({ text: `✅ Successfully submitted votes!` });
      logGreen({ text: `   Poll ID: ${poll}` });
      logGreen({ text: `   Account: ${account}` });
      logGreen({ text: `   Messages sent: ${messages.length}` });
      logGreen({ text: `   Transaction Hash: ${receipt.hash}` });
      logGreen({ text: `   Gas Used: ${receipt.gasUsed.toString()}` });
      
      // Log vote details
      voteParams.forEach((vote, i) => {
        logGreen({ text: `   Vote ${i + 1}: Option ${vote.optionIndex} = ${vote.weight} votes` });
      });
      
    } catch (error) {
      logRed({ text: `❌ Vote submission failed: ${(error as Error).message}` });
      throw error;
    }
  }); 
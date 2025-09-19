/* eslint-disable no-console */
import { ContractStorage } from "@maci-protocol/contracts";
import { EContracts } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";

import type { Poll, Tally } from "../typechain-types";

/**
 * Script to get and display tally results for a submitted poll
 * Usage: npx hardhat run scripts/getTallyResults.ts --network <network>
 * 
 * You can also pass the poll index as an environment variable:
 * POLL_INDEX=0 npx hardhat run scripts/getTallyResults.ts --network localhost
 */

async function main() {
  const deployment = Deployment.getInstance();
  const storage = ContractStorage.getInstance();

  // Get poll index from environment variable or default to 0
  const pollIndex = process.env.POLL_INDEX ? parseInt(process.env.POLL_INDEX) : 2;
  
  console.log(`Getting tally results for poll-${pollIndex}...`);
  console.log("=".repeat(50));

  try {
    // Get the network name from hardhat context
    const hre = await import("hardhat");
    const networkName = hre.network.name;

    // Get poll contract address
    const pollContractAddress = storage.mustGetAddress(EContracts.Poll, networkName, `poll-${pollIndex}`);
    console.log(`Poll contract address: ${pollContractAddress}`);

    // Get tally contract address  
    const tallyContractAddress = storage.mustGetAddress(EContracts.Tally, networkName, `poll-${pollIndex}`);
    console.log(`Tally contract address: ${tallyContractAddress}`);

    // Initialize deployment with hardhat runtime environment
    deployment.setHre(hre);

    // Get poll contract instance
    const pollContract = await deployment.getContract<Poll>({
      name: EContracts.Poll,
      address: pollContractAddress,
    });

    // Get tally contract instance
    const tallyContract = await deployment.getContract<Tally>({
      name: EContracts.Tally,
      address: tallyContractAddress,
    });

    // Get the number of vote options in the poll
    const voteOptions = await pollContract.voteOptions();
    console.log(`Number of vote options: ${voteOptions}`);

    // Get total tally results count to verify
    const totalTallyResults = await tallyContract.totalTallyResults();
    console.log(`Total tally results stored: ${totalTallyResults}`);

    console.log("\nTally Results:");
    console.log("-".repeat(50));

    // Iterate through each vote option and get tally results
    for (let i = 0; i < Number(voteOptions); i++) {
      try {
        const tallyResult = await tallyContract.getTallyResults(i);
        
        if (tallyResult.isSet) {
          console.log(`Option ${i}: ${tallyResult.value} votes`);
        } else {
          console.log(`Option ${i}: Not set (no tally result available)`);
        }
      } catch (error) {
        console.log(`Option ${i}: Error retrieving result - ${error}`);
      }
    }

    // Also check if we have more tally results than vote options
    if (Number(totalTallyResults) > Number(voteOptions)) {
      console.log("\nAdditional tally results beyond vote options:");
      console.log("-".repeat(50));
      
      for (let i = Number(voteOptions); i < Number(totalTallyResults); i++) {
        try {
          const tallyResult = await tallyContract.getTallyResults(i);
          
          if (tallyResult.isSet) {
            console.log(`Index ${i}: ${tallyResult.value}`);
          } else {
            console.log(`Index ${i}: Not set`);
          }
        } catch (error) {
          console.log(`Index ${i}: Error retrieving result - ${error}`);
        }
      }
    }

    // Get additional poll information
    console.log("\nPoll Information:");
    console.log("-".repeat(50));
    
    try {
      const [totalSignups, numMsgs] = await pollContract.totalSignupsAndMessages();
      console.log(`Total signups: ${totalSignups}`);
      console.log(`Total messages: ${numMsgs}`);
      
      const isTallied = await tallyContract.isTallied();
      console.log(`Is tally complete: ${isTallied}`);
      
      const tallyCommitment = await tallyContract.tallyCommitment();
      console.log(`Tally commitment: ${tallyCommitment}`);
      
      const totalSpent = await tallyContract.totalSpent();
      console.log(`Total spent voice credits: ${totalSpent}`);
      
    } catch (error) {
      console.log(`Error getting additional poll info: ${error}`);
    }

  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main };
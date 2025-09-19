/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import { ContractStorage } from "@maci-protocol/contracts";
import { EContracts } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import type { Poll, Tally, Privote } from "../../typechain-types";
import { CustomEContracts } from "../helpers/constants";

async function getTallyResults(pollId: number, privoteAddress?: string): Promise<void> {
  const deployment = Deployment.getInstance();
  const storage = ContractStorage.getInstance();

  const hre = await import("hardhat");
  const networkName = hre.network.name;
  console.log("networkName", networkName);
  // Get Privote contract address
  const privoteContractAddress = privoteAddress || storage.mustGetAddress(CustomEContracts.Privote, networkName);
  
  // Get Privote contract
  const privoteContract = await deployment.getContract<Privote>({
    name: CustomEContracts.Privote as any,
    address: privoteContractAddress,
  });

  // Get poll contracts
  const pollContracts = await privoteContract.polls(pollId);
  
  // Get poll and tally contracts
  const pollContract = await deployment.getContract<Poll>({
    name: EContracts.Poll,
    address: pollContracts.poll,
  });

  const tallyContract = await deployment.getContract<Tally>({
    name: EContracts.Tally,
    address: pollContracts.tally,
  });

  // Get vote options count
  const voteOptions = await pollContract.voteOptions();
  
  console.log(`\nPoll ${pollId} Results:`);
  console.log("-".repeat(30));
  
  // Log results for each option
  for (let i = 0; i < Number(voteOptions); i++) {
    const tallyResult = await tallyContract.getTallyResults(i);
    if (tallyResult.isSet) {
      console.log(`Option ${i}: ${tallyResult.value} votes`);
    } else {
      console.log(`Option ${i}: No votes`);
    }
  }
}

task("get-tally-results", "Get tally results for a poll")
  .addParam("pollId", "The poll ID", undefined, types.int)
  .addOptionalParam("privoteAddress", "Privote contract address", undefined, types.string)
  .setAction(async ({ pollId, privoteAddress }, hre) => {
    const deployment = Deployment.getInstance();
    deployment.setHre(hre);
    await getTallyResults(pollId, privoteAddress);
  });
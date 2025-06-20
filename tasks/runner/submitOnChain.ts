/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import { task, types } from "hardhat/config";

import fs from "fs";

import type { Proof } from "@maci-protocol/contracts";
import type { VerifyingKeysRegistry, Verifier, MACI, Poll, MessageProcessor, Tally, Privote } from "../../typechain-types";

import { logMagenta, info } from "@maci-protocol/contracts";
import { readProofs } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { Prover } from "@maci-protocol/contracts";
import { EContracts, TallyData } from "@maci-protocol/contracts";
import { type ISubmitOnChainParams } from "@maci-protocol/contracts/build/tasks/helpers/types";
import { CustomEContracts } from "../helpers/constants";

/**
 * Prove hardhat task for submitting proofs on-chain as well as uploading tally results
 */
task("submitOnChain", "Command to prove the result of a poll on-chain")
  .addParam("poll", "The poll id", undefined, types.string)
  .addParam("outputDir", "Output directory for proofs", undefined, types.string)
  .addParam("tallyFile", "The file to store the tally proof", undefined, types.string)
  .setAction(async ({ outputDir, poll, tallyFile }: ISubmitOnChainParams, hre) => {
    const deployment = Deployment.getInstance();
    deployment.setHre(hre);
    deployment.setContractNames(EContracts);

    const storage = ContractStorage.getInstance();
    // if we do not have the output directory just create it
    const isOutputDirExists = fs.existsSync(outputDir);

    if (!isOutputDirExists) {
      // Create the directory
      throw new Error(
        `Output directory ${outputDir} does not exist. You must provide a valid directory containing the poll zk-SNARK proofs.`,
      );
    }

    const signer = await deployment.getDeployer();
    const { network } = hre;

    const startBalance = await signer.provider!.getBalance(signer);

    logMagenta({ text: info(`Start balance: ${Number(startBalance / 10n ** 12n) / 1e6}`) });

    const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, network.name);
    if (!privoteContractAddress) {
      throw new Error("Privote contract not found");
    }
    const [privoteContract, verifyingKeysRegistryContract, verifierContract] = await Promise.all([
      deployment.getContract<Privote>({
        name: CustomEContracts.Privote as any,
        address: privoteContractAddress,
      }),
      deployment.getContract<VerifyingKeysRegistry>({ name: EContracts.VerifyingKeysRegistry }),
      deployment.getContract<Verifier>({ name: EContracts.Verifier }),
    ]);

    const pollContracts = await privoteContract.polls(poll);
    const pollContract = await deployment.getContract<Poll>({
      name: EContracts.Poll,
      address: pollContracts.poll,
    });

    const [isStateAqMerged, messageProcessorContract, tallyContract] = await Promise.all([
      pollContract.stateMerged(),
      deployment.getContract<MessageProcessor>({
        name: EContracts.MessageProcessor,
        address: pollContracts.messageProcessor,
      }),
      deployment.getContract<Tally>({
        name: EContracts.Tally,
        address: pollContracts.tally,
      }),
    ]);

    // Check that the state and message trees have been merged for at least the first poll
    if (!isStateAqMerged && poll.toString() === "0") {
      throw new Error("The state tree has not been merged yet. Please use the mergeSignups subcommand to do so.");
    }

    const data = {
      processProofs: [] as Proof[],
      tallyProofs: [] as Proof[],
    };

    // read the proofs from the output directory
    const files = await fs.promises.readdir(outputDir);

    // Read process proofs
    data.processProofs = await readProofs({ files, folder: outputDir, type: "process" });
    // Read tally proofs
    data.tallyProofs = await readProofs({ files, folder: outputDir, type: "tally" });

    const prover = new Prover({
      maciContract: privoteContract,
      messageProcessorContract,
      pollContract,
      verifyingKeysRegistryContract,
      verifierContract,
      tallyContract,
    });

    await prover.proveMessageProcessing(data.processProofs);

    // read tally data
    const tallyData = await fs.promises
      .readFile(tallyFile, "utf8")
      .then((result) => JSON.parse(result) as unknown as TallyData);

    await prover.proveTally(data.tallyProofs);

    const voteOptions = await pollContract.voteOptions();

    await prover.submitResults(tallyData, Number.parseInt(voteOptions.toString(), 10));

    const endBalance = await signer.provider!.getBalance(signer);

    logMagenta({ text: info(`End balance: ${Number(endBalance / 10n ** 12n) / 1e6}`) });
    logMagenta({ text: info(`Prove expenses: ${Number((startBalance - endBalance) / 10n ** 12n) / 1e6}`) });
  });

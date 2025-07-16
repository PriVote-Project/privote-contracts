/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import { EMode } from "@maci-protocol/core";
import { Keypair, PrivateKey } from "@maci-protocol/domainobjs";
import { task, types } from "hardhat/config";

import fs from "fs";

import type { Proof } from "@maci-protocol/contracts";
import type { MACI, Poll, Privote } from "../../typechain-types";

import { logMagenta, info } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { ProofGenerator } from "@maci-protocol/contracts";
import { EContracts, type IProveParams } from "@maci-protocol/contracts";
import { CustomEContracts } from "../helpers/constants";

interface IProveParamsExtended extends IProveParams {
  submitOnChain: boolean;
}

/**
 * Prove hardhat task for generating off-chain proofs and sending them on-chain
 */
task("prove", "Command to generate proofs")
  .addParam("poll", "The poll id", undefined, types.string)
  .addParam("outputDir", "Output directory for proofs", undefined, types.string)
  .addParam("coordinatorPrivateKey", "Coordinator maci private key", undefined, types.string)
  .addOptionalParam("rapidsnark", "Rapidsnark binary path", undefined, types.string)
  .addOptionalParam(
    "messageProcessorWitnessGenerator",
    "MessageProcessor witness generator binary path",
    undefined,
    types.string,
  )
  .addParam("tallyFile", "The file to store the tally proof", undefined, types.string)
  .addOptionalParam("voteTallyWitnessGenerator", "VoteTally witness generator binary path", undefined, types.string)
  .addOptionalParam("stateFile", "The file with the serialized maci state", undefined, types.string)
  .addOptionalParam("startBlock", "The block number to start fetching logs from", undefined, types.int)
  .addOptionalParam("blocksPerBatch", "The number of blocks to fetch logs from", undefined, types.int)
  .addOptionalParam("endBlock", "The block number to stop fetching logs from", undefined, types.int)
  .addOptionalParam("transactionHash", "The transaction hash of the first transaction", undefined, types.int)
  .addOptionalParam(
    "ipfsMessageBackupFiles",
    "Backup files for ipfs messages (name format: ipfsHash1.json, ipfsHash2.json, ..., ipfsHashN.json)",
    undefined,
    types.string,
  )
  .addFlag("submitOnChain", "Submit proofs on-chain")
  .setAction(
    async (
      {
        outputDir,
        poll,
        coordinatorPrivateKey,
        stateFile,
        rapidsnark,
        messageProcessorWitnessGenerator,
        voteTallyWitnessGenerator,
        tallyFile,
        startBlock,
        blocksPerBatch,
        endBlock,
        transactionHash,
        ipfsMessageBackupFiles,
        submitOnChain,
      }: IProveParamsExtended,
      hre,
    ) => {
      const deployment = Deployment.getInstance();
      deployment.setHre(hre);
      const storage = ContractStorage.getInstance();
      // if we do not have the output directory just create it
      const isOutputDirExists = fs.existsSync(outputDir);

      if (!isOutputDirExists) {
        // Create the directory
        await fs.promises.mkdir(outputDir, { recursive: true });
      }

      const maciPrivateKey = PrivateKey.deserialize(coordinatorPrivateKey);
      const coordinatorKeypair = new Keypair(maciPrivateKey);

      const signer = await deployment.getDeployer();
      const { network } = hre;

      const startBalance = await signer.provider!.getBalance(signer);

      logMagenta({ text: info(`Start balance: ${Number(startBalance / 10n ** 12n) / 1e6}`) });

      const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, network.name);
      if (!privoteContractAddress) {
        throw new Error("Privote contract not found");
      }
      const privoteContract = await deployment.getContract<Privote>({ 
        name: CustomEContracts.Privote as any, 
        address: privoteContractAddress 
      });

      const pollContracts = await privoteContract.polls(poll);
      const pollContract = await deployment.getContract<Poll>({
        name: EContracts.Poll,
        address: pollContracts.poll,
      });
      const isStateAqMerged = await pollContract.stateMerged();

      // Check that the state and message trees have been merged for at least the first poll
      if (!isStateAqMerged && poll.toString() === "0") {
        throw new Error("The state tree has not been merged yet. Please use the mergeSignups subcommand to do so.");
      }

      const maciState = await ProofGenerator.prepareState({
        maciContract: privoteContract,
        pollContract,
        maciPrivateKey,
        coordinatorKeypair,
        pollId: poll,
        signer,
        outputDir,
        ipfsMessageBackupFiles: ipfsMessageBackupFiles?.split(/\s*,\s*/),
        options: {
          stateFile,
          transactionHash,
          startBlock,
          endBlock,
          blocksPerBatch,
        },
      });

      const foundPoll = maciState.polls.get(BigInt(poll));

      if (!foundPoll) {
        throw new Error(`Poll ${poll} not found`);
      }

      const modeKeys = {
        [EMode.QV]: "qv",
        [EMode.NON_QV]: "nonQv",
        [EMode.FULL]: "full",
      };

      const mode = deployment.getDeployConfigField<EMode | null>(EContracts.Poll, "mode") ?? EMode.QV;
      const voteTallyZkey = deployment.getDeployConfigField<string>(
        EContracts.VerifyingKeysRegistry,
        `zkeys.${modeKeys[mode]}.voteTallyZkey`,
        true,
      );

      const voteTallyWasm = deployment.getDeployConfigField<string>(
        EContracts.VerifyingKeysRegistry,
        `zkeys.${modeKeys[mode]}.voteTallyWasm`,
        true,
      );

      const messageProcessorZkey = deployment.getDeployConfigField<string>(
        EContracts.VerifyingKeysRegistry,
        `zkeys.${modeKeys[mode]}.messageProcessorZkey`,
        true,
      );

      const messageProcessorWasm = deployment.getDeployConfigField<string>(
        EContracts.VerifyingKeysRegistry,
        `zkeys.${modeKeys[mode]}.messageProcessorWasm`,
        true,
      );

      const proofGenerator = new ProofGenerator({
        poll: foundPoll,
        maciContractAddress: privoteContractAddress,
        tallyContractAddress: pollContracts.tally,
        rapidsnark,
        tally: {
          zkey: voteTallyZkey,
          witnessGenerator: voteTallyWitnessGenerator,
          wasm: voteTallyWasm,
        },
        messageProcessor: {
          zkey: messageProcessorZkey,
          witnessGenerator: messageProcessorWitnessGenerator,
          wasm: messageProcessorWasm,
        },
        outputDir,
        tallyOutputFile: tallyFile,
        mode,
      });

      const data = {
        processProofs: [] as Proof[],
        tallyProofs: [] as Proof[],
      };

      data.processProofs = await proofGenerator.generateMpProofs();
      data.tallyProofs = await proofGenerator
        .generateTallyProofs(network.name, network.config.chainId?.toString())
        .then(({ proofs }) => proofs);

      const endBalance = await signer.provider!.getBalance(signer);

      logMagenta({ text: info(`End balance: ${Number(endBalance / 10n ** 12n) / 1e6}`) });
      logMagenta({ text: info(`Prove expenses: ${Number((startBalance - endBalance) / 10n ** 12n) / 1e6}`) });

      logMagenta({
        text: info(
          "Please make sure that you do not delete the proofs from the proof directory until they are all submitted on-chain.\nRegenerating proofs will result in overwriting the existing proofs and commitments which will be different due to the use of random salts.",
        ),
      });

      if (submitOnChain) {
        logMagenta({ text: info(`Submitting proofs on-chain`) });
        await hre.run("submitOnChain", {
          poll,
          outputDir,
          tallyFile,
        });
      }
    },
  );

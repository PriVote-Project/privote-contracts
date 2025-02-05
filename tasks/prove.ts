import { task, types } from "hardhat/config";
import { Keypair, PrivKey } from "maci-domainobjs";
import { ContractStorage, Deployment, ProofGenerator, EContracts, type IProveParams } from "maci-contracts";

import fs from "fs";

import type { MACI, Poll, AccQueue } from "maci-contracts";

import { validateAuthType, validatePollType } from "../utils";
import { AuthType, PollType } from "../utils/types";

export interface IProveParamsExtended extends IProveParams {
  pollType: PollType;
  authType: AuthType;
  maciContractAddress?: string;
}

task("prove", "Command to generate proofs")
  .addParam("poll", "The poll id", undefined, types.string)
  .addParam("outputDir", "Output directory for proofs", undefined, types.string)
  .addParam("coordinatorPrivateKey", "Coordinator maci private key", undefined, types.string)
  .addParam("authType", "The authentication type", undefined, types.string)
  .addParam("pollType", "The poll type", undefined, types.string)
  .addOptionalParam("maciContractAddress", "MACI contract address", undefined, types.string)
  .addOptionalParam("useQuadraticVoting", "Use quadratic voting", false, types.boolean)
  .addOptionalParam("rapidsnark", "Rapidsnark binary path", undefined, types.string)
  .addOptionalParam("processWitgen", "Process witgen binary path", undefined, types.string)
  .addParam("tallyFile", "The file to store the tally proof", undefined, types.string)
  .addOptionalParam("tallyWitgen", "Tally witgen binary path", undefined, types.string)
  .addOptionalParam("stateFile", "The file with the serialized maci state", undefined, types.string)
  .addOptionalParam("startBlock", "The block number to start fetching logs from", undefined, types.int)
  .addOptionalParam("blocksPerBatch", "The number of blocks to fetch logs from", undefined, types.int)
  .addOptionalParam("endBlock", "The block number to stop fetching logs from", undefined, types.int)
  .addOptionalParam("transactionHash", "The transaction hash of the first transaction", undefined, types.int)
  .setAction(
    async (
      {
        outputDir,
        poll,
        coordinatorPrivateKey,
        authType,
        pollType,
        maciContractAddress,
        useQuadraticVoting,
        stateFile,
        rapidsnark,
        processWitgen,
        tallyWitgen,
        tallyFile,
        startBlock,
        blocksPerBatch,
        endBlock,
        transactionHash,
      }: IProveParamsExtended,
      hre,
    ) => {
      validateAuthType(authType);
      validatePollType(pollType);
      const deployment = Deployment.getInstance();
      deployment.setHre(hre);
      const storage = ContractStorage.getInstance();
      // if we do not have the output directory just create it
      const isOutputDirExists = fs.existsSync(outputDir);

      if (!isOutputDirExists) {
        // Create the directory
        await fs.promises.mkdir(outputDir);
      }

      const maciPrivateKey = PrivKey.deserialize(coordinatorPrivateKey);
      const coordinatorKeypair = new Keypair(maciPrivateKey);

      const signer = await deployment.getDeployer();
      const { network } = hre;

      const startBalance = await signer.provider.getBalance(signer);

      console.log("Start balance: ", Number(startBalance / 10n ** 12n) / 1e6);

      maciContractAddress =
        maciContractAddress ?? storage.mustGetAddress(EContracts.MACI, `${network.name}_${authType}_${pollType}`);
      const maciContract = await deployment.getContract<MACI>({ name: EContracts.MACI, address: maciContractAddress });

      const pollContracts = await maciContract.polls(poll);
      const pollContract = await deployment.getContract<Poll>({
        name: EContracts.Poll,
        address: pollContracts.poll,
      });
      const messageAqAddress = await pollContract.extContracts().then(contracts => contracts.messageAq);
      const messageAq = await deployment.getContract<AccQueue>({
        name: EContracts.AccQueue,
        address: messageAqAddress,
      });
      const isStateAqMerged = await pollContract.stateMerged();

      // Check that the state and message trees have been merged for at least the first poll
      if (!isStateAqMerged && poll.toString() === "0") {
        throw new Error("The state tree has not been merged yet. Please use the mergeSignups subcommand to do so.");
      }

      console.log("startblock", startBlock);

      const maciState = await ProofGenerator.prepareState({
        maciContract,
        pollContract,
        messageAq,
        maciPrivateKey,
        coordinatorKeypair,
        pollId: poll,
        signer,
        outputDir,
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

      const mode = useQuadraticVoting ? "qv" : "nonQv";
      const tallyZkey = deployment.getDeployConfigField<string>(
        EContracts.VkRegistry,
        `zkeys.${mode}.tallyVotesZkey`,
        true,
      );
      const tallyWasm = deployment.getDeployConfigField<string>(EContracts.VkRegistry, `zkeys.${mode}.tallyWasm`, true);
      const processZkey = deployment.getDeployConfigField<string>(
        EContracts.VkRegistry,
        `zkeys.${mode}.processMessagesZkey`,
        true,
      );
      const processWasm = deployment.getDeployConfigField<string>(
        EContracts.VkRegistry,
        `zkeys.${mode}.processWasm`,
        true,
      );
      const proofGenerator = new ProofGenerator({
        poll: foundPoll,
        maciContractAddress,
        tallyContractAddress: pollContracts.tally,
        rapidsnark,
        tally: {
          zkey: tallyZkey,
          witgen: tallyWitgen,
          wasm: tallyWasm,
        },
        mp: {
          zkey: processZkey,
          witgen: processWitgen,
          wasm: processWasm,
        },
        outputDir,
        tallyOutputFile: tallyFile,
        useQuadraticVoting,
      });

      await proofGenerator.generateMpProofs();
      await proofGenerator.generateTallyProofs(network).then(async ({ proofs, tallyData }) => tallyData);

      const endBalance = await signer.provider.getBalance(signer);

      console.log("End balance: ", Number(endBalance / 10n ** 12n) / 1e6);
      console.log("Prove expenses: ", Number((startBalance - endBalance) / 10n ** 12n) / 1e6);

      console.log(
        "Please make sure that you do not delete the proofs from the proof directory until they are all submitted on-chain.\nRegenerating proofs will result in overwriting the existing proofs and commitments which will be different due to the use of random salts.",
      );
    },
  );

/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import { task, types } from "hardhat/config";

import fs from "fs";

import type {
  VkRegistry,
  Verifier,
  MACI,
  Poll,
  MessageProcessor,
  Tally,
  Proof,
  ISubmitOnChainParams,
  AccQueue,
} from "maci-contracts";

import { ContractStorage, Deployment, EContracts, TallyData, Prover } from "maci-contracts";
import { AuthType } from "../utils/types";

/**
 * Interface that represents read proofs arguments
 */
interface IReadProofsArgs {
  files: string[];
  folder: string;
  type: "tally" | "process";
}

export interface ISubmitOnChainParamsExtended extends ISubmitOnChainParams {
  authType: AuthType;
  maciContractAddress?: string;
}

const validateAuthType = (authType: AuthType) => {
  if (authType !== "free" && authType !== "anon") {
    throw new Error(`Unrecognized auth type: ${authType}`);
  }
};

/**
 * Read and parse proofs
 *
 * @param args - read proofs arguments
 * @returns proofs
 */
async function readProofs({ files, folder, type }: IReadProofsArgs): Promise<Proof[]> {
  return Promise.all(
    files
      .filter(f => f.startsWith(`${type}_`) && f.endsWith(".json"))
      .sort()
      .map(async file => fs.promises.readFile(`${folder}/${file}`, "utf8").then(result => JSON.parse(result) as Proof)),
  );
}
/**
 * Prove hardhat task for submitting proofs on-chain as well as uploading tally results
 */
task("submitOnChain", "Command to prove the result of a poll on-chain")
  .addParam("poll", "The poll id", undefined, types.string)
  .addParam("outputDir", "Output directory for proofs", undefined, types.string)
  .addParam("tallyFile", "The file to store the tally proof", undefined, types.string)
  .addParam("authType", "The authentication type", undefined, types.string)
  .addOptionalParam("maciContractAddress", "MACI contract address", undefined, types.string)
  .setAction(
    async ({ outputDir, poll, tallyFile, authType, maciContractAddress }: ISubmitOnChainParamsExtended, hre) => {
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

      const startBalance = await signer.provider.getBalance(signer);

      console.log("Start balance: ", Number(startBalance / 10n ** 12n) / 1e6);

      maciContractAddress =
        maciContractAddress ?? storage.mustGetAddress(EContracts.MACI, `${network.name}_${authType}`);
      const vkRegistryContractAddress = storage.mustGetAddress(EContracts.VkRegistry, `${network.name}_${authType}`);
      const verifierContractAddress = storage.mustGetAddress(EContracts.Verifier, `${network.name}_${authType}`);
      const [maciContract, vkRegistryContract, verifierContract] = await Promise.all([
        deployment.getContract<MACI>({
          name: EContracts.MACI,
          address: maciContractAddress,
        }),
        deployment.getContract<VkRegistry>({ name: EContracts.VkRegistry, address: vkRegistryContractAddress }),
        deployment.getContract<Verifier>({ name: EContracts.Verifier, address: verifierContractAddress }),
      ]);

      const pollContracts = await maciContract.polls(poll);
      const pollContract = await deployment.getContract<Poll>({
        name: EContracts.Poll,
        address: pollContracts.poll,
      });

      const [[, messageAqContractAddress], isStateAqMerged, messageTreeDepth, mpContract, tallyContract] =
        await Promise.all([
          pollContract.extContracts(),
          pollContract.stateMerged(),
          pollContract.treeDepths().then(depths => Number(depths[2])),
          deployment.getContract<MessageProcessor>({
            name: EContracts.MessageProcessor,
            address: pollContracts.messageProcessor,
          }),
          deployment.getContract<Tally>({
            name: EContracts.Tally,
            address: pollContracts.tally,
          }),
        ]);
      const messageAqContract = await deployment.getContract<AccQueue>({
        name: EContracts.AccQueue,
        address: messageAqContractAddress,
      });

      // Check that the state and message trees have been merged for at least the first poll
      if (!isStateAqMerged && poll.toString() === "0") {
        throw new Error("The state tree has not been merged yet. Please use the mergeSignups subcommand to do so.");
      }

      // check that the main root is set
      const mainRoot = await messageAqContract.getMainRoot(messageTreeDepth.toString());

      if (mainRoot.toString() === "0") {
        throw new Error("The message tree has not been merged yet. Please use the mergeMessages subcommand to do so.");
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
        maciContract,
        messageAqContract,
        mpContract,
        pollContract,
        vkRegistryContract,
        verifierContract,
        tallyContract,
      });

      await prover.proveMessageProcessing(data.processProofs);

      // read tally data
      const tallyData = await fs.promises
        .readFile(tallyFile, "utf8")
        .then(result => JSON.parse(result) as unknown as TallyData);

      await prover.proveTally(data.tallyProofs);

      await prover.submitResults(tallyData);

      const endBalance = await signer.provider.getBalance(signer);

      console.log("End balance: ", Number(endBalance / 10n ** 12n) / 1e6);
      console.log("Prove expenses: ", Number((startBalance - endBalance) / 10n ** 12n) / 1e6);
    },
  );

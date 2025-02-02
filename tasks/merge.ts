import { ZeroAddress } from "ethers";
import { task, types } from "hardhat/config";
import { ContractStorage, Deployment, TreeMerger, EContracts, type IMergeParams } from "maci-contracts";

import type { AccQueue, MACI, Poll } from "maci-contracts";

import { AuthType } from "../utils/types";

export interface IMergeParamsExtended extends IMergeParams {
  authType: AuthType;
  maciContractAddress?: string;
}

const validateAuthType = (authType: AuthType) => {
  if (authType !== "free" && authType !== "anon") {
    throw new Error(`Unrecognized auth type: ${authType}`);
  }
};
const DEFAULT_SR_QUEUE_OPS = 4;

/**
 * Command to merge signups of a MACI contract
 */
task("merge", "Merge signups")
  .addParam("poll", "The poll id", undefined, types.string)
  .addOptionalParam("queueOps", "The number of queue operations to perform", DEFAULT_SR_QUEUE_OPS, types.int)
  .addParam("authType", "The authentication type", undefined, types.string)
  .addOptionalParam("maciContractAddress", "MACI contract address", undefined, types.string)
  .addOptionalParam("prove", "Run prove command after merging", false, types.boolean)
  .setAction(
    async (
      { poll, queueOps = DEFAULT_SR_QUEUE_OPS, authType, maciContractAddress, prove }: IMergeParamsExtended,
      hre,
    ) => {
      validateAuthType(authType);
      const deployment = Deployment.getInstance({ hre });
      const storage = ContractStorage.getInstance();

      deployment.setHre(hre);

      const deployer = await deployment.getDeployer();

      console.log(`${hre.network.name}_${authType}`);
      maciContractAddress =
        maciContractAddress ?? storage.mustGetAddress(EContracts.MACI, `${hre.network.name}_${authType}`);
      console.log(`MACI contract address: ${maciContractAddress}`);
      const maciContract = await deployment.getContract<MACI>({ name: EContracts.MACI, address: maciContractAddress });
      console.log(`MACI contract at ${await maciContract.getAddress()}`);

      const pollContracts = await maciContract.polls(poll);
      const pollContract = await deployment.getContract<Poll>({ name: EContracts.Poll, address: pollContracts.poll });
      const [, messageAccQueueContractAddress] = await pollContract.extContracts();

      const messageAccQueueContract = await deployment.getContract<AccQueue>({
        name: EContracts.AccQueue,
        address: messageAccQueueContractAddress,
      });

      if (pollContracts.poll === ZeroAddress) {
        throw new Error(`No poll ${poll} found`);
      }

      const treeMerger = new TreeMerger({
        deployer,
        pollContract,
        messageAccQueueContract,
      });

      const startBalance = await deployer.provider.getBalance(deployer);

      console.log("Start balance: ", Number(startBalance / 10n ** 12n) / 1e6);

      await treeMerger.checkPollDuration();

      await treeMerger.mergeSignups();
      await treeMerger.mergeMessageSubtrees(queueOps);
      await treeMerger.mergeMessages();

      const endBalance = await deployer.provider.getBalance(deployer);

      console.log("End balance: ", Number(endBalance / 10n ** 12n) / 1e6);
      console.log("Merge expenses: ", Number((startBalance - endBalance) / 10n ** 12n) / 1e6);

      if (prove) {
        console.log(`Prove poll ${poll} results`);
        await hre.run("prove");
      }
    },
  );

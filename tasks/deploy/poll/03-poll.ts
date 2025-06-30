/* eslint-disable no-console */
import { EMode } from "@maci-protocol/core";
import { IVerifyingKeyObjectParams, PublicKey, VerifyingKey } from "@maci-protocol/domainobjs";
import { ZeroAddress } from "ethers";

import type { IVerifyingKeyStruct } from "@maci-protocol/contracts";
import type { Privote, Poll, IBasePolicy, PollFactory, VerifyingKeysRegistry } from "../../../typechain-types";

import { extractVerifyingKey } from "@maci-protocol/contracts";
import { EDeploySteps } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { EContracts, FULL_POLICY_NAMES } from "@maci-protocol/contracts";
import { CustomEContracts } from "../../helpers/constants";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(EDeploySteps.Poll, "Deploy poll").then((task) =>
  task.setAction(async (_, hre) => {
    deployment.setHre(hre);

    const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, hre.network.name);
    const verifierContractAddress = storage.getAddress(EContracts.Verifier, hre.network.name);
    const verifyingKeysRegistryContractAddress = storage.getAddress(EContracts.VerifyingKeysRegistry, hre.network.name);

    if (!privoteContractAddress) {
      throw new Error("Need to deploy Privote contract first");
    }

    if (!verifierContractAddress) {
      throw new Error("Need to deploy Verifier contract first");
    }

    if (!verifyingKeysRegistryContractAddress) {
      throw new Error("Need to deploy VerifyingKeysRegistry contract first");
    }

    const privoteContract = await deployment.getContract<Privote>({ 
      name: CustomEContracts.Privote as any,
      address: privoteContractAddress
      // abi: (await hre.artifacts.readArtifact("Privote")).abi 
    });
    const pollId = await privoteContract.nextPollId();

    const coordinatorPublicKey = deployment.getDeployConfigField<string>(EContracts.Poll, "coordinatorPublicKey");
    let pollStartTimestamp = deployment.getDeployConfigField<number>(EContracts.Poll, "pollStartDate");
    let pollEndTimestamp = deployment.getDeployConfigField<number>(EContracts.Poll, "pollEndDate");
    
    // Check if both timestamps are 0, then use duration-based timing
    if (pollStartTimestamp === 0 && pollEndTimestamp === 0) {
      const duration = deployment.getDeployConfigField<number>(EContracts.Poll, "duration");
      if (!duration || duration <= 0) {
        throw new Error("Duration must be a positive number when both pollStartDate and pollEndDate are 0");
      }
      
      // Set start time to current timestamp + 10 seconds
      const currentTimestamp = Math.floor(Date.now() / 1000);
      pollStartTimestamp = currentTimestamp + 10;
      pollEndTimestamp = pollStartTimestamp + duration;
      
      console.log(`Using duration-based timing:`);
      console.log(`  Current time: ${new Date(currentTimestamp * 1000).toISOString()}`);
      console.log(`  Poll start: ${new Date(pollStartTimestamp * 1000).toISOString()} (current + 10s)`);
      console.log(`  Poll end: ${new Date(pollEndTimestamp * 1000).toISOString()} (start + ${duration}s)`);
      console.log(`  Duration: ${duration} seconds`);
    } else {
      console.log(`Using configured timestamps:`);
      console.log(`  Poll start: ${new Date(pollStartTimestamp * 1000).toISOString()}`);
      console.log(`  Poll end: ${new Date(pollEndTimestamp * 1000).toISOString()}`);
    }
    const tallyProcessingStateTreeDepth = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "tallyProcessingStateTreeDepth",
    );
    const messageBatchSize = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "messageBatchSize",
    );
    const stateTreeDepth =
      deployment.getDeployConfigField<number>(EContracts.Poll, "stateTreeDepth") ||
      (await privoteContract.stateTreeDepth());
    const voteOptionTreeDepth = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "voteOptionTreeDepth",
    );
    const relayers = deployment
      .getDeployConfigField<string | undefined>(EContracts.Poll, "relayers")
      ?.split(",")
      .map((value) => value.trim()) || [ZeroAddress];

    const mode = deployment.getDeployConfigField<EMode | null>(EContracts.Poll, "mode") ?? EMode.QV;
    const unserializedKey = PublicKey.deserialize(coordinatorPublicKey);

    const policy =
      deployment.getDeployConfigField<EContracts | null>(EContracts.Poll, "policy") || EContracts.FreeForAllPolicy;
    const fullPolicyName = FULL_POLICY_NAMES[policy as keyof typeof FULL_POLICY_NAMES] as unknown as EContracts;
    const policyContractAddress = storage.mustGetAddress(fullPolicyName, hre.network.name, `poll-${pollId}`);

    const initialVoiceCreditProxy =
      deployment.getDeployConfigField<EContracts | null>(EContracts.Poll, "initialVoiceCreditProxy") ||
      EContracts.ConstantInitialVoiceCreditProxy;
    const initialVoiceCreditProxyContractAddress = storage.mustGetAddress(initialVoiceCreditProxy, hre.network.name);

    const voteOptions = deployment.getDeployConfigField<number>(EContracts.Poll, "voteOptions");
    const pollName = deployment.getDeployConfigField<string>(EContracts.Poll, "name") || `Poll ${pollId}`;
    const pollMetadata = deployment.getDeployConfigField<string>(EContracts.Poll, "metadata") || "";
    const pollOptions = deployment.getDeployConfigField<string[]>(EContracts.Poll, "options") || [];
    const pollOptionInfo = deployment.getDeployConfigField<Uint8Array[]>(EContracts.Poll, "optionInfo") || [];

    const verifyingKeysRegistryContract = await deployment.getContract<VerifyingKeysRegistry>({
      name: EContracts.VerifyingKeysRegistry,
      address: verifyingKeysRegistryContractAddress,
    });

    const pollJoiningZkeyPath = deployment.getDeployConfigField<string>(
      EContracts.VerifyingKeysRegistry,
      "zkeys.pollJoiningZkey.zkey",
    );
    const pollJoinedZkeyPath = deployment.getDeployConfigField<string>(
      EContracts.VerifyingKeysRegistry,
      "zkeys.pollJoinedZkey.zkey",
    );

    const [pollJoiningVerifyingKey, pollJoinedVerifyingKey] = await Promise.all([
      pollJoiningZkeyPath && extractVerifyingKey(pollJoiningZkeyPath),
      pollJoinedZkeyPath && extractVerifyingKey(pollJoinedZkeyPath),
    ]).then((verifyingKeys) =>
      verifyingKeys.map(
        (verifyingKey: IVerifyingKeyObjectParams | "" | undefined) =>
          verifyingKey && VerifyingKey.fromObj(verifyingKey),
      ),
    );

    if (!pollJoiningVerifyingKey) {
      throw new Error("Poll joining zkey is not set");
    }

    if (!pollJoinedVerifyingKey) {
      throw new Error("Poll joined zkey is not set");
    }

    const [pollJoiningVerifyingKeySignature, pollJoinedVerifyingKeySignature] = await Promise.all([
      verifyingKeysRegistryContract.generatePollJoiningVerifyingKeySignature(stateTreeDepth),
      verifyingKeysRegistryContract.generatePollJoinedVerifyingKeySignature(stateTreeDepth),
    ]);
    const [pollJoiningVerifyingKeyOnchain, pollJoinedVerifyingKeyOnchain] = await Promise.all([
      verifyingKeysRegistryContract.getPollJoiningVerifyingKeyBySignature(pollJoiningVerifyingKeySignature),
      verifyingKeysRegistryContract.getPollJoinedVerifyingKeyBySignature(pollJoinedVerifyingKeySignature),
    ]);

    const isPollJoiningVerifyingKeySet = pollJoiningVerifyingKey.equals(
      VerifyingKey.fromContract(pollJoiningVerifyingKeyOnchain),
    );

    if (!isPollJoiningVerifyingKeySet) {
      await verifyingKeysRegistryContract
        .setPollJoiningVerifyingKey(stateTreeDepth, pollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct)
        .then((tx: { wait: () => any; }) => tx.wait());
    }

    const isPollJoinedVerifyingKeySet = pollJoinedVerifyingKey.equals(
      VerifyingKey.fromContract(pollJoinedVerifyingKeyOnchain),
    );

    if (!isPollJoinedVerifyingKeySet) {
      await verifyingKeysRegistryContract
        .setPollJoinedVerifyingKey(stateTreeDepth, pollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct)
        .then((tx: { wait: () => any; }) => tx.wait());
    }

    const receipt = await privoteContract
      .createPoll(
        pollName,
        pollOptions,
        pollOptionInfo,
        pollMetadata,
        pollStartTimestamp,
        pollEndTimestamp,
        mode,
        unserializedKey.asContractParam(),
        policyContractAddress,
        initialVoiceCreditProxyContractAddress,
        relayers
      )
      .then((tx: { wait: () => any; }) => tx.wait());

    if (receipt?.status !== 1) {
      throw new Error("Deploy poll transaction is failed");
    }

    const pollData = await privoteContract.polls(pollId);
    const pollContractAddress = pollData.poll;
    const messageProcessorContractAddress = pollData.messageProcessor;
    const tallyContractAddress = pollData.tally;

    const pollContract = await deployment.getContract<Poll>({ name: EContracts.Poll, address: pollContractAddress });

    const policyContract = await deployment.getContract<IBasePolicy>({
      name: fullPolicyName,
      address: policyContractAddress,
    });

    await policyContract.setTarget(pollContractAddress).then((tx: { wait: () => any; }) => tx.wait());

    const messageProcessorContract = await deployment.getContract({
      name: EContracts.MessageProcessor,
      address: messageProcessorContractAddress,
    });

    const tallyContract = await deployment.getContract({
      name: EContracts.Tally,
      address: tallyContractAddress,
    });

    const [pollFactory, messageProcessorFactory, tallyFactory] = await Promise.all([
      deployment.getContract<PollFactory>({
        name: EContracts.PollFactory,
      }),
      deployment.getContract<PollFactory>({
        name: EContracts.MessageProcessorFactory,
      }),
      deployment.getContract<PollFactory>({
        name: EContracts.TallyFactory,
      }),
    ]);

    const [pollImplementation, messageProcessorImplementation, tallyImplementation] = await Promise.all([
      pollFactory.IMPLEMENTATION(),
      messageProcessorFactory.IMPLEMENTATION(),
      tallyFactory.IMPLEMENTATION(),
    ]);

    await Promise.all([
      storage.register({
        id: EContracts.Poll,
        key: `poll-${pollId}`,
        implementation: pollImplementation,
        contract: pollContract,
        args: [],
        network: hre.network.name,
      }),

      storage.register({
        id: EContracts.MessageProcessor,
        key: `poll-${pollId}`,
        implementation: messageProcessorImplementation,
        contract: messageProcessorContract,
        args: [],
        network: hre.network.name,
      }),

      storage.register({
        id: EContracts.Tally,
        key: `poll-${pollId}`,
        implementation: tallyImplementation,
        contract: tallyContract,
        args: [],
        network: hre.network.name,
      }),
    ]);
  }),
);

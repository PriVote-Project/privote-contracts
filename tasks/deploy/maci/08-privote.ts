import type { Privote, IBasePolicy } from "../../../typechain-types";

import { generateEmptyBallotRoots } from "@maci-protocol/contracts";
import { info, logGreen } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment, IDeployParams } from "@maci-protocol/contracts";
import { EContracts, FULL_POLICY_NAMES } from "@maci-protocol/contracts";
import { CustomEContracts, CustomEDeploySteps } from "../../helpers/constants";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

const DEFAULT_STATE_TREE_DEPTH = 10;

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(CustomEDeploySteps.Privote, "Deploy Privote contract").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    // Check if we should deploy PrivoteWrapper instead of Privote
    const deployWrapper = (global as any).DEPLOY_WRAPPER || false;
    
    if (deployWrapper) {
      logGreen({ text: info(`Skipping Privote deployment - PrivoteWrapper will be deployed instead`) });
      return;
    }

    const privoteContractAddress = storage.getAddress(CustomEContracts.Privote, hre.network.name);

    if (incremental && privoteContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${CustomEContracts.Privote} contract`) });
      return;
    }

    const poseidonT3ContractAddress = storage.mustGetAddress(EContracts.PoseidonT3, hre.network.name);
    const poseidonT4ContractAddress = storage.mustGetAddress(EContracts.PoseidonT4, hre.network.name);
    const poseidonT5ContractAddress = storage.mustGetAddress(EContracts.PoseidonT5, hre.network.name);
    const poseidonT6ContractAddress = storage.mustGetAddress(EContracts.PoseidonT6, hre.network.name);

    const libraries = {
      "@maci-protocol/contracts/contracts/crypto/PoseidonT3.sol:PoseidonT3": poseidonT3ContractAddress,
      "@maci-protocol/contracts/contracts/crypto/PoseidonT4.sol:PoseidonT4": poseidonT4ContractAddress,
      "@maci-protocol/contracts/contracts/crypto/PoseidonT5.sol:PoseidonT5": poseidonT5ContractAddress,
      "@maci-protocol/contracts/contracts/crypto/PoseidonT6.sol:PoseidonT6": poseidonT6ContractAddress,
    };

    const privoteContractFactory = await hre.ethers.getContractFactory(CustomEContracts.Privote, {
      signer: deployer,
      libraries,
    });

    const policy =
      deployment.getDeployConfigField<EContracts | null>(EContracts.MACI, "policy") || EContracts.FreeForAllPolicy;
    const fullPolicyName = FULL_POLICY_NAMES[policy as keyof typeof FULL_POLICY_NAMES] as unknown as EContracts;
    const policyContractAddress = storage.mustGetAddress(fullPolicyName, hre.network.name);
    const pollFactoryContractAddress = storage.mustGetAddress(EContracts.PollFactory, hre.network.name);
    const messageProcessorFactoryContractAddress = storage.mustGetAddress(
      EContracts.MessageProcessorFactory,
      hre.network.name,
    );
    const tallyFactoryContractAddress = storage.mustGetAddress(EContracts.TallyFactory, hre.network.name);

    const stateTreeDepth =
      deployment.getDeployConfigField<number | null>(EContracts.MACI, "stateTreeDepth") ?? DEFAULT_STATE_TREE_DEPTH;

    const emptyBallotRoots = generateEmptyBallotRoots(stateTreeDepth);

    const privoteContract = await deployment.deployContractWithLinkedLibraries<Privote>(
      { contractFactory: privoteContractFactory },
      pollFactoryContractAddress,
      messageProcessorFactoryContractAddress,
      tallyFactoryContractAddress,
      policyContractAddress,
      stateTreeDepth,
      emptyBallotRoots,
    );

    const verifierContractAddress = storage.mustGetAddress(EContracts.Verifier, hre.network.name);
    const verifyingKeysRegistryContractAddress = storage.mustGetAddress(EContracts.VerifyingKeysRegistry, hre.network.name);

    const tallyProcessingStateTreeDepth = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "tallyProcessingStateTreeDepth",
    ) || 10;

    const voteOptionTreeDepth = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "voteOptionTreeDepth",
    ) || 2;

    const messageBatchSize = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "messageBatchSize",
    ) || 4;

    await privoteContract.setConfig(
      {
        tallyProcessingStateTreeDepth,
        voteOptionTreeDepth,
        stateTreeDepth,
      },
      verifierContractAddress,
      verifyingKeysRegistryContractAddress,
      messageBatchSize
    ).then((tx) => tx.wait());

    const policyContract = await deployment.getContract<IBasePolicy>({
      name: fullPolicyName,
      address: policyContractAddress,
    });
    const privoteInstanceAddress = await privoteContract.getAddress();

    await policyContract.setTarget(privoteInstanceAddress).then((tx) => tx.wait());

    await storage.register({
      id: CustomEContracts.Privote,
      contract: privoteContract,
      libraries,
      args: [
        pollFactoryContractAddress,
        messageProcessorFactoryContractAddress,
        tallyFactoryContractAddress,
        policyContractAddress,
        stateTreeDepth,
        emptyBallotRoots.map((root) => root.toString()),
      ],
      network: hre.network.name,
    });
  }),
);

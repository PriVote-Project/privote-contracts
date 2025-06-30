import type { PrivoteWrapper, IBasePolicy } from "../../../typechain-types";

import { generateEmptyBallotRoots } from "@maci-protocol/contracts";
import { info, logGreen } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment, IDeployParams } from "@maci-protocol/contracts";
import { 
  EContracts, 
  FULL_POLICY_NAMES, 
  ECheckerFactories, 
  EPolicyFactories 
} from "@maci-protocol/contracts";
import { CustomEContracts, CustomEDeploySteps } from "../../helpers/constants";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

const DEFAULT_STATE_TREE_DEPTH = 10;

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(CustomEDeploySteps.PrivoteWrapper, "Deploy PrivoteWrapper contract").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    // Check if we should deploy basic Privote instead of PrivoteWrapper
    const deployWrapper = (global as any).DEPLOY_WRAPPER || false;
    
    if (!deployWrapper) {
      logGreen({ text: info(`Skipping PrivoteWrapper deployment - Basic Privote will be deployed instead`) });
      logGreen({ text: info(`To deploy PrivoteWrapper, use --wrapper flag`) });
      return;
    }

    const privoteWrapperContractAddress = storage.getAddress(CustomEContracts.PrivoteWrapper, hre.network.name);

    if (incremental && privoteWrapperContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${CustomEContracts.PrivoteWrapper} contract`) });
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

    const privoteWrapperContractFactory = await hre.ethers.getContractFactory(CustomEContracts.PrivoteWrapper, {
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

    // Deploy PrivoteWrapper contract
    const privoteWrapperContract = await deployment.deployContractWithLinkedLibraries<PrivoteWrapper>(
      { contractFactory: privoteWrapperContractFactory },
      pollFactoryContractAddress,
      messageProcessorFactoryContractAddress,
      tallyFactoryContractAddress,
      policyContractAddress,
      stateTreeDepth,
      emptyBallotRoots,
    );

    await privoteWrapperContract.waitForDeployment();

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

    await privoteWrapperContract.setConfig(
      {
        tallyProcessingStateTreeDepth,
        voteOptionTreeDepth,
        stateTreeDepth,
      },
      verifierContractAddress,
      verifyingKeysRegistryContractAddress,
      messageBatchSize
    );

    const policyContract = await deployment.getContract<IBasePolicy>({
      name: fullPolicyName,
      address: policyContractAddress,
    });
    const privoteInstanceAddress = await privoteWrapperContract.getAddress();
    await policyContract.setTarget(privoteInstanceAddress).then((tx) => tx.wait());

    // Deploy ConstantInitialVoiceCreditProxyFactory for voice credit proxy deployment
    const constantVoiceCreditProxyFactoryContract = await deployment.deployContract({
      name: "ConstantInitialVoiceCreditProxyFactory",
      signer: deployer,
    });

    const constantVoiceCreditProxyFactoryAddress = await constantVoiceCreditProxyFactoryContract.getAddress();

    // Set the constant voice credit proxy factory
    await privoteWrapperContract.setConstantVoiceCreditProxyFactory(constantVoiceCreditProxyFactoryAddress);

    // Setup all policy factories that were deployed in the previous step
    logGreen({ text: info("Setting up policy factories for PrivoteWrapper...") });

    // Helper function to safely get factory addresses
    const getFactoryAddress = (factoryType: string, network: string) => {
      try {
        return storage.getAddress(factoryType, network);
      } catch (e) {
        console.warn(`Factory ${factoryType} not found for network ${network} - skipping`);
        return null;
      }
    };

    // Set AnonAadhaar factories
    const anonAadhaarCheckerFactory = getFactoryAddress(ECheckerFactories.AnonAadhaar, hre.network.name);
    const anonAadhaarPolicyFactory = getFactoryAddress(EPolicyFactories.AnonAadhaar, hre.network.name);
    if (anonAadhaarCheckerFactory && anonAadhaarPolicyFactory) {
      await privoteWrapperContract.setAnonAadhaarFactories(anonAadhaarCheckerFactory, anonAadhaarPolicyFactory);
      logGreen({ text: info("✓ AnonAadhaar factories configured") });
    }

    // Set ERC20 factories
    const erc20CheckerFactory = getFactoryAddress(ECheckerFactories.ERC20, hre.network.name);
    const erc20PolicyFactory = getFactoryAddress(EPolicyFactories.ERC20, hre.network.name);
    if (erc20CheckerFactory && erc20PolicyFactory) {
      await privoteWrapperContract.setERC20Factories(erc20CheckerFactory, erc20PolicyFactory);
      logGreen({ text: info("✓ ERC20 factories configured") });
    }

    // Set Token factories
    const tokenCheckerFactory = getFactoryAddress(ECheckerFactories.Token, hre.network.name);
    const tokenPolicyFactory = getFactoryAddress(EPolicyFactories.Token, hre.network.name);
    if (tokenCheckerFactory && tokenPolicyFactory) {
      await privoteWrapperContract.setTokenFactories(tokenCheckerFactory, tokenPolicyFactory);
      logGreen({ text: info("✓ Token factories configured") });
    }

    // Set EAS factories
    const easCheckerFactory = getFactoryAddress(ECheckerFactories.EAS, hre.network.name);
    const easPolicyFactory = getFactoryAddress(EPolicyFactories.EAS, hre.network.name);
    if (easCheckerFactory && easPolicyFactory) {
      await privoteWrapperContract.setEASFactories(easCheckerFactory, easPolicyFactory);
      logGreen({ text: info("✓ EAS factories configured") });
    }

    // Set GitCoin factories
    const gitcoinCheckerFactory = getFactoryAddress(ECheckerFactories.GitcoinPassport, hre.network.name);
    const gitcoinPolicyFactory = getFactoryAddress(EPolicyFactories.GitcoinPassport, hre.network.name);
    if (gitcoinCheckerFactory && gitcoinPolicyFactory) {
      await privoteWrapperContract.setGitcoinFactories(gitcoinCheckerFactory, gitcoinPolicyFactory);
      logGreen({ text: info("✓ GitCoin factories configured") });
    }

    // Set Merkle factories
    const merkleCheckerFactory = getFactoryAddress(ECheckerFactories.MerkleProof, hre.network.name);
    const merklePolicyFactory = getFactoryAddress(EPolicyFactories.MerkleProof, hre.network.name);
    if (merkleCheckerFactory && merklePolicyFactory) {
      await privoteWrapperContract.setMerkleFactories(merkleCheckerFactory, merklePolicyFactory);
      logGreen({ text: info("✓ Merkle factories configured") });
    }

    // Set Semaphore factories
    const semaphoreCheckerFactory = getFactoryAddress(ECheckerFactories.Semaphore, hre.network.name);
    const semaphorePolicyFactory = getFactoryAddress(EPolicyFactories.Semaphore, hre.network.name);
    if (semaphoreCheckerFactory && semaphorePolicyFactory) {
      await privoteWrapperContract.setSemaphoreFactories(semaphoreCheckerFactory, semaphorePolicyFactory);
      logGreen({ text: info("✓ Semaphore factories configured") });
    }

    // Set Zupass factories
    const zupassCheckerFactory = getFactoryAddress(ECheckerFactories.Zupass, hre.network.name);
    const zupassPolicyFactory = getFactoryAddress(EPolicyFactories.Zupass, hre.network.name);
    if (zupassCheckerFactory && zupassPolicyFactory) {
      await privoteWrapperContract.setZupassFactories(zupassCheckerFactory, zupassPolicyFactory);
      logGreen({ text: info("✓ Zupass factories configured") });
    }

    // Set Free For All factories
    const freeForAllCheckerFactory = getFactoryAddress(ECheckerFactories.FreeForAll, hre.network.name);
    const freeForAllPolicyFactory = getFactoryAddress(EPolicyFactories.FreeForAll, hre.network.name);
    if (freeForAllCheckerFactory && freeForAllPolicyFactory) {
      await privoteWrapperContract.setFreeForAllFactories(freeForAllCheckerFactory, freeForAllPolicyFactory);
      logGreen({ text: info("✓ Free For All factories configured") });
    }

    await storage.register({
      id: CustomEContracts.PrivoteWrapper,
      contract: privoteWrapperContract,
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

    // Store the Privote contract same as wrapper contract as both are the same contract
    await storage.register({
      id: CustomEContracts.Privote,
      contract: privoteWrapperContract,
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

    // Store the ConstantInitialVoiceCreditProxyFactory as well
    await storage.register({
      id: "ConstantInitialVoiceCreditProxyFactory",
      contract: constantVoiceCreditProxyFactoryContract,
      args: [],
      network: hre.network.name,
    });

    // Count configured factories
    let configuredFactories = 0;
    if (anonAadhaarCheckerFactory && anonAadhaarPolicyFactory) configuredFactories++;
    if (erc20CheckerFactory && erc20PolicyFactory) configuredFactories++;
    if (tokenCheckerFactory && tokenPolicyFactory) configuredFactories++;
    if (easCheckerFactory && easPolicyFactory) configuredFactories++;
    if (gitcoinCheckerFactory && gitcoinPolicyFactory) configuredFactories++;
    if (merkleCheckerFactory && merklePolicyFactory) configuredFactories++;
    if (semaphoreCheckerFactory && semaphorePolicyFactory) configuredFactories++;
    if (zupassCheckerFactory && zupassPolicyFactory) configuredFactories++;
    if (freeForAllCheckerFactory && freeForAllPolicyFactory) configuredFactories++;

    logGreen({ text: info(`🎉 PrivoteWrapper deployed successfully!`) });
    logGreen({ text: info(`📍 Contract address: ${await privoteWrapperContract.getAddress()}`) });
    logGreen({ text: info(`🏭 Configured ${configuredFactories}/9 policy factory pairs`) });
    logGreen({ text: info(`🗳️  Voice credit proxy factory: ${constantVoiceCreditProxyFactoryAddress}`) });
    logGreen({ text: info(`✅ Ready for multi-policy poll creation!`) });
  }),
);

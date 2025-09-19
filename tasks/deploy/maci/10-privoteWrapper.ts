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
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

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
    console.log("setting config");
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
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    const policyContract = await deployment.getContract<IBasePolicy>({
      name: fullPolicyName,
      address: policyContractAddress,
    });
    const privoteInstanceAddress = await privoteWrapperContract.getAddress();
    console.log("setting target");
    await policyContract.setTarget(privoteInstanceAddress).then((tx) => tx.wait());
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Deploy ConstantInitialVoiceCreditProxyFactory for voice credit proxy deployment
    const constantVoiceCreditProxyFactoryContract = await deployment.deployContract({
      name: "ConstantInitialVoiceCreditProxyFactory",
      signer: deployer,
    });
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    const constantVoiceCreditProxyFactoryAddress = await constantVoiceCreditProxyFactoryContract.getAddress();
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set the constant voice credit proxy factory
    console.log("setting constant voice credit proxy factory");
    await privoteWrapperContract.setConstantVoiceCreditProxyFactory(constantVoiceCreditProxyFactoryAddress);
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000)); 
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
    console.log("setting anon aadhaar factories");
    if (anonAadhaarCheckerFactory && anonAadhaarPolicyFactory) {
      await privoteWrapperContract.setAnonAadhaarFactories(anonAadhaarCheckerFactory, anonAadhaarPolicyFactory);
      logGreen({ text: info("✓ AnonAadhaar factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set ERC20 factories
    const erc20CheckerFactory = getFactoryAddress(ECheckerFactories.ERC20, hre.network.name);
    const erc20PolicyFactory = getFactoryAddress(EPolicyFactories.ERC20, hre.network.name);
    console.log("setting erc20 factories");
    if (erc20CheckerFactory && erc20PolicyFactory) {
      await privoteWrapperContract.setERC20Factories(erc20CheckerFactory, erc20PolicyFactory);
      logGreen({ text: info("✓ ERC20 factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set Token factories
    const tokenCheckerFactory = getFactoryAddress(ECheckerFactories.Token, hre.network.name);
    const tokenPolicyFactory = getFactoryAddress(EPolicyFactories.Token, hre.network.name);
    console.log("setting token factories");
    if (tokenCheckerFactory && tokenPolicyFactory) {
      await privoteWrapperContract.setTokenFactories(tokenCheckerFactory, tokenPolicyFactory);
      logGreen({ text: info("✓ Token factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set EAS factories
    const easCheckerFactory = getFactoryAddress(ECheckerFactories.EAS, hre.network.name);
    const easPolicyFactory = getFactoryAddress(EPolicyFactories.EAS, hre.network.name);
    console.log("setting eas factories");
    if (easCheckerFactory && easPolicyFactory) {
      await privoteWrapperContract.setEASFactories(easCheckerFactory, easPolicyFactory);
      logGreen({ text: info("✓ EAS factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set GitCoin factories
    const gitcoinCheckerFactory = getFactoryAddress(ECheckerFactories.GitcoinPassport, hre.network.name);
    const gitcoinPolicyFactory = getFactoryAddress(EPolicyFactories.GitcoinPassport, hre.network.name);
    console.log("setting gitcoin factories");
    if (gitcoinCheckerFactory && gitcoinPolicyFactory) {
      await privoteWrapperContract.setGitcoinFactories(gitcoinCheckerFactory, gitcoinPolicyFactory);
      logGreen({ text: info("✓ GitCoin factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set Merkle factories
    const merkleCheckerFactory = getFactoryAddress(ECheckerFactories.MerkleProof, hre.network.name);
    const merklePolicyFactory = getFactoryAddress(EPolicyFactories.MerkleProof, hre.network.name);
    console.log("setting merkle factories");
    if (merkleCheckerFactory && merklePolicyFactory) {
      await privoteWrapperContract.setMerkleFactories(merkleCheckerFactory, merklePolicyFactory);
      logGreen({ text: info("✓ Merkle factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set Semaphore factories
    const semaphoreCheckerFactory = getFactoryAddress(ECheckerFactories.Semaphore, hre.network.name);
    const semaphorePolicyFactory = getFactoryAddress(EPolicyFactories.Semaphore, hre.network.name);
    console.log("setting semaphore factories");
    if (semaphoreCheckerFactory && semaphorePolicyFactory) {
      await privoteWrapperContract.setSemaphoreFactories(semaphoreCheckerFactory, semaphorePolicyFactory);
      logGreen({ text: info("✓ Semaphore factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set Zupass factories
    const zupassCheckerFactory = getFactoryAddress(ECheckerFactories.Zupass, hre.network.name);
    const zupassPolicyFactory = getFactoryAddress(EPolicyFactories.Zupass, hre.network.name);
    console.log("setting zupass factories");
    if (zupassCheckerFactory && zupassPolicyFactory) {
      await privoteWrapperContract.setZupassFactories(zupassCheckerFactory, zupassPolicyFactory);
      logGreen({ text: info("✓ Zupass factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Set Free For All factories
    const freeForAllCheckerFactory = getFactoryAddress(ECheckerFactories.FreeForAll, hre.network.name);
    const freeForAllPolicyFactory = getFactoryAddress(EPolicyFactories.FreeForAll, hre.network.name);
    console.log("setting free for all factories");
    if (freeForAllCheckerFactory && freeForAllPolicyFactory) {
      await privoteWrapperContract.setFreeForAllFactories(freeForAllCheckerFactory, freeForAllPolicyFactory);
      logGreen({ text: info("✓ Free For All factories configured") });
    }
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("registering privote wrapper");
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
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Store the Privote contract same as wrapper contract as both are the same contract
    console.log("registering privote");
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
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Store the ConstantInitialVoiceCreditProxyFactory as well
    console.log("registering constant initial voice credit proxy factory");
    await storage.register({
      id: "ConstantInitialVoiceCreditProxyFactory",
      contract: constantVoiceCreditProxyFactoryContract,
      args: [],
      network: hre.network.name,
    });
    //timeout 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
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

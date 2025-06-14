import { info, logGreen } from "@maci-protocol/contracts";
import { EDeploySteps } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { EContracts, IDeployParams } from "@maci-protocol/contracts";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(EDeploySteps.MessageProcessorFactory, "Deploy message processor factory").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    const messageProcessorFactoryContractAddress = storage.getAddress(
      EContracts.MessageProcessorFactory,
      hre.network.name,
    );

    if (incremental && messageProcessorFactoryContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${EContracts.MessageProcessorFactory} contract`) });
      return;
    }

    const poseidonT3ContractAddress = storage.mustGetAddress(EContracts.PoseidonT3, hre.network.name);
    const poseidonT4ContractAddress = storage.mustGetAddress(EContracts.PoseidonT4, hre.network.name);
    const poseidonT5ContractAddress = storage.mustGetAddress(EContracts.PoseidonT5, hre.network.name);
    const poseidonT6ContractAddress = storage.mustGetAddress(EContracts.PoseidonT6, hre.network.name);

    const libraries = {
      "contracts/crypto/PoseidonT3.sol:PoseidonT3": poseidonT3ContractAddress,
      "contracts/crypto/PoseidonT4.sol:PoseidonT4": poseidonT4ContractAddress,
      "contracts/crypto/PoseidonT5.sol:PoseidonT5": poseidonT5ContractAddress,
      "contracts/crypto/PoseidonT6.sol:PoseidonT6": poseidonT6ContractAddress,
    };

    const linkedMessageProcessorFactoryContract = await hre.ethers.getContractFactory(
      EContracts.MessageProcessorFactory,
      {
        signer: deployer,
        libraries,
      },
    );

    const messageProcessorFactoryContract = await deployment.deployContractWithLinkedLibraries({
      contractFactory: linkedMessageProcessorFactoryContract,
    });

    await storage.register({
      id: EContracts.MessageProcessorFactory,
      contract: messageProcessorFactoryContract,
      libraries,
      args: [],
      network: hre.network.name,
    });
  }),
);

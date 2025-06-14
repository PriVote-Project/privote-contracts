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
deployment.deployTask(EDeploySteps.Verifier, "Deploy verifier").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    const verifierContractAddress = storage.getAddress(EContracts.Verifier, hre.network.name);

    if (incremental && verifierContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${EContracts.Verifier} contract`) });
      return;
    }

    const verifierContract = await deployment.deployContract({ name: EContracts.Verifier, signer: deployer });

    await storage.register({
      id: EContracts.Verifier,
      contract: verifierContract,
      args: [],
      network: hre.network.name,
    });
  }),
);

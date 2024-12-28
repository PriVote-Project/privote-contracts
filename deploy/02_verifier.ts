import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { VerifierContractName } from "../constants";
import { ContractStorage, EContracts } from "maci-contracts";

import type { Verifier } from "../typechain-types";

const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  await hre.deployments.deploy(VerifierContractName, {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const verifier = await hre.ethers.getContract<Verifier>(VerifierContractName, deployer);
  console.log(`The verifier is deployed at ${await verifier.getAddress()}`);

  await storage.register({
    id: EContracts.Verifier,
    contract: verifier,
    args: [],
    network: hre.network.name,
  });
};

export default deployContracts;

deployContracts.tags = ["Verifier"];

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

import { ContractStorage, EContracts } from "maci-contracts";

import type { TallyFactory } from "../typechain-types";

const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const poseidonT3 = await hre.ethers.getContract("PoseidonT3", deployer);
  const poseidonT4 = await hre.ethers.getContract("PoseidonT4", deployer);
  const poseidonT5 = await hre.ethers.getContract("PoseidonT5", deployer);
  const poseidonT6 = await hre.ethers.getContract("PoseidonT6", deployer);

  await hre.deployments.deploy("TallyFactory", {
    from: deployer,
    args: [],
    log: true,
    libraries: {
      PoseidonT3: await poseidonT3.getAddress(),
      PoseidonT4: await poseidonT4.getAddress(),
      PoseidonT5: await poseidonT5.getAddress(),
      PoseidonT6: await poseidonT6.getAddress(),
    },
    autoMine: true,
  });

  const tallyFactory = await hre.ethers.getContract<TallyFactory>("TallyFactory", deployer);

  await storage.register({
    id: EContracts.TallyFactory,
    contract: tallyFactory,
    args: [],
    network: hre.network.name,
  });

  console.log(`The tally factory is deployed at ${await tallyFactory.getAddress()}`);
};

export default deployContracts;

deployContracts.tags = ["TallyFactory"];

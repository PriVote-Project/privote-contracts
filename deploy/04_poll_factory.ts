import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ContractStorage, EContracts } from "maci-contracts";

import { getNetworkName, getAuthType } from "../utils";
import { PollType } from "../utils/types";
import type { PollFactory } from "../typechain-types";

const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const pollType = process.env.POLL_TYPE as PollType;

  const poseidonT3 = await hre.ethers.getContract("PoseidonT3", deployer);
  const poseidonT4 = await hre.ethers.getContract("PoseidonT4", deployer);
  const poseidonT5 = await hre.ethers.getContract("PoseidonT5", deployer);
  const poseidonT6 = await hre.ethers.getContract("PoseidonT6", deployer);

  await hre.deployments.deploy("PollFactory", {
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

  const pollFactory = await hre.ethers.getContract<PollFactory>("PollFactory", deployer);

  console.log(`The poll factory is deployed at ${await pollFactory.getAddress()}`);

  await storage.register({
    id: EContracts.PollFactory,
    contract: pollFactory,
    args: [],
    network: getNetworkName(hre.network.name, getAuthType(process.env.GATEKEEPER_CONTRACT_NAME), pollType),
  });
};

export default deployContracts;

deployContracts.tags = ["PollFactory"];

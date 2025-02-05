import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { VerifierContractName } from "../constants";
import { ContractStorage, EContracts } from "maci-contracts";

import { getAuthType, getNetworkName } from "../utils";
import { PollType } from "../utils/types";
import type { Verifier } from "../typechain-types";

const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const pollType = process.env.POLL_TYPE as PollType;

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
    network: getNetworkName(hre.network.name, getAuthType(process.env.GATEKEEPER_CONTRACT_NAME), pollType),
  });
};

export default deployContracts;

deployContracts.tags = ["Verifier"];

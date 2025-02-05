import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { InitialVoiceCreditProxyContractName } from "../constants";
import { ContractStorage, EContracts } from "maci-contracts";
import { getAuthType, getNetworkName, getInitialVoiceCredits } from "../utils";
import { PollType } from "../utils/types";

import type { ConstantInitialVoiceCreditProxy } from "../typechain-types";

const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const pollType = process.env.POLL_TYPE as PollType;

  await hre.deployments.deploy(InitialVoiceCreditProxyContractName, {
    from: deployer,
    args: [getInitialVoiceCredits(pollType)],
    log: true,
    autoMine: true,
  });

  const initialVoiceCreditProxy = await hre.ethers.getContract<ConstantInitialVoiceCreditProxy>(
    InitialVoiceCreditProxyContractName,
    deployer,
  );
  console.log(`The initial voice credit proxy is deployed at ${await initialVoiceCreditProxy.getAddress()}`);
  await storage.register({
    id: EContracts.ConstantInitialVoiceCreditProxy,
    contract: initialVoiceCreditProxy,
    args: [getInitialVoiceCredits(pollType).toString()],
    network: getNetworkName(hre.network.name, getAuthType(process.env.GATEKEEPER_CONTRACT_NAME), pollType),
  });
};

export default deployContracts;

deployContracts.tags = ["InitialVoiceCreditProxy"];

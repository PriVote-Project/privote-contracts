import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { InitialVoiceCreditProxyContractName, stateTreeDepth } from "../constants";
import { genEmptyBallotRoots, ContractStorage, EContracts, type SignUpGatekeeper } from "maci-contracts";
import { getNetworkName, getAuthType } from "../utils";

import { Privote } from "../typechain-types";

const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  let GatekeeperContractName = process.env.GATEKEEPER_CONTRACT_NAME;
  if (GatekeeperContractName == null) {
    GatekeeperContractName = "FreeForAllGatekeeper";
  }
  const poseidonT3 = await hre.ethers.getContract("PoseidonT3", deployer);
  const poseidonT4 = await hre.ethers.getContract("PoseidonT4", deployer);
  const poseidonT5 = await hre.ethers.getContract("PoseidonT5", deployer);
  const poseidonT6 = await hre.ethers.getContract("PoseidonT6", deployer);
  const initialVoiceCreditProxy = await hre.ethers.getContract(InitialVoiceCreditProxyContractName, deployer);
  const gatekeeper = await hre.ethers.getContract<SignUpGatekeeper>(GatekeeperContractName, deployer);
  const pollFactory = await hre.ethers.getContract("PollFactory", deployer);
  const messageProcessorFactory = await hre.ethers.getContract("MessageProcessorFactory", deployer);
  const tallyFactory = await hre.ethers.getContract("TallyFactory", deployer);
  const emptyBallotRoots = genEmptyBallotRoots(stateTreeDepth);
  const stake = "10000000000000000";
  const threshold = "100000000000000";
  await hre.deployments.deploy("Privote", {
    from: deployer,
    args: [
      await pollFactory.getAddress(),
      await messageProcessorFactory.getAddress(),
      await tallyFactory.getAddress(),
      await gatekeeper.getAddress(),
      await initialVoiceCreditProxy.getAddress(),
      stateTreeDepth,
      emptyBallotRoots,
      stake,
      threshold,
    ],
    log: true,
    libraries: {
      PoseidonT3: await poseidonT3.getAddress(),
      PoseidonT4: await poseidonT4.getAddress(),
      PoseidonT5: await poseidonT5.getAddress(),
      PoseidonT6: await poseidonT6.getAddress(),
    },
    autoMine: true,
  });

  const maci = await hre.ethers.getContract<Privote>("Privote", deployer);

  console.log(
    `The Privote contract is deployed at ${await maci.getAddress()} with gatekeeper ${await gatekeeper.getAddress()}`,
  );

  const tx = await gatekeeper.setMaciInstance(await maci.getAddress());
  await tx.wait(1);

  await storage.register({
    id: EContracts.MACI,
    // @ts-expect-error expected maci
    contract: maci,
    args: [
      await pollFactory.getAddress(),
      await messageProcessorFactory.getAddress(),
      await tallyFactory.getAddress(),
      await gatekeeper.getAddress(),
      await initialVoiceCreditProxy.getAddress(),
      stateTreeDepth,
      emptyBallotRoots.map((root: bigint) => root.toString()),
      stake,
      threshold,
    ],
    network: getNetworkName(hre.network.name, getAuthType(GatekeeperContractName)),
  });
};

export default deployContracts;

deployContracts.tags = ["MACI"];

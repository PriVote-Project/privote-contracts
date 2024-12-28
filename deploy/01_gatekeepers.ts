import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ContractStorage, EContracts } from "maci-contracts";
import { FreeForAllGatekeeper } from "../typechain-types/";
const storage = ContractStorage.getInstance();

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  if (process.env.GATEKEEPER_CONTRACT_NAME == null || process.env.GATEKEEPER_CONTRACT_NAME === "FreeForAllGatekeeper") {
    const contractName = "FreeForAllGatekeeper";

    await hre.deployments.deploy(contractName, {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });

    const gatekeeper = await hre.ethers.getContract<FreeForAllGatekeeper>(contractName, deployer);
    console.log(`The gatekeeper is deployed at ${await gatekeeper.getAddress()}`);
    await storage.register({
      id: EContracts.FreeForAllGatekeeper,
      contract: gatekeeper,
      network: hre.network.name,
      args: [],
    });
  } else {
    console.log("Skipping FreeForAllGatekeeper deployment");
  }
};

export default deployContracts;

deployContracts.tags = ["FreeForAllGatekeeper"];

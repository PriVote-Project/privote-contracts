import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { DestinationPrivoteContractName } from "../constants";

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const privote = await hre.ethers.getContract("Privote", deployer);
  console.log("privote", await privote.getAddress());
  await hre.deployments.deploy(DestinationPrivoteContractName, {
    from: deployer,
    args: ["0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", await privote.getAddress()],
    log: true,
    autoMine: true,
  });

  const destinationPrivote = await hre.ethers.getContract(DestinationPrivoteContractName, deployer);
  console.log(`The destinationPrivote is deployed at ${await destinationPrivote.getAddress()}`);
};

export default deployContracts;

deployContracts.tags = ["DestinationPrivote"];

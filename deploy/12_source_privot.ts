import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { sourcePrivoteContractName } from "../constants";

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  await hre.deployments.deploy(sourcePrivoteContractName, {
    from: deployer,
    args: ["0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165", "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E"],
    log: true,
    autoMine: true,
  });

  const sourcePrivote = await hre.ethers.getContract(sourcePrivoteContractName, deployer);
  console.log(`The sourcePrivote is deployed at ${await sourcePrivote.getAddress()}`);
};

export default deployContracts;

deployContracts.tags = ["SourcePrivote"];

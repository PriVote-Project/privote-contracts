import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { AnonAadhaarVerifierContractName } from "../constants";

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (process.env.GATEKEEPER_CONTRACT_NAME === "AnonAadhaarGatekeeper") {
    const { deployer } = await hre.getNamedAccounts();
    const contractName = "AnonAadhaarGatekeeper";

    console.log("Deploying AnonAadhaar contracts...");

    // Deploy AnonAadhaarVerifier contract
    const anonAadhaarVerifier = await hre.deployments.deploy(AnonAadhaarVerifierContractName, {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });

    // Generate a random nullifier seed
    const nullifierSeed = "4534";

    // Deploy AnonAadhaarGatekeeper contract
    await hre.deployments.deploy(contractName, {
      from: deployer,
      args: [anonAadhaarVerifier.address, nullifierSeed],
      log: true,
      autoMine: true,
    });

    const gatekeeper = await hre.ethers.getContract(contractName, deployer);
    console.log(
      `The AnonAadhaarGatekeeper is deployed at ${await gatekeeper.getAddress()}, with nullifier seed ${nullifierSeed}`,
    );
  } else {
    console.log("Skipping AnonAadhaarGatekeeper deployment");
  }
};

export default deployContracts;

deployContracts.tags = ["AnonAadhaarGatekeeper"];

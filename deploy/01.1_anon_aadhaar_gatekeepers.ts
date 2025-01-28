import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { AnonAadhaarVerifierContractName, AnonAadhaarContractName } from "../constants";
import { ContractStorage, EContracts } from "maci-contracts";

import { getNetworkName, getAuthType } from "../utils";

import { AnonAadhaarGatekeeper } from "../typechain-types";

const storage = ContractStorage.getInstance();
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
    const testPubkeyHash = "15134874015316324267425466444584014077184337590635665158241104437045239495873";
    // Deploy AnonAadhaar contract\
    const anonAadhaar = await hre.deployments.deploy(AnonAadhaarContractName, {
      from: deployer,
      args: [anonAadhaarVerifier.address, testPubkeyHash],
      log: true,
      autoMine: true,
    });

    console.log(`The AnonAadhaarVerifier is deployed at ${anonAadhaarVerifier.address}`);
    console.log(`The AnonAadhaar is deployed at ${anonAadhaar.address}, with pubkey hash ${testPubkeyHash}`);

    // Generate a random nullifier seed
    const nullifierSeed = "4534";

    // Deploy AnonAadhaarGatekeeper contract
    await hre.deployments.deploy(contractName, {
      from: deployer,
      args: [anonAadhaar.address, nullifierSeed],
      log: true,
      autoMine: true,
    });

    const gatekeeper = await hre.ethers.getContract<AnonAadhaarGatekeeper>(contractName, deployer);
    console.log(
      `The AnonAadhaarGatekeeper is deployed at ${await gatekeeper.getAddress()}, with nullifier seed ${nullifierSeed}`,
    );
    await storage.register({
      id: EContracts.FreeForAllGatekeeper,
      contract: gatekeeper,
      network: getNetworkName(hre.network.name, getAuthType(process.env.GATEKEEPER_CONTRACT_NAME)),
      args: [],
    });
  } else {
    console.log("Skipping AnonAadhaarGatekeeper deployment");
  }
};

export default deployContracts;

deployContracts.tags = ["AnonAadhaarGatekeeper"];

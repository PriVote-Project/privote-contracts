import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import fs from "fs";

import { getNetworkName, getAuthType } from "../utils";
import { PollType } from "../utils/types";

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const pollType = process.env.POLL_TYPE as PollType;

  const privote = await hre.ethers.getContract("Privote", deployer);
  const initialVoiceCreditProxy = await hre.ethers.getContract("ConstantInitialVoiceCreditProxy", deployer);
  const gatekeeper = await hre.ethers.getContract(
    process.env.GATEKEEPER_CONTRACT_NAME || "FreeForAllGatekeeper",
    deployer,
  );
  const verifier = await hre.ethers.getContract("Verifier", deployer);
  const pollFactory = await hre.ethers.getContract("PollFactory", deployer);
  const poseidonT3 = await hre.ethers.getContract("PoseidonT3", deployer);
  const poseidonT4 = await hre.ethers.getContract("PoseidonT4", deployer);
  const poseidonT5 = await hre.ethers.getContract("PoseidonT5", deployer);
  const poseidonT6 = await hre.ethers.getContract("PoseidonT6", deployer);
  const vkRegistry = await hre.ethers.getContract("VkRegistry", deployer);

  const filePath = "./contractAddresses.json";
  let contractAddresses: { [key: string]: any } = {};

  // Read existing data from the file if it exists
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf8");
    contractAddresses = JSON.parse(fileData);
  }

  let networkName = getNetworkName(hre.network.name, getAuthType(process.env.GATEKEEPER_CONTRACT_NAME), pollType);

  // Update the entry for the current network
  contractAddresses[networkName] = {
    MACI: await privote.getAddress(),
    InitialVoiceCreditProxy: await initialVoiceCreditProxy.getAddress(),
    SignUpGatekeeper: await gatekeeper.getAddress(),
    Verifier: await verifier.getAddress(),
    PollFactory: await pollFactory.getAddress(),
    PoseidonT3: await poseidonT3.getAddress(),
    PoseidonT4: await poseidonT4.getAddress(),
    PoseidonT5: await poseidonT5.getAddress(),
    PoseidonT6: await poseidonT6.getAddress(),
    VkRegistry: await vkRegistry.getAddress(),
  };

  // Write the updated data back to the file
  fs.writeFileSync(filePath, JSON.stringify(contractAddresses, undefined, 4));
};

export default deployContracts;

deployContracts.tags = ["GenerateAddressFile"];

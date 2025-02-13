import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import fs from "fs";
import { Keypair } from "maci-domainobjs";
import { intStateTreeDepth, messageTreeDepth, voteOptionTreeDepth, messageTreeSubDepth } from "../constants";
import { Privote, Verifier, VkRegistry } from "../typechain-types";

function fetchOrCreateKeyPair(filePath: string) {
  let keypair: Keypair | null = null;
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    const jsonPair = JSON.parse(data.toString("utf-8"));
    keypair = Keypair.fromJSON(jsonPair);
  }
  if (!keypair) {
    keypair = new Keypair();
    fs.writeFileSync(filePath, JSON.stringify(keypair.toJSON()));
  }

  return keypair as Keypair;
}

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const maci = await hre.ethers.getContract<Privote>("Privote", deployer);

  // update the config on the poll manager
  const verifier = await hre.ethers.getContract<Verifier>("Verifier", deployer);
  const vkRegistry = await hre.ethers.getContract<VkRegistry>("VkRegistry", deployer);

  // generate and save the coordinator key pair
  const filePath = "./coordinatorKeyPair.json";
  const coordinatorKeypair = fetchOrCreateKeyPair(filePath);

  const tx = await maci.setConfig(
    {
      intStateTreeDepth: intStateTreeDepth,
      messageTreeSubDepth: messageTreeSubDepth,
      messageTreeDepth: messageTreeDepth,
      voteOptionTreeDepth: voteOptionTreeDepth,
    },
    // coordinatorKeypair.pubKey.asContractParam(),
    await verifier.getAddress(),
    await vkRegistry.getAddress(),
  );
  await tx.wait(1);
};

export default deployContracts;

deployContracts.tags = ["SubsidyFactory"];

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ContractStorage, EContracts } from "maci-contracts";

const storage = ContractStorage.getInstance();

async function deployPoseidenContract(
  name: "PoseidonT3" | "PoseidonT4" | "PoseidonT5" | "PoseidonT6",
  hre: HardhatRuntimeEnvironment,
) {
  const { deployer } = await hre.getNamedAccounts();

  await hre.deployments.deploy(name, {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const poseidon = await hre.ethers.getContract(name, deployer);
  return poseidon;
}

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const poseidonT3 = await deployPoseidenContract("PoseidonT3", hre);
  console.log(`The poseidonT3 is deployed at ${await poseidonT3.getAddress()}`);

  const poseidonT4 = await deployPoseidenContract("PoseidonT4", hre);
  console.log(`The poseidonT4 is deployed at ${await poseidonT4.getAddress()}`);

  const poseidonT5 = await deployPoseidenContract("PoseidonT5", hre);
  console.log(`The poseidonT5 is deployed at ${await poseidonT5.getAddress()}`);

  const poseidonT6 = await deployPoseidenContract("PoseidonT6", hre);
  console.log(`The poseidonT6 is deployed at ${await poseidonT6.getAddress()}`);

  await storage.register({
    id: EContracts.PoseidonT3,
    // @ts-expect-error mismatch
    contract: poseidonT3,
    args: [],
    network: hre.network.name,
  });

  await storage.register({
    id: EContracts.PoseidonT4,
    // @ts-expect-error mismatch
    contract: poseidonT4,
    args: [],
    network: hre.network.name,
  });

  await storage.register({
    id: EContracts.PoseidonT5,
    // @ts-expect-error mismatch
    contract: poseidonT5,
    args: [],
    network: hre.network.name,
  });

  await storage.register({
    id: EContracts.PoseidonT6,
    // @ts-expect-error mismatch
    contract: poseidonT6,
    args: [],
    network: hre.network.name,
  });
};

export default deployContracts;

deployContracts.tags = ["Poseidon"];

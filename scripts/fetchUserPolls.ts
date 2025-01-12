import { ethers } from "hardhat";
import { Privote } from "../typechain-types";
import * as maciContract from "../deployments/localhost/Privote.json";

async function main() {
  const [deployer] = await ethers.getSigners();

  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);

  const userAddress = deployer.address; // Replace with the user's address
  const page = 1;
  const perPage = 10;
  const ascending = false;

  try {
    const polls = await maci.fetchUserPolls(userAddress, page, perPage, ascending);
    console.log("User Polls:", polls);
  } catch (error) {
    console.error("Error fetching user polls:", error);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

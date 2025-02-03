import { ethers } from "hardhat";
import * as maciContract from "../deployments/localhost/Privote.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);

  // Set the pollId you want to fetch results from
  const pollId = 0; // Replace with the desired pollId

  try {
    const results = await maci.getPollResult(pollId);
    console.log("Poll Results:", results);
  } catch (error) {
    console.error("Error fetching poll results:", error);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";
import { Privote } from "../typechain-types";
import { Keypair } from "maci-domainobjs";
import * as maciContract from "../deployments/sepolia/Privote.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  //   const maci = await ethers.getContract<Privote>("Privote", deployer);
  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);

  const stake = "10000000000000000";

  // run the createPoll function
  const createPollTx = await maci.createPoll(
    "PollNameg", // _name
    ["test 1", "test 2"], // _options
    ["0x", "0x"], // _optionInfo
    "Poll Metadata", // _metadata
    86400, // _duration (example duration in seconds)
    0, // isQv
    {
      x: "7241728685366863917285668999330892372683604660822807916359904479991538689337",
      y: "15227291638174786727851591747573626451311594421326528332958841360833178655475",
    }, // coordinatorPubKey
    "none", // authType
    { value: stake }, // Pass the stake value as msg.value
  );

  await createPollTx.wait(1);
  console.log("Poll created");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

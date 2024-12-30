import { ethers } from "hardhat";
import { Privote } from "../typechain-types";
import { Keypair, PrivKey } from "maci-domainobjs";
import * as maciContract from "../deployments/localhost/Privote.json";
import coordinatorKeyPair from "../coordinatorKeyPair.json";

async function main() {
  const [deployer] = await ethers.getSigners();

  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);

  const stake = "10000000000000000";

  const polltype = {
    pollType: 1,
  };

  const newKeypair = Keypair.fromJSON(coordinatorKeyPair);
  // run the createPoll function with dummy data
  const createPollTx = await maci.createPoll(
    "third Poll", // _name
    ["test 1", "test 2"], // _options
    [
      "0x1220f9b143d20c5e45c4dc68e3503e87de1362483228fb879ff0bf077f3cea09e342",
      "0x1220a8e180adeb4552998c010380598a4a27c54042de65c4998099c49e62d0aab575",
    ], // _optionInfo
    JSON.stringify(polltype), // _metadata
    150, // _duration (example duration in seconds)
    1, // isQv
    newKeypair.pubKey.asContractParam(), // coordinatorPubKey
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

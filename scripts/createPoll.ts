import { ethers } from "hardhat";
import { Privote } from "../typechain-types";
import { Keypair } from "maci-domainobjs";
import * as maciContract from "../deployments/sepolia/Privote.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  //   const maci = await ethers.getContract<Privote>("Privote", deployer);
  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);

  const stake = "10000000000000000";

  const polltype = {
    pollType: 1,
  };
  // run the createPoll function
  const createPollTx = await maci.createPoll(
    "Second Poll", // _name
    ["test 1", "test 2"], // _options
    [
      "0x1220f9b143d20c5e45c4dc68e3503e87de1362483228fb879ff0bf077f3cea09e342",
      "0x1220a8e180adeb4552998c010380598a4a27c54042de65c4998099c49e62d0aab575",
    ], // _optionInfo
    JSON.stringify(polltype), // _metadata
    1500, // _duration (example duration in seconds)
    1, // isQv
    {
      x: "13535291647970247930571087761159266333028401619892661034694917035715014373354",
      y: "10433700327017784209221532426023326189334505034888576969273601943943499914081",
    }, // coordinatorPubKey
    "none", // authType
    { value: stake }, // Pass the stake value as msg.value
  );

  // const createPollTx = await maci.createPoll(
  //   “Second Poll”,
  //   [‘Candidate 1', 'Candidate 2’],
  //   ['0x1220f9b143d20c5e45c4dc68e3503e87de1362483228fb879ff0bf077f3cea09e342', '0x1220a8e180adeb4552998c010380598a4a27c54042de65c4998099c49e62d0aab575’],
  //     "{\"pollType\”:1}”,1342n,
  //     1,
  //     {x: '13535291647970247930571087761159266333028401619892661034694917035715014373354', y: '10433700327017784209221532426023326189334505034888576969273601943943499914081’},
  //     "none”,
  //   { value: stake }, // Pass the stake value as msg.value
  // );

  await createPollTx.wait(1);
  console.log("Poll created");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

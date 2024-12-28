import { ethers } from "hardhat";
import { Privote } from "../typechain-types";
import { Keypair, PrivKey } from "maci-domainobjs";
import * as maciContract from "../deployments/localhost/Privote.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  // log private key of signer
  console.log("deployer private key", deployer.getAddress());
  //   const maci = await ethers.getContract<Privote>("Privote", deployer);
  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);

  const stake = "10000000000000000";

  const polltype = {
    pollType: 1,
  };

  const newPrivKey = PrivKey.deserialize("macisk.f35e560a041028fdedb668b5cc694fd1f006257b1323f48ff33738bde4f9529b");
  const newKeypair = new Keypair(newPrivKey);
  // run the createPoll function
  const createPollTx = await maci.createPoll(
    "third Poll", // _name
    ["test 1", "test 2"], // _options
    [
      "0x1220f9b143d20c5e45c4dc68e3503e87de1362483228fb879ff0bf077f3cea09e342",
      "0x1220a8e180adeb4552998c010380598a4a27c54042de65c4998099c49e62d0aab575",
    ], // _optionInfo
    JSON.stringify(polltype), // _metadata
    100, // _duration (example duration in seconds)
    1, // isQv
    newKeypair.pubKey.asContractParam(), // coordinatorPubKey
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
  // run the signUp function
  await createPollTx.wait(1);
  console.log("Poll created");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";
import { Privote } from "../typechain-types";
import * as maciContract from "../deployments/localhost/Privote.json";
import pollAbi from "../artifacts/maci-contracts/contracts/Poll.sol/Poll.json";
import { genRandomSalt } from "maci-crypto";
import { Keypair, PCommand, PubKey } from "maci-domainobjs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const maci = new ethers.Contract(maciContract.address, maciContract.abi, deployer);
  // votes for first poll created using createPoll
  const pollContract = await maci.fetchPoll(0);
  const poll = new ethers.Contract(pollContract.pollContracts.poll, pollAbi.abi, deployer);
  const coordinatorPubKeyResult = await poll.coordinatorPubKey();
  const coordinatorPubKey = new PubKey([
    BigInt((coordinatorPubKeyResult as any)[0].toString()),
    BigInt((coordinatorPubKeyResult as any)[1].toString()),
  ]);
  const lazyIMTData = await maci.lazyIMTData();
  const stateIndex = lazyIMTData.numberOfLeaves;
  const votes = [
    {
      index: 1,
      votes: 1,
    },
  ];

  const encodedSignupData = "0x";
  const initialVoiceCreditProxyData = "0x";
  const newKey = new Keypair();
  const signUpTx = await maci.signUp(
    newKey.pubKey.asContractParam() as unknown as { x: bigint; y: bigint },
    encodedSignupData,
    initialVoiceCreditProxyData,
  );

  await signUpTx.wait(1);
  console.log("User signed up");

  const votesToMessage = votes.map((v, i) =>
    getMessageAndEncKeyPair(
      stateIndex,
      BigInt(0),
      BigInt(v.index),
      BigInt(v.votes),
      BigInt(votes.length - i),
      coordinatorPubKey,
      newKey,
    ),
  );

  const vote = await poll.publishMessage(
    votesToMessage[0].message.asContractParam() as unknown as {
      data: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    },
    votesToMessage[0].encKeyPair.pubKey.asContractParam() as unknown as { x: bigint; y: bigint },
  );
  await vote.wait(1);
  console.log("voted for option");
}

function getMessageAndEncKeyPair(
  stateIndex: bigint,
  pollIndex: bigint,
  candidateIndex: bigint,
  weight: bigint,
  nonce: bigint,
  coordinatorPubKey: PubKey,
  keypair: Keypair,
) {
  const command: PCommand = new PCommand(
    stateIndex,
    keypair.pubKey,
    candidateIndex,
    weight,
    nonce,
    pollIndex,
    genRandomSalt(),
  );

  const signature = command.sign(keypair.privKey);

  const encKeyPair = new Keypair();

  const message = command.encrypt(signature, Keypair.genEcdhSharedKey(encKeyPair.privKey, coordinatorPubKey));

  return { message, encKeyPair };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import hre from "hardhat";
import { Privote } from "../typechain-types";
import { Deployment, ContractStorage, EMode, EContracts } from "maci-contracts";
import { Keypair, PubKey } from "maci-domainobjs";
import { encodeOptionInfo } from "../utils/encode";
import { info, logGreen, logMagenta, logYellow, success } from "../utils/theme";
import { getPollType } from "../utils";
import { ContractPollType } from "../utils/types";

const pollOptions = [
  {
    title: "Google",
    cid: "",
    description: "Description for Google",
    link: "https://google.com",
  },
  {
    title: "Github",
    cid: "",
    description: "Description for Github",
    link: "https://github.com",
  },
];

async function main() {
  const deployment = Deployment.getInstance({ hre: hre });
  deployment.setHre(hre);

  const storage = ContractStorage.getInstance();

  // pollType, authType required to get maciContractAddress
  const authType = "free"; // free || anon
  const contractPollType = ContractPollType.SINGLE_VOTE;

  const maciContractAddress = storage.mustGetAddress(
    EContracts.MACI,
    `${hre.network.name}_${authType}_${getPollType(contractPollType)}`,
  );
  const maciContract = await deployment.getContract<Privote>({
    name: "Privote" as EContracts,
    address: maciContractAddress,
  });

  // Poll parameters (authType and pollType are defined above)
  const title = "Github vs Google 2";
  const pollDescription = "A poll to compare Github and Google";
  const stake = "10000000000000000";
  const duration = 150;
  const metadata = {
    pollType: contractPollType,
    maxVotePerPerson: 1,
    description: pollDescription,
  };
  const mode = EMode.NON_QV;

  const keypair = new Keypair();
  const coordinatorPubKey = keypair.toJSON().pubKey;
  const coordinatorPrivKey = keypair.toJSON().privKey;

  const encodedOptions = await Promise.all(
    pollOptions.map(async option => {
      return encodeOptionInfo({
        cid: (option.cid || "0x") as `0x${string}`,
        description: option.description,
        link: option.link,
      });
    }),
  );

  // run the createPoll function with dummy data
  const createPollTx = await maciContract.createPoll(
    title,
    pollOptions.map(v => v.title),
    encodedOptions || [],
    JSON.stringify(metadata),
    duration,
    mode,
    PubKey.deserialize(coordinatorPubKey).asContractParam() as {
      x: bigint;
      y: bigint;
    },
    authType,
    {
      value: stake,
    },
  );

  await createPollTx.wait(1);
  logMagenta(false, `Poll created with Coordinator PrivKey: ${coordinatorPrivKey}`);
  logYellow(false, info("Keep the coordinator private key safe to publish poll results"));
  logGreen(false, success("poll creation Successful!"));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

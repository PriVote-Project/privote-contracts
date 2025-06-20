import hre from "hardhat";
import { Privote } from "../typechain-types";
import { Deployment, ContractStorage, EMode, EContracts } from "maci-contracts";
import { Keypair, PubKey } from "maci-domainobjs";
import { encodeOptionInfo } from "../utils/encode";
import { info, logGreen, logMagenta, success } from "../utils/theme";
import { getPollType } from "../utils";
import { ContractPollType } from "../utils/types";
import * as fs from "fs";
import * as path from "path";

interface PollOption {
  title: string;
  cid: `0x${string}`;
  description: string;
  link: string;
}

interface Poll {
  title: string;
  description: string;
  stake: string;
  duration: number;
  authType: string;
  contractPollType: ContractPollType;
  maxVotePerPerson: number;
  options: PollOption[];
  mode: EMode;
}

interface PollsConfig {
  polls: Poll[];
}

interface PollDetails {
  title: string;
  pubKey: string;
  privKey: string;
}

async function main() {
  const deployment = Deployment.getInstance({ hre: hre });
  deployment.setHre(hre);

  const storage = ContractStorage.getInstance();

  // Read polls configuration from JSON file
  const pollsConfigPath = path.join(__dirname, "../config/polls.json");
  if (!fs.existsSync(pollsConfigPath)) {
    throw new Error(`File not found: ${pollsConfigPath}`);
  }
  const pollsConfig: PollsConfig = JSON.parse(fs.readFileSync(pollsConfigPath, "utf8"));

  const pollDetails: Map<string, PollDetails> = new Map<string, PollDetails>();
  const maciContracts: Map<string, Privote> = new Map<string, Privote>();

  for (const poll of pollsConfig.polls) {
    logMagenta(false, `Creating poll: ${poll.title}`);

    const contractKey = `${hre.network.name}_${poll.authType}_${getPollType(poll.contractPollType)}`;

    let maciContract: Privote;

    if (maciContracts.has(contractKey)) {
      maciContract = maciContracts.get(contractKey)!;
    } else {
      const maciContractAddress = storage.mustGetAddress(EContracts.MACI, contractKey);
      maciContract = await deployment.getContract<Privote>({
        name: "Privote" as EContracts,
        address: maciContractAddress,
      });
      maciContracts.set(contractKey, maciContract);
    }

    const metadata = {
      pollType: poll.contractPollType,
      maxVotePerPerson: poll.maxVotePerPerson,
      description: poll.description,
    };

    const keypair = new Keypair();
    const coordinatorPubKey = keypair.toJSON().pubKey;
    const coordinatorPrivKey = keypair.toJSON().privKey;

    // Encode poll options
    const encodedOptions = poll.options.map(option => encodeOptionInfo(option));

    const nextPollId = await maciContract.nextPollId();

    const tx = await maciContract.deployPoll(
      poll.title,
      poll.options.map(v => v.title),
      encodedOptions,
      JSON.stringify(metadata),
      poll.duration,
      poll.mode,
      PubKey.deserialize(coordinatorPubKey).asContractParam() as {
        x: bigint;
        y: bigint;
      },
      poll.authType,
      {
        value: poll.stake,
      },
    );

    await tx.wait();
    pollDetails.set(`${nextPollId}_${poll.authType}_${getPollType(poll.contractPollType)}`, {
      title: poll.title,
      pubKey: coordinatorPubKey,
      privKey: coordinatorPrivKey,
    });
    logGreen(false, success(`Successfully created poll: ${poll.title}`));
  }

  // Append new poll details to the existing file or create a new one if it doesn't exist
  const pollDetailsPath = path.join(__dirname, "../config/pollDetails.json");
  let existingDetails = {};
  if (fs.existsSync(pollDetailsPath)) {
    existingDetails = JSON.parse(fs.readFileSync(pollDetailsPath, "utf8"));
  }
  const updatedDetails = { ...existingDetails, ...Object.fromEntries(pollDetails) };
  fs.writeFileSync(pollDetailsPath, JSON.stringify(updatedDetails, null, 2));

  logGreen(false, info(`Saved poll details in ${pollDetailsPath}`));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

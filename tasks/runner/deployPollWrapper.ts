/* eslint-disable no-console */
import { EMode } from "@maci-protocol/core";
import { PublicKey } from "@maci-protocol/domainobjs";
import { ZeroAddress } from "ethers";
import { task, types } from "hardhat/config";

import type { PrivoteWrapper } from "../../typechain-types";

import { info, logGreen, logMagenta, logRed } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { EContracts } from "@maci-protocol/contracts";
import { CustomEContracts, POLICY_FUNCTION_MAP, PolicyType } from "../helpers/constants";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy poll using PrivoteWrapper with automatic policy and voice credit proxy deployment
 */
task("deploy-poll-wrapper", "Deploy poll using PrivoteWrapper")
  .addOptionalParam("policy", "Policy type (overrides config)", undefined, types.string)
  .addOptionalParam("voiceCredits", "Voice credits balance", 99, types.int)
  .addOptionalParam("duration", "Poll duration in seconds (overrides config)", undefined, types.int)
  .addOptionalParam("name", "Poll name (overrides config)", undefined, types.string)
  .addOptionalParam("metadata", "Poll metadata (overrides config)", undefined, types.string)
  .addOptionalParam("options", "Poll options comma-separated (overrides config)", undefined, types.string)
  .setAction(async ({ policy, voiceCredits, duration, name, metadata, options }, hre) => {
    try {
      deployment.setHre(hre);
      const deployer = await deployment.getDeployer();

      logMagenta({ text: info("🚀 Starting PrivoteWrapper poll deployment...") });

      // Get PrivoteWrapper contract
      const privoteWrapperAddress = storage.getAddress(CustomEContracts.PrivoteWrapper, hre.network.name);
      if (!privoteWrapperAddress) {
        throw new Error("PrivoteWrapper contract not found. Deploy it first with --wrapper flag.");
      }

      const privoteWrapperContract = await deployment.getContract<PrivoteWrapper>({
        name: CustomEContracts.PrivoteWrapper as any,
        address: privoteWrapperAddress,
      });

      const pollId = await privoteWrapperContract.nextPollId();
      logGreen({ text: info(`📊 Creating poll ID: ${pollId}`) });

      // Get policy type (from param or config)
      const configPolicy = deployment.getDeployConfigField<string>(EContracts.Poll, "policy") || "FreeForAllPolicy";
      const policyType = (policy || configPolicy) as PolicyType;
      
      if (!POLICY_FUNCTION_MAP[policyType]) {
        throw new Error(`Unsupported policy type: ${policyType}. Supported: ${Object.keys(POLICY_FUNCTION_MAP).join(", ")}`);
      }

      logGreen({ text: info(`🔐 Using policy: ${policyType}`) });

      // Get common poll parameters
      const coordinatorPublicKey = deployment.getDeployConfigField<string>(EContracts.Poll, "coordinatorPublicKey");
      const unserializedKey = PublicKey.deserialize(coordinatorPublicKey);

      // Handle timing
      let pollStartTimestamp = deployment.getDeployConfigField<number>(EContracts.Poll, "pollStartDate");
      let pollEndTimestamp = deployment.getDeployConfigField<number>(EContracts.Poll, "pollEndDate");
      
      if (duration) {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        pollStartTimestamp = currentTimestamp + 10;
        pollEndTimestamp = pollStartTimestamp + duration;
        console.log(`⏰ Using duration-based timing: ${duration} seconds`);
      } else if (pollStartTimestamp === 0 && pollEndTimestamp === 0) {
        const configDuration = deployment.getDeployConfigField<number>(EContracts.Poll, "duration");
        if (!configDuration || configDuration <= 0) {
          throw new Error("Duration must be specified either via --duration param or in config");
        }
        const currentTimestamp = Math.floor(Date.now() / 1000);
        pollStartTimestamp = currentTimestamp + 10;
        pollEndTimestamp = pollStartTimestamp + configDuration;
        console.log(`⏰ Using config duration: ${configDuration} seconds`);
      }

      console.log(`  📅 Start: ${new Date(pollStartTimestamp * 1000).toISOString()}`);
      console.log(`  📅 End: ${new Date(pollEndTimestamp * 1000).toISOString()}`);

      // Get other poll parameters with overrides
      const pollName = name || deployment.getDeployConfigField<string>(EContracts.Poll, "name") || `Poll ${pollId}`;
      const pollMetadata = metadata || deployment.getDeployConfigField<string>(EContracts.Poll, "metadata") || "";
      const pollOptions = options ? options.split(",").map((o: string) => o.trim()) : 
                         deployment.getDeployConfigField<string[]>(EContracts.Poll, "options") || 
                         ["Option 1", "Option 2"];
      const pollOptionInfo = deployment.getDeployConfigField<Uint8Array[]>(EContracts.Poll, "optionInfo") || 
                            new Array(pollOptions.length).fill(new Uint8Array());

      const mode = deployment.getDeployConfigField<EMode>(EContracts.Poll, "mode") ?? EMode.QV;
      const relayers = deployment
        .getDeployConfigField<string | undefined>(EContracts.Poll, "relayers")
        ?.split(",")
        .map((value) => value.trim()) || [ZeroAddress];

      console.log(`📝 Poll: "${pollName}" with ${pollOptions.length} options`);

      // Call the appropriate function based on policy type
      let txPromise: Promise<any>;

      switch (policyType) {
        case "AnonAadhaarPolicy": {
          let verifierAddress = deployment.getDeployConfigField<string>(EContracts.AnonAadhaarPolicy, "verifierAddress");
          const nullifierSeed = deployment.getDeployConfigField<string>(EContracts.AnonAadhaarPolicy, "nullifierSeed");
          
          if (!nullifierSeed) {
            throw new Error("AnonAadhaar policy requires nullifierSeed in config");
          }
          
          // If verifierAddress is not provided, deploy the AnonAadhaar contracts
          if (!verifierAddress) {
            const pubkeyHash = deployment.getDeployConfigField<string>(
              EContracts.AnonAadhaarPolicy,
              "pubkeyHash",
              true,
            );
            
            console.log("🔧 AnonAadhaar verifier not provided, deploying AnonAadhaar contracts...");
            
            // Deploy AnonAadhaarVerifier (Groth16 verifier) using consistent deployment pattern
            const anonAadhaarGroth16VerifierContract = await deployment.deployContract({
              name: "AnonAadhaarVerifier",
              signer: deployer,
            });
            const groth16VerifierAddress = await anonAadhaarGroth16VerifierContract.getAddress();
            
            // Deploy AnonAadhaar contract (main verifier that takes verifier + pubkey hash)
            // For contracts with constructor arguments, use ethers factory approach
            const anonAadhaarContractFactory = await hre.ethers.getContractFactory("AnonAadhaar", {
              signer: deployer,
            });
            const anonAadhaarContract = await anonAadhaarContractFactory.deploy(groth16VerifierAddress, pubkeyHash);
            await anonAadhaarContract.waitForDeployment();
            verifierAddress = await anonAadhaarContract.getAddress();
            
            console.log(`✅ AnonAadhaar contracts deployed successfully`);
            console.log(`   - Groth16 Verifier: ${groth16VerifierAddress}`);
            console.log(`   - AnonAadhaar Main: ${verifierAddress}`);
          }
          
          txPromise = privoteWrapperContract.createPollWithAnonAadhaar(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            verifierAddress,
            nullifierSeed,
            voiceCredits
          );
          break;
        }

        case "ERC20Policy": {
          const token = deployment.getDeployConfigField<string>(EContracts.ERC20Policy, "token");
          const threshold = deployment.getDeployConfigField<number>(EContracts.ERC20Policy, "threshold");
          if (!token || !threshold) {
            throw new Error("ERC20 policy requires token and threshold in config");
          }

          txPromise = privoteWrapperContract.createPollWithERC20(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            token,
            threshold,
            voiceCredits
          );
          break;
        }

        case "TokenPolicy": {
          const token = deployment.getDeployConfigField<string>(EContracts.TokenPolicy, "token");
          if (!token) {
            throw new Error("Token policy requires token address in config");
          }

          txPromise = privoteWrapperContract.createPollWithToken(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            token,
            voiceCredits
          );
          break;
        }

        case "EASPolicy": {
          const easAddress = deployment.getDeployConfigField<string>(EContracts.EASPolicy, "easAddress");
          const attester = deployment.getDeployConfigField<string>(EContracts.EASPolicy, "attester");
          const schema = deployment.getDeployConfigField<string>(EContracts.EASPolicy, "schema");
          if (!easAddress || !attester || !schema) {
            throw new Error("EAS policy requires easAddress, attester, and schema in config");
          }

          txPromise = privoteWrapperContract.createPollWithEAS(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            easAddress,
            attester,
            schema,
            voiceCredits
          );
          break;
        }

        case "GitcoinPassportPolicy": {
          const decoderAddress = deployment.getDeployConfigField<string>(EContracts.GitcoinPassportPolicy, "decoderAddress");
          const passingScore = deployment.getDeployConfigField<number>(EContracts.GitcoinPassportPolicy, "passingScore");
          if (!decoderAddress || passingScore === undefined) {
            throw new Error("Gitcoin policy requires decoderAddress and passingScore in config");
          }

          txPromise = privoteWrapperContract.createPollWithGitcoin(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            decoderAddress,
            passingScore,
            voiceCredits
          );
          break;
        }

        case "MerkleProofPolicy": {
          const root = deployment.getDeployConfigField<string>(EContracts.MerkleProofPolicy, "root");
          if (!root) {
            throw new Error("Merkle policy requires root in config");
          }

          txPromise = privoteWrapperContract.createPollWithMerkle(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            root,
            voiceCredits
          );
          break;
        }

        case "SemaphorePolicy": {
          const semaphoreContract = deployment.getDeployConfigField<string>(EContracts.SemaphorePolicy, "semaphoreContract");
          const groupId = deployment.getDeployConfigField<number>(EContracts.SemaphorePolicy, "groupId");
          if (!semaphoreContract || groupId === undefined) {
            throw new Error("Semaphore policy requires semaphoreContract and groupId in config");
          }

          txPromise = privoteWrapperContract.createPollWithSemaphore(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            semaphoreContract,
            groupId,
            voiceCredits
          );
          break;
        }

        case "ZupassPolicy": {
          const eventId = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "eventId");
          const signer1 = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "signer1");
          const signer2 = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "signer2");
          const verifier = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "zupassVerifier");
          
          if (!eventId || !signer1 || !signer2 || !verifier) {
            throw new Error("Zupass policy requires eventId, signer1, signer2, and zupassVerifier in config");
          }

          // Convert eventId from UUID string to bigint
          const { uuidToBigInt, hexToBigInt } = await import("@pcd/util");
          
          txPromise = privoteWrapperContract.createPollWithZupass(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            uuidToBigInt(eventId),
            hexToBigInt(signer1),
            hexToBigInt(signer2),
            verifier,
            voiceCredits
          );
          break;
        }

        case "FreeForAllPolicy": {
          txPromise = privoteWrapperContract.createPollWithFreeForAll(
            pollName,
            pollOptions,
            pollOptionInfo,
            pollMetadata,
            pollStartTimestamp,
            pollEndTimestamp,
            mode,
            unserializedKey.asContractParam(),
            relayers,
            voiceCredits
          );
          break;
        }

        default:
          throw new Error(`Unsupported policy type: ${policyType}`);
      }

      // Execute transaction
      logGreen({ text: info("📤 Submitting poll creation transaction...") });
      const receipt = await txPromise.then((tx: any) => tx.wait());

      if (receipt?.status !== 1) {
        throw new Error("Poll creation transaction failed");
      }

      // Get poll details
      const pollData = await privoteWrapperContract.polls(pollId);
      const pollContractAddress = pollData.poll;
      const messageProcessorContractAddress = pollData.messageProcessor;
      const tallyContractAddress = pollData.tally;

      // Register poll contracts in storage for future reference
      logGreen({ text: info("📝 Registering poll contracts in storage...") });
      
      const [pollFactory, messageProcessorFactory, tallyFactory] = await Promise.all([
        deployment.getContract({
          name: EContracts.PollFactory,
        }) as any,
        deployment.getContract({
          name: EContracts.MessageProcessorFactory,
        }) as any,
        deployment.getContract({
          name: EContracts.TallyFactory,
        }) as any,
      ]);

      const [pollImplementation, messageProcessorImplementation, tallyImplementation] = await Promise.all([
        pollFactory.IMPLEMENTATION(),
        messageProcessorFactory.IMPLEMENTATION(),
        tallyFactory.IMPLEMENTATION(),
      ]);

      const pollContract = await deployment.getContract({ 
        name: EContracts.Poll, 
        address: pollContractAddress 
      });
      
      const messageProcessorContract = await deployment.getContract({
        name: EContracts.MessageProcessor,
        address: messageProcessorContractAddress,
      });

      const tallyContract = await deployment.getContract({
        name: EContracts.Tally,
        address: tallyContractAddress,
      });

      await Promise.all([
        storage.register({
          id: EContracts.Poll,
          key: `poll-${pollId}`,
          implementation: pollImplementation,
          contract: pollContract,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EContracts.MessageProcessor,
          key: `poll-${pollId}`,
          implementation: messageProcessorImplementation,
          contract: messageProcessorContract,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EContracts.Tally,
          key: `poll-${pollId}`,
          implementation: tallyImplementation,
          contract: tallyContract,
          args: [],
          network: hre.network.name,
        }),
      ]);

      logGreen({ text: info("✅ Poll contracts registered in storage successfully!") });

      // Success output
      logGreen({ text: info("🎉 Poll created successfully with PrivoteWrapper!") });
      logGreen({ text: info(`📊 Poll ID: ${pollId}`) });
      logGreen({ text: info(`📝 Name: "${pollName}"`) });
      logGreen({ text: info(`🔐 Policy: ${policyType}`) });
      logGreen({ text: info(`🗳️  Voice Credits: ${voiceCredits}`) });
      logGreen({ text: info(`📍 Poll Contract: ${pollContractAddress}`) });
      logGreen({ text: info(`📨 Message Processor: ${messageProcessorContractAddress}`) });
      logGreen({ text: info(`🔢 Tally Contract: ${tallyContractAddress}`) });
      logGreen({ text: info(`⏰ Duration: ${pollEndTimestamp - pollStartTimestamp} seconds`) });

      console.log("\n" + "=".repeat(60));
      console.log("✅ Poll deployment completed successfully!");
      console.log("🚀 The policy and voice credit proxy were automatically deployed");
      console.log("📋 No additional setup required - poll is ready for signups!");
      console.log("=".repeat(60));

    } catch (err) {
      logRed({
        text: `\n=========================================================\nERROR: ${(err as Error).message}\n`,
      });
      throw err;
    }
  }); 
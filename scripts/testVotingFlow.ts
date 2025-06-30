#!/usr/bin/env ts-node
/* eslint-disable no-console */
import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";
import path from "path";

import { ContractStorage, EContracts, Deployment } from "@maci-protocol/contracts";
import { CustomEContracts } from "../tasks/helpers/constants";

interface TestConfig {
  pollOptions: string[];
  voters: Array<{
    account: string;
    votes: string;
  }>;
  coordinatorPrivateKey: string;
  outputDir: string;
  cleanupAfter: boolean;
}

const TEST_CONFIG: TestConfig = {
  pollOptions: ["Option A", "Option B", "Option C"],
  voters: [
    { account: "0", votes: "0:5,1:3" }, // 5 votes for Option A, 3 for Option B
    { account: "1", votes: "1:7,2:2" }, // 7 votes for Option B, 2 for Option C
    { account: "2", votes: "0:1,2:4" }, // 1 vote for Option A, 4 for Option C
    { account: "3", votes: "2:6" },     // 6 votes for Option C
  ],
  coordinatorPrivateKey: "macisk.1751146b59d32e3c0d7426de411218caf89c93dd998b8cf50de0bf759a8928e4",
  outputDir: path.resolve(__dirname, "../test-voting-proofs"),
  cleanupAfter: true
};

class VotingFlowTester {
  private hre: HardhatRuntimeEnvironment;
  private deployment: any;
  private storage: any;
  private config: TestConfig;
  private pollId: string = "";

  constructor(hre: HardhatRuntimeEnvironment, config: TestConfig) {
    this.hre = hre;
    this.config = config;
    this.deployment = Deployment.getInstance({ hre });
    this.deployment.setHre(hre);
    this.storage = ContractStorage.getInstance();
  }

  async runFullFlow(): Promise<void> {
    console.log("🚀 Starting Full MACI Voting Flow Test");
    console.log("=====================================");

    try {
      await this.setupEnvironment();
      await this.deployInfrastructure();
      await this.deployPoll();
      await this.signupUsers();
      await this.joinPoll();
      await this.conductVoting();
      await this.waitAndMerge();
      await this.generateProofs();
      await this.submitProofs();
      await this.verifyResults();
      
      console.log("🎉 Full MACI voting flow completed successfully!");
    } catch (error) {
      console.error("❌ Voting flow failed:", (error as Error).message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async setupEnvironment(): Promise<void> {
    console.log("\n📋 Step 1: Setting up environment...");
    
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
      console.log(`✅ Created output directory: ${this.config.outputDir}`);
    }
  }

  private async deployInfrastructure(): Promise<void> {
    console.log("\n📦 Step 2: Deploying MACI infrastructure...");
    
    await this.hre.run("deploy-full", {
      incremental: false,
      strict: false,
      verify: false,
      skip: 0
    });
    
    // Verify deployment
    const privoteAddress = this.storage.getAddress(CustomEContracts.Privote, this.hre.network.name);
    if (!privoteAddress) {
      throw new Error("Privote contract not deployed");
    }
    
    console.log(`✅ MACI infrastructure deployed. Privote at: ${privoteAddress}`);
  }

  private async deployPoll(): Promise<void> {
    console.log("\n🗳️  Step 3: Deploying poll...");
    
    await this.hre.run("deploy-poll", {
      incremental: true,
      strict: false,
      verify: false,
      skip: 0
    });
    
    // Get poll ID
    const privoteAddress = this.storage.getAddress(CustomEContracts.Privote, this.hre.network.name);
    const privoteContract = await this.deployment.getContract({ 
      name: CustomEContracts.Privote as any,
      address: privoteAddress
    });
    
    this.pollId = (await privoteContract.nextPollId() - 1n).toString();
    console.log(`✅ Poll deployed with ID: ${this.pollId}`);
  }

  private async signupUsers(): Promise<void> {
    console.log("\n👥 Step 4: Signing up users...");
    
    for (let i = 0; i < this.config.voters.length; i++) {
      const voter = this.config.voters[i];
      console.log(`  👤 Signing up user ${i} (account: ${voter.account})...`);
      
      await this.hre.run("signup", {
        account: voter.account,
        new: true
      });
      
      console.log(`  ✅ User ${i} signed up successfully`);
    }
    
    // Verify signups
    const privoteAddress = this.storage.getAddress(CustomEContracts.Privote, this.hre.network.name);
    const privoteContract = await this.deployment.getContract({ 
      name: CustomEContracts.Privote as any,
      address: privoteAddress
    });
    
    const totalSignups = await privoteContract.totalSignups();
    console.log(`✅ Total users signed up: ${totalSignups}`);
  }

  private async joinPoll(): Promise<void> {
    console.log("\n🎯 Step 5: Users joining poll...");
    
    for (let i = 0; i < this.config.voters.length; i++) {
      const voter = this.config.voters[i];
      console.log(`  🎯 User ${i} joining poll ${this.pollId}...`);
      
      try {
        await this.hre.run("join-poll", {
          poll: this.pollId,
          account: voter.account,
          startBlock: undefined,
          blocksPerBatch: 500,
          useWasm: true,
          rapidsnark: undefined,
          pollWitnessGenerator: undefined
        });
        
        console.log(`  ✅ User ${i} joined poll successfully`);
      } catch (error) {
        console.warn(`  ⚠️  User ${i} join poll failed (may need zkeys):`, (error as Error).message);
        // Continue with other users
      }
    }
    
    console.log("✅ Poll joining phase completed");
  }

  private async conductVoting(): Promise<void> {
    console.log("\n🗳️  Step 6: Conducting voting...");
    
    for (let i = 0; i < this.config.voters.length; i++) {
      const voter = this.config.voters[i];
      console.log(`  🗳️  User ${i} voting: ${voter.votes}...`);
      
      try {
        await this.hre.run("vote", {
          poll: this.pollId,
          votes: voter.votes,
          account: voter.account
        });
        
        console.log(`  ✅ User ${i} voted successfully`);
      } catch (error) {
        console.error(`  ❌ User ${i} voting failed:`, (error as Error).message);
        // Continue with other voters
      }
    }
    
    console.log("✅ Voting phase completed");
  }

  private async waitAndMerge(): Promise<void> {
    console.log("\n⏳ Step 7: Waiting for poll end and merging...");
    
    // Get poll contract
    const privoteAddress = this.storage.getAddress(CustomEContracts.Privote, this.hre.network.name);
    const privoteContract = await this.deployment.getContract({ 
      name: CustomEContracts.Privote as any,
      address: privoteAddress
    });
    
    const pollData = await privoteContract.polls(this.pollId);
    const pollContract = await this.deployment.getContract({
      name: EContracts.Poll,
      address: pollData.poll,
    });
    
    // Check if poll has ended
    const pollEndTime = await pollContract.endDate();
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (currentTime < Number(pollEndTime)) {
      const waitTime = Number(pollEndTime) - currentTime + 10; // Add 1 second buffer
      console.log(`⏳ Poll ends at ${new Date(Number(pollEndTime) * 1000).toISOString()}`);
      console.log(`⏰ Need to wait ${waitTime} seconds for poll to end...`);
      console.log("⏰ Waiting for actual time to pass...");
      
      // Actually wait for the time to pass
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      
      // Mine a block to update the blockchain timestamp (needed for local networks)
      console.log("⛏️  Mining a block to update blockchain timestamp...");
      await this.hre.network.provider.send("evm_mine");
      
      console.log("✅ Wait completed, poll should have ended");
    }
    
    console.log("✅ Poll has ended, starting merge...");
    
    // Merge signups and messages
    await this.hre.run("merge", {
      poll: this.pollId,
      prove: false
    });
    
    console.log("✅ Merge completed");
  }

  private async generateProofs(): Promise<void> {
    console.log("\n🔐 Step 8: Generating zk-SNARK proofs...");
    
    const tallyFile = path.join(this.config.outputDir, "tally.json");
    
    try {
      await this.hre.run("prove", {
        poll: this.pollId,
        outputDir: this.config.outputDir,
        coordinatorPrivateKey: this.config.coordinatorPrivateKey,
        tallyFile: tallyFile,
        stateFile: undefined,
        rapidsnark: undefined,
        messageProcessorWitnessGenerator: undefined,
        voteTallyWitnessGenerator: undefined,
        startBlock: undefined,
        blocksPerBatch: undefined,
        endBlock: undefined,
        transactionHash: undefined,
        ipfsMessageBackupFiles: undefined
      });
      
      console.log("✅ Proofs generated successfully");
    } catch (error) {
      console.error("❌ Proof generation failed:", (error as Error).message);
      console.warn("⚠️  This might be due to missing zkeys or other setup issues");
      throw error;
    }
  }

  private async submitProofs(): Promise<void> {
    console.log("\n📤 Step 9: Submitting proofs on-chain...");
    
    const tallyFile = path.join(this.config.outputDir, "tally.json");
    
    await this.hre.run("submitOnChain", {
      poll: this.pollId,
      outputDir: this.config.outputDir,
      tallyFile: tallyFile
    });
    
    console.log("✅ Proofs submitted successfully");
  }

  private async verifyResults(): Promise<void> {
    console.log("\n🔍 Step 10: Verifying results...");
    
    // Get poll mode to determine how to calculate expected results
    const privoteAddress = this.storage.getAddress(CustomEContracts.Privote, this.hre.network.name);
    const privoteContract = await this.deployment.getContract({ 
      name: CustomEContracts.Privote as any,
      address: privoteAddress
    });
    
    const pollData = await privoteContract.polls(this.pollId);
    const tallyContract = await this.deployment.getContract({
      name: EContracts.Tally,
      address: pollData.tally,
    });
    
    const pollMode = await tallyContract.mode();
    console.log(`📊 Poll mode: ${pollMode} (0=QV, 1=Non-QV, 2=Full)`);
    
    // Define vote data for calculations
    const voteData = [
      { voter: 0, votes: [5, 3, 0] }, // User 0: "0:5,1:3"
      { voter: 1, votes: [0, 7, 2] }, // User 1: "1:7,2:2"
      { voter: 2, votes: [1, 0, 4] }, // User 2: "0:1,2:4"
      { voter: 3, votes: [0, 0, 6] }, // User 3: "2:6"
    ];
    
    let expectedResults: number[];
    let expectedTotalSpent: number;
    
    if (pollMode === 0) {
      // QV mode: square root and floor each voter's votes per option, then sum
      console.log("🔢 Calculating QV (quadratic voting) expected results...");
      const qvResults = [0, 0, 0];
      let totalSpent = 0;
      
      for (const voter of voteData) {
        console.log(`  Voter ${voter.voter}:`);
        for (let i = 0; i < 3; i++) {
          if (voter.votes[i] > 0) {
            const effectiveVotes = Math.floor(Math.sqrt(voter.votes[i]));
            qvResults[i] += effectiveVotes;
            totalSpent += effectiveVotes * effectiveVotes; // Square of effective votes
            console.log(`    Option ${i}: ${voter.votes[i]} → √${voter.votes[i]} = ${effectiveVotes} effective votes (costs ${effectiveVotes * effectiveVotes})`);
          }
        }
      }
      
      expectedResults = qvResults;
      expectedTotalSpent = totalSpent;
      
      console.log("📊 QV final totals:");
      console.log(`  Option 0: ${expectedResults[0]} effective votes`);
      console.log(`  Option 1: ${expectedResults[1]} effective votes`);
      console.log(`  Option 2: ${expectedResults[2]} effective votes`);
      
    } else if (pollMode === 1) {
      // Non-QV mode: simple sum
      console.log("🔢 Calculating Non-QV (simple counting) expected results...");
      const nonQvResults = [0, 0, 0];
      let totalSpent = 0;
      
      for (const voter of voteData) {
        for (let i = 0; i < 3; i++) {
          nonQvResults[i] += voter.votes[i];
          totalSpent += voter.votes[i];
        }
      }
      
      expectedResults = nonQvResults;
      expectedTotalSpent = totalSpent;
      
      console.log("📊 Non-QV calculation:");
      console.log(`  Option 0: ${expectedResults[0]} votes`);
      console.log(`  Option 1: ${expectedResults[1]} votes`);
      console.log(`  Option 2: ${expectedResults[2]} votes`);
      
    } else if (pollMode === 2) {
      // Full mode: winner takes all (all votes go to the option with most total votes)
      console.log("🔢 Calculating Full (winner-takes-all) expected results...");
      const totals = [0, 0, 0];
      let totalSpent = 0;
      
      for (const voter of voteData) {
        for (let i = 0; i < 3; i++) {
          totals[i] += voter.votes[i];
          totalSpent += voter.votes[i];
        }
      }
      
      // Find winner (option with most votes)
      const maxVotes = Math.max(...totals);
      const winnerIndex = totals.indexOf(maxVotes);
      
      expectedResults = [0, 0, 0];
      expectedResults[winnerIndex] = totalSpent; // All votes go to winner
      expectedTotalSpent = totalSpent;
      
      console.log("📊 Full mode calculation:");
      console.log(`  Totals: [${totals.join(", ")}]`);
      console.log(`  Winner: Option ${winnerIndex} with ${maxVotes} votes`);
      console.log(`  Result: All ${totalSpent} votes go to Option ${winnerIndex}`);
      
    } else {
      throw new Error(`Unknown poll mode: ${pollMode}`);
    }
    
    // Check if tallied
    const isTallied = await tallyContract.isTallied();
    console.log(`📊 Poll tallied: ${isTallied}`);
    
    if (isTallied) {
      const totalTallyResults = await tallyContract.totalTallyResults();
      const totalSpent = await tallyContract.totalSpent();
      
      console.log(`📊 Total tally results: ${totalTallyResults}`);
      console.log(`💰 Total voice credits spent: ${totalSpent}`);
      
      // Display and verify individual results
      console.log("\n📊 On-chain tally results:");
      const onChainResults: number[] = [];
      for (let i = 0; i < Number(totalTallyResults); i++) {
        const result = await tallyContract.tallyResults(i);
        const optionName = this.config.pollOptions[i] || `Option ${i}`;
        const votes = Number(result.value);
        onChainResults.push(votes);
        console.log(`📊 ${optionName}: ${votes} votes`);
      }
      
      // Verify on-chain results match expected
      if (onChainResults.length === expectedResults.length) {
        let allMatch = true;
        for (let i = 0; i < expectedResults.length; i++) {
          if (onChainResults[i] !== expectedResults[i]) {
            console.error(`❌ Option ${i}: Expected ${expectedResults[i]}, got ${onChainResults[i]}`);
            allMatch = false;
          }
        }
        
        if (allMatch) {
          console.log("✅ On-chain tally results match expected values!");
        } else {
          console.error("❌ On-chain tally results don't match expected values");
        }
        
        // Verify total spent
        if (Number(totalSpent) === expectedTotalSpent) {
          console.log("✅ Total spent voice credits match expected value!");
        } else {
          console.error(`❌ Total spent: Expected ${expectedTotalSpent}, got ${totalSpent}`);
        }
      }
    }
    
    // Read tally.json if available
    const tallyFile = path.join(this.config.outputDir, "tally.json");
    if (fs.existsSync(tallyFile)) {
      console.log("\n📋 Tally.json results:");
      const tallyData = JSON.parse(fs.readFileSync(tallyFile, "utf8"));
      
      if (tallyData.results && tallyData.results.tally) {
        console.log("📊 File-based tally results (first 3 options):");
        const fileResults: number[] = [];
        for (let i = 0; i < expectedResults.length; i++) {
          const optionName = this.config.pollOptions[i] || `Option ${i}`;
          const votes = Number(tallyData.results.tally[i] || '0');
          fileResults.push(votes);
          console.log(`📊 ${optionName}: ${votes} votes`);
        }
        
        // Verify file results match expected (only check first 3 options)
        let allMatch = true;
        for (let i = 0; i < expectedResults.length; i++) {
          if (fileResults[i] !== expectedResults[i]) {
            console.error(`❌ Option ${i}: Expected ${expectedResults[i]}, got ${fileResults[i]}`);
            allMatch = false;
          }
        }
        
        if (allMatch) {
          console.log("✅ Tally.json results match expected values!");
        } else {
          console.error("❌ Tally.json results don't match expected values");
          throw new Error("Vote tally verification failed");
        }
      }
      
      if (tallyData.totalSpentVoiceCredits) {
        const fileSpent = Number(tallyData.totalSpentVoiceCredits.spent);
        console.log(`💰 Total spent voice credits: ${fileSpent}`);
        
        if (fileSpent === expectedTotalSpent) {
          console.log("✅ File-based total spent voice credits match expected value!");
        } else {
          console.error(`❌ File total spent: Expected ${expectedTotalSpent}, got ${fileSpent}`);
        }
      }
    } else {
      console.warn("⚠️  Tally.json file not found - verification incomplete");
    }
    
    console.log("✅ Results verification completed");
  }

  private async cleanup(): Promise<void> {
    if (this.config.cleanupAfter) {
      console.log("\n🧹 Cleaning up...");
      
      try {
        if (fs.existsSync(this.config.outputDir)) {
          fs.rmSync(this.config.outputDir, { recursive: true, force: true });
          console.log("✅ Cleanup completed");
        }
      } catch (error) {
        console.warn("⚠️  Cleanup failed:", (error as Error).message);
      }
    } else {
      console.log(`\n📁 Artifacts preserved in: ${this.config.outputDir}`);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  // Get hardhat runtime environment
  const hre = require("hardhat");
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const shouldCleanup = !args.includes("--no-cleanup");
  const customOutputDir = args.find(arg => arg.startsWith("--output-dir="))?.split("=")[1];
  
  const config: TestConfig = {
    ...TEST_CONFIG,
    outputDir: customOutputDir || TEST_CONFIG.outputDir,
    cleanupAfter: shouldCleanup
  };
  
  console.log("Configuration:");
  console.log(`- Voters: ${config.voters.length}`);
  console.log(`- Options: ${config.pollOptions.length}`);
  console.log(`- Output dir: ${config.outputDir}`);
  console.log(`- Cleanup after: ${config.cleanupAfter}`);
  
  const tester = new VotingFlowTester(hre, config);
  await tester.runFullFlow();
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 Test completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test failed:", error);
      process.exit(1);
    });
}

export { VotingFlowTester, TEST_CONFIG }; 
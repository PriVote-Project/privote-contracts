/* eslint-disable no-console */
import { task, types } from "hardhat/config";
import { 
  EXAMPLE_POLICY_DATA,
} from "../../utils/policyDataGenerator";
import { logGreen, info } from "@maci-protocol/contracts";
import { policyTasks } from "../helpers/constants";

/**
 * Generate policy data for all policies at once by calling individual policy tasks
 */
task("generate-all-policy-data", "Generate signup data for all policy types")
  .addFlag("deploy", "Deploy supporting contracts for policies that support it")
  .addFlag("updateConfig", "Update the deploy-config.json file with generated data")
  .setAction(async ({ 
    deploy,
    updateConfig
  }, hre) => {
    try {
      console.log(info(`Generating signup data for all policy types...`));
      
      // Get all policies excluding FreeForAll and map to task names
     
      
      console.log(info(`Processing ${policyTasks.length} policy types: ${policyTasks.map(p => p.policy).join(", ")}`));
      
      let successCount = 0;
      let errorCount = 0;
      
      // Run each policy task
      for (const { policy, task } of policyTasks) {
        try {
          console.log(info(`\n📋 Running ${policy} policy task...`));
          
          // Run the individual policy task with the same flags
          await hre.run(task, {
            deploy,
            updateConfig
          });
          
          logGreen({ text: `✅ ${policy} completed successfully` });
          successCount++;
          
        } catch (error) {
          console.error(`❌ Error running ${policy} task: ${(error as Error).message}`);
          errorCount++;
        }
      }
      
      // Summary
      console.log("\n" + info("=".repeat(60)));
      console.log(info("📊 SUMMARY"));
      console.log(info("=".repeat(60)));
      console.log(info(`✅ Successfully processed: ${successCount} policies`));
      if (errorCount > 0) {
        console.log(info(`❌ Failed: ${errorCount} policies`));
      }
      console.log(info(`📋 Total processed: ${policyTasks.length} policies`));
      
      if (deploy) {
        console.log(info(`🚀 Contracts deployed where applicable`));
      }
      
      if (updateConfig) {
        console.log(info(`📝 Configuration updated for all processed policies`));
      }
      
      logGreen({ text: `🎉 All policy tasks completed! (${successCount}/${policyTasks.length} successful)` });
      
    } catch (error) {
      console.error(`❌ Error in generate-all-policy-data: ${(error as Error).message}`);
      throw error;
    }
  }); 
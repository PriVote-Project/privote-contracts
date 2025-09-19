/* eslint-disable no-console */
import { task, types } from "hardhat/config";

import { info, logMagenta, logRed, logYellow } from "@maci-protocol/contracts";
import { Deployment } from "@maci-protocol/contracts";
import { type IDeployParams } from "@maci-protocol/contracts";
import { runStepsWithTimeout } from "../../utils/deploymentUtils";

/**
 * Main deployment task which runs deploy steps in the same order that `Deployment#deployTask` is called.
 * Note: you probably need to use indices for deployment step files to support the correct order.
 * Make sure you have deploy-config.json (see deploy-config-example.json).
 */
task("deploy-full", "Deploy environment")
  .addFlag("incremental", "Incremental deployment")
  .addFlag("strict", "Fail on warnings")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addFlag("wrapper", "Deploy PrivoteWrapper instead of basic Privote")
  .addOptionalParam("skip", "Skip steps with less or equal index", 0, types.int)
  .addOptionalParam("timeout", "Timeout in seconds between deployment steps (default: 0)", 0, types.int)
  .setAction(async ({ incremental, strict, verify, wrapper, skip = 0, timeout = 0 }: IDeployParams & { wrapper?: boolean; timeout?: number }, hre) => {
    const deployment = Deployment.getInstance({ hre });

    deployment.setHre(hre);
    
    // Set deployment mode in global context
    (global as any).DEPLOY_WRAPPER = wrapper || false;

    const deployer = await deployment.getDeployer();
    const startBalance = await deployer.provider!.getBalance(deployer);
    let success = false;

    try {
      const steps = await deployment.start("full", { incremental, verify });

      if (timeout > 0) {
        logYellow({ text: `🕒 Running deployment with ${timeout} second timeout between steps` });
        await runStepsWithTimeout(deployment, steps, skip, timeout);
      } else {
        await deployment.runSteps(steps, skip);
      }

      await deployment.checkResults(strict);

      success = true;
    } catch (err) {
      logRed({
        text: `\n=========================================================\nERROR: ${(err as Error).message}\n`,
      });
    }

    await deployment.finish(startBalance, success);

    if (verify) {
      logMagenta({ text: info("Verify all contracts") });
      await hre.run("verify-full");
    }
  });

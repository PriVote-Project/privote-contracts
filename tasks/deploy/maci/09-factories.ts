import { info, logGreen } from "@maci-protocol/contracts";
import { ContractStorage } from "@maci-protocol/contracts";
import { Deployment, IDeployParams } from "@maci-protocol/contracts";
import { FACTORIES_CONFIG } from "../../helpers/constants";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask("full:deploy-factories", "Deploy all policy factories for PrivoteWrapper").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    // Check if we should deploy factories (only needed for PrivoteWrapper)
    const deployWrapper = (global as any).DEPLOY_WRAPPER || false;
    
    if (!deployWrapper) {
      logGreen({ text: info(`Skipping factories deployment - Basic Privote doesn't need policy factories`) });
      logGreen({ text: info(`To deploy factories for PrivoteWrapper, use --wrapper flag`) });
      return;
    }

    logGreen({ text: info("Deploying policy factories for PrivoteWrapper...") });

    // Deploy factory contracts that don't already exist using the constants config
    const factoriesConfig = FACTORIES_CONFIG;

    let deployedCount = 0;
    let skippedCount = 0;

    for (const config of factoriesConfig) {
      try {
        // Check if factories already exist
        const [policyFactoryAddress, checkerFactoryAddress] = storage.getAddresses([config.policy, config.checker], hre.network.name);
        
        // if (incremental && policyFactoryAddress && checkerFactoryAddress) {
        //   console.log(`⏭️  Skipping ${config.name} factories - already deployed`);
        //   skippedCount++;
        //   continue;
        // }

        console.log(`🚀 Deploying ${config.name} factories...`);

        // Deploy checker factory if not exists
        if (!checkerFactoryAddress) {
          const checkerFactory = await deployment.deployContract({
            name: config.checker as any,
            signer: deployer,
          });
          //timeout 10 seconds
          await new Promise(resolve => setTimeout(resolve, 10000));

          await storage.register({
            id: config.checker,
            name: config.checker,
            contract: checkerFactory,
            args: [],
            network: hre.network.name,
          });
        }

        // Deploy policy factory if not exists
        if (!policyFactoryAddress) {
          const policyFactory = await deployment.deployContract({
            name: config.policy as any,
            signer: deployer,
          });
          //timeout 10 seconds
          await new Promise(resolve => setTimeout(resolve, 10000));
          await storage.register({
            id: config.policy,
            name: config.policy,
            contract: policyFactory,
            args: [],
            network: hre.network.name,
          });
        }

        deployedCount++;
        console.log(`✅ ${config.name} factories deployed successfully`);
        
      } catch (error) {
        console.warn(`⚠️  ${config.name} factory deployment failed:`, (error as Error).message);
        console.warn(`   This may be expected for some networks where these policies are not supported`);
      }
    }

    logGreen({ text: info(`Factory deployment completed:`) });
    logGreen({ text: info(`  ✅ Deployed: ${deployedCount} factory pairs`) });
    logGreen({ text: info(`  ⏭️  Skipped: ${skippedCount} factory pairs (already deployed)`) });
  }),
); 
import { logYellow } from "@maci-protocol/contracts";

/**
 * Custom function to run deployment steps with optional timeout between steps
 * Useful for testnet deployments where rate limiting may occur
 */
export async function runStepsWithTimeout(deployment: any, steps: any[], skip: number, timeoutSeconds: number) {
  // Filter steps to run based on skip parameter
  const stepsToRun = steps.filter((step, index) => {

    // If step has an index property, use it; otherwise use array index
    const stepIndex = step.index !== undefined ? step.index : index;
    return stepIndex >= skip;
  });
  
  logYellow({ text: `🚀 Running ${stepsToRun.length} deployment steps with ${timeoutSeconds}s timeout between steps` });
  
  // Run steps one by one with timeout between them
  for (let i = 0; i < stepsToRun.length; i++) {
    const step = stepsToRun[i];
    
    logYellow({ text: `📦 Running deployment step: ${step.name || `Step ${i + 1}`}` });
    
    // Run a single step through the deployment system
    await deployment.runSteps([step], 0);
    
    // Add timeout between steps if specified and not the last step
    if (timeoutSeconds > 0 && i < stepsToRun.length - 1) {
      logYellow({ text: `⏳ Waiting ${timeoutSeconds} seconds before next deployment step...` });
      await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
    }
  }
}

/**
 * Sleep utility function
 */
export function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
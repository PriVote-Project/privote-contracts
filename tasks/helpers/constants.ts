
import { ECheckerFactories, EPolicyFactories } from "@maci-protocol/contracts";

/**
 * Custom deploy steps extending MACI deploy steps
 */
export enum CustomEDeploySteps {
  // Custom Privote step
  Privote = "full:deploy-privote",
  PrivoteWrapper = "full:deploy-privote-wrapper"
}

/**
 * Custom contracts enum extending MACI contracts
 */
export enum CustomEContracts {
  // Custom Privote contract
  Privote = "Privote",
  PrivoteWrapper = "PrivoteWrapper"
}

/**
 * Extended full policy names including the original MACI ones
 */
export const CUSTOM_FULL_POLICY_NAMES = {
  // Add any custom policy mappings if needed in the future
};

/**
 * Map policy names to their corresponding function names in PrivoteWrapper
 */
export const POLICY_FUNCTION_MAP = {
  "AnonAadhaarPolicy": "createPollWithAnonAadhaar",
  "ERC20Policy": "createPollWithERC20", 
  "TokenPolicy": "createPollWithToken",
  "EASPolicy": "createPollWithEAS",
  "GitcoinPassportPolicy": "createPollWithGitcoin",
  "MerkleProofPolicy": "createPollWithMerkle",
  "SemaphorePolicy": "createPollWithSemaphore",
  "ZupassPolicy": "createPollWithZupass",
  "FreeForAllPolicy": "createPollWithFreeForAll"
} as const;

/**
 * Type for supported policy types
 */
  export type PolicyType = keyof typeof POLICY_FUNCTION_MAP;

/**
 * Configuration for policy factories deployment
 */
export const FACTORIES_CONFIG = [
  { policy: EPolicyFactories.AnonAadhaar, checker: ECheckerFactories.AnonAadhaar, name: "AnonAadhaar" },
  { policy: EPolicyFactories.ERC20, checker: ECheckerFactories.ERC20, name: "ERC20" },
  { policy: EPolicyFactories.Token, checker: ECheckerFactories.Token, name: "Token" },
  { policy: EPolicyFactories.EAS, checker: ECheckerFactories.EAS, name: "EAS" },
  { policy: EPolicyFactories.GitcoinPassport, checker: ECheckerFactories.GitcoinPassport, name: "GitcoinPassport" },
  { policy: EPolicyFactories.MerkleProof, checker: ECheckerFactories.MerkleProof, name: "MerkleProof" },
  { policy: EPolicyFactories.Semaphore, checker: ECheckerFactories.Semaphore, name: "Semaphore" },
  { policy: EPolicyFactories.Zupass, checker: ECheckerFactories.Zupass, name: "Zupass" },
  { policy: EPolicyFactories.FreeForAll, checker: ECheckerFactories.FreeForAll, name: "FreeForAll" }
] as const;



export const policyTasks = [
  { policy: "MerkleProof", task: "generate-merkle-proof-data" },
  { policy: "EAS", task: "generate-eas-data" },
  { policy: "ERC20", task: "generate-erc20-data" },
  { policy: "ERC20Votes", task: "generate-erc20-votes-data" },
  { policy: "Token", task: "generate-token-data" },
  { policy: "Semaphore", task: "generate-semaphore-data" },
  { policy: "GitcoinPassport", task: "generate-gitcoin-passport-data" },
  { policy: "Zupass", task: "generate-zupass-data" },
  { policy: "Hats", task: "generate-hats-data" },
  { policy: "AnonAadhaar", task: "generate-anon-aadhaar-data" },
];
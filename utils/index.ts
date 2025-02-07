import { AuthType, ContractPollType, PollType } from "./types";

export const getNetworkName = (network: string, authType: AuthType, pollType: PollType) => {
  return `${network}_${authType}_${pollType ?? PollType.SINGLE}`;
};

export const getAuthType = (gateKeeperContractName?: string) => {
  switch (gateKeeperContractName) {
    case "FreeForAllGatekeeper":
      return AuthType.FREE;
    case "AnonAadhaarGatekeeper":
      return AuthType.ANON;
    default:
      return AuthType.FREE;
  }
};

export const getPollType = (contractPollType: ContractPollType) => {
  switch (contractPollType) {
    case ContractPollType.NOT_SELECTED:
      return PollType.SINGLE;
    case ContractPollType.SINGLE_VOTE:
      return PollType.SINGLE;
    case ContractPollType.MULTIPLE_VOTE:
      return PollType.MULTI;
    case ContractPollType.WEIGHTED_MULTIPLE_VOTE:
      return PollType.MULTI;
    default:
      return PollType.SINGLE;
  }
};

export const getInitialVoiceCredits = (pollType: PollType) => {
  switch (pollType) {
    case PollType.SINGLE:
      return 1;
    case PollType.MULTI:
      return 100;
    default:
      return 1;
  }
};

export const validateAuthType = (authType: AuthType) => {
  if (authType !== "free" && authType !== "anon") {
    throw new Error(`Unrecognized auth type: ${authType}`);
  }
};

export const validatePollType = (pollType: PollType) => {
  if (pollType !== "single" && pollType !== "multi") {
    throw new Error(`Unrecognized poll type: ${pollType}`);
  }
};

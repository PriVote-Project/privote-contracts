import { AuthType, PollType } from "./types";

export const getNetworkName = (network: string, authType: AuthType, pollType: PollType) => {
  return `${network}_${authType}_${pollType}`;
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

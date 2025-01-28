import { AuthType } from "./types";

export const getNetworkName = (network: string, authType: AuthType) => {
  return `${network}_${authType}`;
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

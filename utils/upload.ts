import { TallyData } from "maci-contracts";
import lighthouse from "@lighthouse-web3/sdk";

const lighthouseApiKey = process.env.LH_API_KEY as string;

export const pinToIPFS = async (tallyData: TallyData) => {
  try {
    if (!lighthouseApiKey) throw new Error("Lighthouse API key is not set");

    const response = await lighthouse.uploadText(JSON.stringify(tallyData), lighthouseApiKey);
    if (response.data) {
      return response.data.Hash;
    }

    throw new Error("Failed to pin to IPFS");
  } catch (error) {
    throw error;
  }
};

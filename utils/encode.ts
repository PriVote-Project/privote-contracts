import { toUtf8Bytes, hexlify, toUtf8String } from "ethers";

interface OptionInfo {
  cid: `0x${string}`;
  description?: string;
  link?: string;
}

export function encodeOptionInfo(info: OptionInfo): string {
  // Create an object with version for future compatibility
  const data = {
    version: 2,
    cid: info.cid,
    description: info.description || "",
    link: info.link || "",
  };

  // Convert to JSON and then to bytes
  const jsonString = JSON.stringify(data);
  const bytes = toUtf8Bytes(jsonString);
  return hexlify(bytes);
}

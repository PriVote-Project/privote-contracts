import { ethers } from "ethers";

/**
 * Utility functions to generate policy-specific signup data with hardcoded values
 */

/**
 * Generate signup data for FreeForAllPolicy
 * @returns Empty bytes (0x)
 */
export function generateFreeForAllData(): string {
  return "0x";
}

/**
 * Generate signup data for MerkleProofPolicy
 * Uses predefined merkle proof and leaf values
 * @returns Encoded merkle proof data
 */
export function generateMerkleProofData(): string {
  const proof = [
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
  ];
  const leaf = "0x5678901234abcdef5678901234abcdef5678901234abcdef5678901234abcdef";
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["bytes32[]", "bytes32"],
    [proof, leaf]
  );
}

/**
 * Generate signup data for EASPolicy
 * Uses predefined attestation ID and signature
 * @returns Encoded attestation data
 */
export function generateEASData(): string {
  const attestationId = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const signature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12341b";
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["bytes32", "bytes"],
    [attestationId, signature]
  );
}

/**
 * Generate signup data for ERC20Policy
 * Uses predefined token amount and signature
 * @returns Encoded ERC20 data
 */
export function generateERC20Data(): string {
  const amount = BigInt("1000000000000000000000"); // 1000 tokens with 18 decimals
  const signature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12341b";
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256", "bytes"],
    [amount, signature]
  );
}

/**
 * Generate signup data for ERC20VotesPolicy
 * Uses predefined token amount and snapshot block
 * @returns Encoded ERC20Votes data
 */
export function generateERC20VotesData(): string {
  const amount = BigInt("500000000000000000000"); // 500 tokens with 18 decimals
  const snapshotBlock = BigInt("12345678"); // Example snapshot block
  const signature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12341b";
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256", "uint256", "bytes"],
    [amount, snapshotBlock, signature]
  );
}

/**
 * Generate signup data for SemaphorePolicy
 * Uses predefined Semaphore proof data
 * @returns Encoded Semaphore proof
 */
export function generateSemaphoreData(): string {
  const merkleTreeRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const nullifierHash = "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
  const signal = "0x5678901234abcdef5678901234abcdef5678901234abcdef5678901234abcdef";
  const externalNullifier = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
  const proof = [
    "0x1111111111111111111111111111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555555555555555555555555555",
    "0x6666666666666666666666666666666666666666666666666666666666666666",
    "0x7777777777777777777777777777777777777777777777777777777777777777",
    "0x8888888888888888888888888888888888888888888888888888888888888888"
  ];
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256", "uint256", "uint256", "uint256", "uint256[8]"],
    [
      merkleTreeRoot,
      nullifierHash,
      signal,
      externalNullifier,
      proof
    ]
  );
}

/**
 * Generate signup data for GitcoinPassportPolicy
 * Uses predefined passport verification data
 * @returns Encoded passport data
 */
export function generateGitcoinPassportData(): string {
  const passportScore = 750; // Example passport score out of 1000
  const passportProof = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const timestamp = Math.floor(Date.now() / 1000); // Current timestamp
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256", "bytes32", "uint256"],
    [passportScore, passportProof, timestamp]
  );
}

/**
 * Generate signup data for ZupassPolicy
 * Uses predefined Zupass verification proof
 * @returns Encoded Zupass proof data
 */
export function generateZupassData(): string {
  const eventId = "0x69c0caaa-c65d-5345-a20c-867774f18c67"; // Example event ID
  const nullifierHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const proof = [
    "0x1111111111111111111111111111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444444444444444444444444444"
  ];
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["string", "bytes32", "bytes32[4]"],
    [eventId, nullifierHash, proof]
  );
}

/**
 * Generate signup data for HatsPolicy
 * Uses predefined hat ownership proof
 * @returns Encoded Hats proof data
 */
export function generateHatsData(): string {
  const hatId = BigInt("0x0000000100010001000100010001000100010001000100010001000100010001"); // Example hat ID
  const proof = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12341b";
  const timestamp = Math.floor(Date.now() / 1000);
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256", "bytes", "uint256"],
    [hatId, proof, timestamp]
  );
}

/**
 * Generate signup data for TokenPolicy (ERC721/NFT)
 * Uses only token ID parameter
 * @returns Encoded token ID
 */
export function generateTokenData(): string {
  const tokenId = BigInt(2);
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(
    ["uint256"],
    [tokenId]
  );
}

/**
 * Generate signup data for AnonAadhaarPolicy
 * Uses predefined Anon Aadhaar proof data
 * @returns Encoded Anon Aadhaar proof
 */
export function generateAnonAadhaarData(): string {
  // This is a complex proof structure, using example data that works on localhost testing
  const nullifierSeed = "4534";
  const nullifier = "10106489451831694175686105594084244223757091351145393284926689497346436753241";
  // unix timestamp
  const timestamp = "1750613400";
  // signal = uint256(uint160(msg.sender)), uses 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 as example which is
  // one of default anvil accounts
  const signal = "642829559307850963015472508762062935916233390536";  
  // revealArray = uint256[4]
  const revealArray = ["0", "0", "0", "0"];
  const groth16Proof = [
    "15954551707873129555711629956607532118404333309916554756892215525130939695676",
    "8239468569006120879267005135042798894554237473569459127104948087517383230995",
    "7569910317891855226401245108505748269957301084621467224423528186782550911197",
    "17494842777099248116059167452104143896794204909498051154775340709752226090928",
    "14587277977527487502372543147472199411401450533020118643651855163143391594934",
    "15525696724996264190975696356375477209981731300350522209594933545234810157074",
    "12886552238349993293270677622021723794792670883308355077719101771071901279069",
    "11059113823946956849715986879812806569480151634293531664992835954915693161719"
  ];
  
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(   
    ["uint256", "uint256", "uint256", "uint256", "uint256[4]", "uint256[8]"],
    [nullifierSeed, nullifier, timestamp, signal, revealArray, groth16Proof]
  );
}

/**
 * Helper function to auto-generate signup data based on policy trait
 * @param policyTrait The policy trait (e.g., "FreeForAll", "MerkleProof")
 * @returns Generated signup data hex string
 */
export function generateSignupDataForPolicy(policyTrait: string): string {
  switch (policyTrait) {
    case "FreeForAll":
      return generateFreeForAllData();
    
    case "MerkleProof":
      return generateMerkleProofData();
    
    case "EAS":
      return generateEASData();
    
    case "ERC20":
      return generateERC20Data();
    
    case "ERC20Votes":
      return generateERC20VotesData();
    
    case "Semaphore":
      return generateSemaphoreData();
    
    case "GitcoinPassport":
      return generateGitcoinPassportData();
    
    case "Zupass":
      return generateZupassData();
    
    case "Hats":
      return generateHatsData();
    
    case "AnonAadhaar":
      return generateAnonAadhaarData();
    
    case "Token":
      return generateTokenData();
    
    default:
      console.warn(`Unknown policy trait: ${policyTrait}, returning empty data`);
      return "0x";
  }
}

/**
 * Example usage and configuration helpers
 */
export const EXAMPLE_POLICY_DATA = {
  FreeForAll: generateFreeForAllData(),
  MerkleProof: generateMerkleProofData(),
  EAS: generateEASData(),
  ERC20: generateERC20Data(),
  ERC20Votes: generateERC20VotesData(),
  Semaphore: generateSemaphoreData(),
  GitcoinPassport: generateGitcoinPassportData(),
  Zupass: generateZupassData(),
  Hats: generateHatsData(),
  AnonAadhaar: generateAnonAadhaarData(),
  Token: generateTokenData()
};

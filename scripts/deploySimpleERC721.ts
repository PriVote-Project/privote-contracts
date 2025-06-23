import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SimpleERC721 contract...");

  // Get the available signers
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user1 = signers[1] || null;
  const user2 = signers[2] || null;
  
  console.log("📊 Available signers:", signers.length);
  console.log("user1", user1?.address || "Not available");
  console.log("user2", user2?.address || "Not available");
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy the SimpleERC721 contract
  const SimpleERC721Factory = await ethers.getContractFactory("SimpleERC721");
  const simpleERC721 = await SimpleERC721Factory.deploy();
  
  await simpleERC721.waitForDeployment();
  const contractAddress = await simpleERC721.getAddress();
  
  console.log("✅ SimpleERC721 deployed to:", contractAddress);

  // Verify deployment by checking basic contract properties
  const name = await simpleERC721.name();
  const symbol = await simpleERC721.symbol();
  const deployerBalance = await simpleERC721.balanceOf(deployer.address);
  
  console.log("📋 Contract Details:");
  console.log("   Name:", name);
  console.log("   Symbol:", symbol);
  console.log("   Deployer initial balance:", deployerBalance.toString(), "tokens");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 
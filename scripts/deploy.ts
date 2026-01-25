import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(60));
  console.log("🚀 PROOF OF RESTRAINT - DEPLOYMENT");
  console.log("=".repeat(60));
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );
  console.log();

  // 1. Deploy SoulboundToken
  console.log("📜 Step 1/5: Deploying SoulboundToken...");
  const SoulboundToken = await ethers.getContractFactory("SoulboundToken");
  const soulboundToken = await SoulboundToken.deploy();
  await soulboundToken.waitForDeployment();
  const soulboundAddress = await soulboundToken.getAddress();
  console.log("✅ SoulboundToken deployed to:", soulboundAddress);
  console.log();

  // 2. Deploy DisciplineRules
  console.log("📜 Step 2/5: Deploying DisciplineRules...");
  const DisciplineRules = await ethers.getContractFactory("DisciplineRules");
  const disciplineRules = await DisciplineRules.deploy(soulboundAddress);
  await disciplineRules.waitForDeployment();
  const disciplineAddress = await disciplineRules.getAddress();
  console.log("✅ DisciplineRules deployed to:", disciplineAddress);
  console.log();

  // 3. Deploy RewardVault
  console.log("📜 Step 3/5: Deploying RewardVault...");
  const RewardVault = await ethers.getContractFactory("RewardVault");
  const rewardVault = await RewardVault.deploy(soulboundAddress);
  await rewardVault.waitForDeployment();
  const vaultAddress = await rewardVault.getAddress();
  console.log("✅ RewardVault deployed to:", vaultAddress);
  console.log();

  // 4. Authorize both contracts
  console.log("🔐 Step 4/5: Authorizing contracts...");

  await soulboundToken.setAuthorizedContract(disciplineAddress, true);
  await soulboundToken.setAuthorizedContract(vaultAddress, true);

  console.log("✅ DisciplineRules authorized");
  console.log("✅ RewardVault authorized");
  console.log();

  // 5. Verify tier requirements
  console.log("📊 Step 5/5: Verifying tier requirements...");

  const bronzeTier = await disciplineRules.tierRequirements(0);
  const silverTier = await disciplineRules.tierRequirements(1);
  const goldTier = await disciplineRules.tierRequirements(2);
  const platinumTier = await disciplineRules.tierRequirements(3);
  
  console.log("Tier Requirements:");
  console.log("  Bronze:   ", bronzeTier.rewardAmount.toString(), "PoR");
  console.log("  Silver:   ", silverTier.rewardAmount.toString(), "PoR");
  console.log("  Gold:     ", goldTier.rewardAmount.toString(), "PoR");
  console.log("  Platinum: ", platinumTier.rewardAmount.toString(), "PoR");
  console.log();

  // Save addresses
  console.log("💾 Saving deployment addresses...");

  const network = await ethers.provider.getNetwork();

  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SoulboundToken: soulboundAddress,
      DisciplineRules: disciplineAddress,
      RewardVault: vaultAddress
    }
  };
  
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("✅ Addresses saved to deployed-addresses.json");
  console.log();

  // Mint test token locally
  if (network.chainId === 31337n) {
    console.log("🎁 Minting test token to deployer...");
    await soulboundToken.mint(deployer.address);
    console.log("✅ Test token minted");
  }

  console.log("=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("❌ Deployment failed:");
  console.error(error);
  process.exit(1);
});
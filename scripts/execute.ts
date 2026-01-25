import { ethers } from "hardhat";
import { 
  SoulboundToken, 
  DisciplineRules 
} from "../typechain-types"; // Ensure you've run 'npx hardhat compile'

async function main(): Promise<void> {
  // Replace these with actual deployed addresses
  const sbtAddress: string = "YOUR_SBT_ADDRESS";
  const rulesAddress: string = "YOUR_RULES_ADDRESS";

  const [signer] = await ethers.getSigners();
  
  // Attach to contracts with specific types
  const soulboundToken = await ethers.getContractAt("SoulboundToken", sbtAddress) as unknown as SoulboundToken;
  const disciplineRules = await ethers.getContractAt("DisciplineRules", rulesAddress) as unknown as DisciplineRules;

  // Mint token to user
  console.log("Minting token...");
  const mintTx = await soulboundToken.mint(signer.address);
  await mintTx.wait();
  console.log("Token minted!");

  // Set budget
  console.log("Setting budget...");
  const budgetTx = await disciplineRules.connect(signer).setBudget(1000); // $1000
  await budgetTx.wait();
  console.log("Budget set!");

  // Record spending
  console.log("Recording spending...");
  const spendTx = await disciplineRules.connect(signer).recordSpending(900, 50); // $900 spent, $50 impulse
  await spendTx.wait();
  console.log("Spending recorded!");

  // Calculate rewards
  console.log("Calculating rewards...");
  const rewardTx = await disciplineRules.connect(signer).calculateRewards();
  await rewardTx.wait();
  console.log("Rewards calculated!");

  // Check token data
  const tokenData = await soulboundToken.getTokenData(signer.address);
  
  console.log("\n=== Token Data ===");
  console.log("PoR Balance:", tokenData.porBalance.toString());
  console.log("Current Tier:", tokenData.currentTier.toString());
  console.log("Total Earned:", tokenData.totalEarned.toString());
  console.log("==================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
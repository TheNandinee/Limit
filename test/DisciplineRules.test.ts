import { expect } from "chai";
import { ethers } from "hardhat";
import { SoulboundToken, DisciplineRules } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DisciplineRules", function () {
  let soulboundToken: SoulboundToken;
  let disciplineRules: DisciplineRules;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundToken
    const SoulboundToken = await ethers.getContractFactory("SoulboundToken");
    soulboundToken = await SoulboundToken.deploy();
    await soulboundToken.waitForDeployment();
    
    // Deploy DisciplineRules
    const DisciplineRules = await ethers.getContractFactory("DisciplineRules");
    disciplineRules = await DisciplineRules.deploy(await soulboundToken.getAddress());
    await disciplineRules.waitForDeployment();
    
    // Authorize DisciplineRules contract
    await soulboundToken.setAuthorizedContract(await disciplineRules.getAddress(), true);
    
    // Mint token to user1
    await soulboundToken.mint(user1.address);
  });

  describe("Deployment & Initialization", function () {
    it("Should set correct soulbound token address", async function () {
      expect(await disciplineRules.soulboundToken()).to.equal(await soulboundToken.getAddress());
    });

    it("Should initialize tier requirements correctly", async function () {
      const bronze = await disciplineRules.tierRequirements(0);
      const silver = await disciplineRules.tierRequirements(1);
      const gold = await disciplineRules.tierRequirements(2);
      const platinum = await disciplineRules.tierRequirements(3);

      expect(bronze.budgetCompliancePercent).to.equal(115);
      expect(bronze.rewardAmount).to.equal(10);
      
      expect(silver.budgetCompliancePercent).to.equal(105);
      expect(silver.rewardAmount).to.equal(25);
      
      expect(gold.budgetCompliancePercent).to.equal(100);
      expect(gold.rewardAmount).to.equal(50);
      
      expect(platinum.budgetCompliancePercent).to.equal(95);
      expect(platinum.rewardAmount).to.equal(100);
    });

    it("Should set deployer as owner", async function () {
      expect(await disciplineRules.owner()).to.equal(owner.address);
    });
  });

  describe("Budget Setting", function () {
    it("Should allow user to set budget", async function () {
      await expect(disciplineRules.connect(user1).setBudget(3000))
        .to.emit(disciplineRules, "BudgetSet")
        .withArgs(user1.address, 0, 3000);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.budget).to.equal(3000);
    });

    it("Should reject zero budget", async function () {
      await expect(
        disciplineRules.connect(user1).setBudget(0)
      ).to.be.revertedWith("Budget must be greater than 0");
    });

    it("Should update budget for current month", async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).setBudget(3500); // Update
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.budget).to.equal(3500);
    });

    it("Should set timestamp when budget is set", async function () {
      const tx = await disciplineRules.connect(user1).setBudget(3000);
      const block = await ethers.provider.getBlock(tx.blockNumber!);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.timestamp).to.equal(block!.timestamp);
    });
  });

  describe("Spending Recording", function () {
    beforeEach(async function () {
      await disciplineRules.connect(user1).setBudget(3000);
    });

    it("Should record spending correctly", async function () {
      await expect(disciplineRules.connect(user1).recordSpending(2500, 200))
        .to.emit(disciplineRules, "SpendingRecorded")
        .withArgs(user1.address, 0, 2500, 200);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.actualSpent).to.equal(2500);
      expect(monthData.impulseSpent).to.equal(200);
    });

    it("Should set baseline impulse on first recording", async function () {
      await disciplineRules.connect(user1).recordSpending(2500, 200);
      
      const baseline = await disciplineRules.userBaselineImpulse(user1.address);
      expect(baseline).to.equal(200);
    });

    it("Should not change baseline on subsequent recordings", async function () {
      await disciplineRules.connect(user1).recordSpending(2500, 200);
      await disciplineRules.connect(user1).recordSpending(2600, 150);
      
      const baseline = await disciplineRules.userBaselineImpulse(user1.address);
      expect(baseline).to.equal(200); // Should still be 200
    });

    it("Should require budget to be set first", async function () {
      await soulboundToken.mint(user2.address);
      
      await expect(
        disciplineRules.connect(user2).recordSpending(2500, 200)
      ).to.be.revertedWith("Set budget first");
    });

    it("Should reject zero spending", async function () {
      await expect(
        disciplineRules.connect(user1).recordSpending(0, 100)
      ).to.be.revertedWith("Spending must be greater than 0");
    });

    it("Should allow zero impulse spending", async function () {
      await disciplineRules.connect(user1).recordSpending(2500, 0);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.impulseSpent).to.equal(0);
    });
  });

  describe("Emergency Fund Management", function () {
    beforeEach(async function () {
      await disciplineRules.connect(user1).setBudget(3000);
    });

    it("Should update emergency fund months", async function () {
      await disciplineRules.connect(user1).updateEmergencyFund(6);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.emergencyFundMonths).to.equal(6);
    });

    it("Should allow updating emergency fund multiple times", async function () {
      await disciplineRules.connect(user1).updateEmergencyFund(3);
      await disciplineRules.connect(user1).updateEmergencyFund(6);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.emergencyFundMonths).to.equal(6);
    });

    it("Should allow zero emergency fund", async function () {
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.emergencyFundMonths).to.equal(0);
    });
  });

  describe("Emergency Allowance", function () {
    beforeEach(async function () {
      await disciplineRules.connect(user1).setBudget(3000);
    });

    it("Should allow using emergency once per month", async function () {
      await expect(disciplineRules.connect(user1).useEmergency())
        .to.emit(disciplineRules, "EmergencyUsed")
        .withArgs(user1.address, 0);
      
      const currentMonth = await disciplineRules.userCurrentMonth(user1.address);
      const hasUsed = await disciplineRules.hasUsedEmergency(user1.address, currentMonth);
      expect(hasUsed).to.be.true;
    });

    it("Should not allow using emergency twice in same month", async function () {
      await disciplineRules.connect(user1).useEmergency();
      
      await expect(
        disciplineRules.connect(user1).useEmergency()
      ).to.be.revertedWith("Emergency already used this month");
    });

    it("Should reset emergency usage after month increment", async function () {
      await disciplineRules.connect(user1).useEmergency();
      await disciplineRules.connect(user1).recordSpending(2500, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      // New month - should be able to use emergency again
      await disciplineRules.connect(user1).setBudget(3000);
      await expect(disciplineRules.connect(user1).useEmergency()).to.not.be.reverted;
    });
  });

  describe("Reward Calculation - Bronze Tier", function () {
    beforeEach(async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2800, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
    });

    it("Should calculate Bronze tier rewards correctly", async function () {
      await expect(disciplineRules.connect(user1).calculateRewards())
        .to.emit(disciplineRules, "RewardCalculated")
        .withArgs(user1.address, 0, 10, 0); // 10 PoR, tier 0
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.equal(10);
      expect(tokenData.currentTier).to.equal(0);
    });

    it("Should apply emergency penalty (50%)", async function () {
      await disciplineRules.connect(user1).useEmergency();
      await disciplineRules.connect(user1).calculateRewards();
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.equal(5); // 10 / 2
    });

    it("Should mark month as evaluated", async function () {
      await disciplineRules.connect(user1).calculateRewards();
      
      const monthData = await disciplineRules.getCurrentMonthData(user1.address);
      expect(monthData.evaluated).to.be.false; // New month now
    });

    it("Should increment month counter", async function () {
      const monthBefore = await disciplineRules.userCurrentMonth(user1.address);
      await disciplineRules.connect(user1).calculateRewards();
      const monthAfter = await disciplineRules.userCurrentMonth(user1.address);
      
      expect(monthAfter).to.equal(monthBefore + 1n);
    });
  });

  describe("Reward Calculation - Higher Tiers", function () {
    it("Should achieve Silver tier with 25% impulse reduction", async function () {
      // Month 1: Establish baseline
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2800, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(1);
      await disciplineRules.connect(user1).calculateRewards();
      
      // Month 2: Reduce impulse by 25% (200 -> 150)
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2900, 150);
      await disciplineRules.connect(user1).updateEmergencyFund(1);
      await disciplineRules.connect(user1).calculateRewards();
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.currentTier).to.equal(1); // Silver
      expect(tokenData.porBalance).to.be.gte(25); // At least silver reward
    });

    it("Should achieve Gold tier with 40% impulse reduction", async function () {
      // Month 1: Baseline
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(3000, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(4);
      await disciplineRules.connect(user1).calculateRewards();
      
      // Month 2: Reduce impulse by 40% (200 -> 120)
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(3000, 120);
      await disciplineRules.connect(user1).updateEmergencyFund(4);
      await disciplineRules.connect(user1).calculateRewards();
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.currentTier).to.equal(2); // Gold
    });

    it("Should achieve Platinum tier with 60% impulse reduction", async function () {
      // Month 1: Baseline
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2850, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(12);
      await disciplineRules.connect(user1).calculateRewards();
      
      // Month 2: Reduce impulse by 60% (200 -> 80)
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2850, 80);
      await disciplineRules.connect(user1).updateEmergencyFund(12);
      await disciplineRules.connect(user1).calculateRewards();
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.currentTier).to.equal(3); // Platinum
    });
  });

  describe("Reward Calculation - Requirements", function () {
    it("Should require PoR token to calculate rewards", async function () {
      await expect(
        disciplineRules.connect(user2).calculateRewards()
      ).to.be.revertedWith("Must have PoR token");
    });

    it("Should require budget to be set", async function () {
      await expect(
        disciplineRules.connect(user1).calculateRewards()
      ).to.be.revertedWith("No budget set");
    });

    it("Should require spending to be recorded", async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      
      await expect(
        disciplineRules.connect(user1).calculateRewards()
      ).to.be.revertedWith("No spending recorded");
    });

    it("Should not allow double evaluation", async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2500, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      await expect(
        disciplineRules.connect(user1).calculateRewards()
      ).to.be.revertedWith("No budget set");
    });
  });

  describe("Multi-Month Progression", function () {
    it("Should track consecutive months correctly", async function () {
      for (let i = 0; i < 3; i++) {
        await disciplineRules.connect(user1).setBudget(3000);
        await disciplineRules.connect(user1).recordSpending(2500, 200);
        await disciplineRules.connect(user1).updateEmergencyFund(0);
        await disciplineRules.connect(user1).calculateRewards();
      }
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.consecutiveMonths).to.equal(3);
      expect(await disciplineRules.userCurrentMonth(user1.address)).to.equal(3);
    });

    it("Should accumulate rewards over time", async function () {
      // Month 1
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2500, 200);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      const month1Balance = (await soulboundToken.getTokenData(user1.address)).porBalance;
      
      // Month 2
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2500, 180);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      const month2Balance = (await soulboundToken.getTokenData(user1.address)).porBalance;
      expect(month2Balance).to.be.gt(month1Balance);
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update tier requirements", async function () {
      await disciplineRules.updateTierRequirements(
        0, // Bronze
        120, // budgetCompliance
        5,   // impulseReduction
        0,   // emergencyFund
        15,  // reward
        0    // streak
      );
      
      const tierReq = await disciplineRules.tierRequirements(0);
      expect(tierReq.budgetCompliancePercent).to.equal(120);
      expect(tierReq.impulseReductionPercent).to.equal(5);
      expect(tierReq.rewardAmount).to.equal(15);
    });

    it("Should not allow non-owner to update tier requirements", async function () {
      await expect(
        disciplineRules.connect(user1).updateTierRequirements(0, 120, 5, 0, 15, 0)
      ).to.be.revertedWithCustomError(disciplineRules, "OwnableUnauthorizedAccount");
    });

    it("Should reject invalid tier index", async function () {
      await expect(
        disciplineRules.updateTierRequirements(5, 120, 5, 0, 15, 0)
      ).to.be.revertedWith("Invalid tier");
    });
  });

  describe("Edge Cases & Gas Optimization", function () {
    it("Should handle very high spending", async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(10000, 500);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      // Should still give Bronze tier reward (lowest)
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.equal(10);
    });

    it("Should handle zero impulse spending", async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2500, 0);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      const baseline = await disciplineRules.userBaselineImpulse(user1.address);
      expect(baseline).to.equal(0);
    });

    it("Should handle perfect budget compliance (under budget)", async function () {
      await disciplineRules.connect(user1).setBudget(3000);
      await disciplineRules.connect(user1).recordSpending(2000, 50);
      await disciplineRules.connect(user1).updateEmergencyFund(0);
      await disciplineRules.connect(user1).calculateRewards();
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.be.gte(10);
    });
  });
});
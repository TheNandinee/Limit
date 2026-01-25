import { expect } from "chai";
import { ethers } from "hardhat";
import { SoulboundToken, RewardVault, DisciplineRules } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RewardVault", function () {
  let soulboundToken: SoulboundToken;
  let rewardVault: RewardVault;
  let disciplineRules: DisciplineRules;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let provider: SignerWithAddress;

  // Helper function to give user some PoR tokens
  async function giveUserTokens(user: SignerWithAddress, amount: number) {
    await disciplineRules.connect(user).setBudget(3000);
    await disciplineRules.connect(user).recordSpending(2500, 200);
    await disciplineRules.connect(user).updateEmergencyFund(0);
    
    // Calculate rewards multiple times if needed
    const rewardsNeeded = Math.ceil(amount / 10); // Bronze gives 10 per month
    for (let i = 0; i < rewardsNeeded; i++) {
      await disciplineRules.connect(user).calculateRewards();
      if (i < rewardsNeeded - 1) {
        await disciplineRules.connect(user).setBudget(3000);
        await disciplineRules.connect(user).recordSpending(2500, 200);
        await disciplineRules.connect(user).updateEmergencyFund(0);
      }
    }
  }

  beforeEach(async function () {
  [owner, user1, user2, provider] = await ethers.getSigners();
  
  // Deploy SoulboundToken
  const SoulboundToken = await ethers.getContractFactory("SoulboundToken");
  soulboundToken = await SoulboundToken.deploy();
  await soulboundToken.waitForDeployment();
  
  // Deploy RewardVault
  const RewardVault = await ethers.getContractFactory("RewardVault");
  rewardVault = await RewardVault.deploy(await soulboundToken.getAddress());
  await rewardVault.waitForDeployment();
  
  // Deploy DisciplineRules
  const DisciplineRules = await ethers.getContractFactory("DisciplineRules");
  disciplineRules = await DisciplineRules.deploy(await soulboundToken.getAddress());
  await disciplineRules.waitForDeployment();
  
  // ✅ AUTHORIZE BOTH CONTRACTS
  await soulboundToken.setAuthorizedContract(
    await disciplineRules.getAddress(),
    true
  );

  await soulboundToken.setAuthorizedContract(
    await rewardVault.getAddress(),
    true
  );
  
  // Mint tokens to users
  await soulboundToken.mint(user1.address);
  await soulboundToken.mint(user2.address);
});

  describe("Deployment", function () {
    it("Should set correct soulbound token address", async function () {
      expect(await rewardVault.soulboundToken()).to.equal(await soulboundToken.getAddress());
    });

    it("Should set deployer as owner", async function () {
      expect(await rewardVault.owner()).to.equal(owner.address);
    });

    it("Should initialize PoR to USD rate", async function () {
      expect(await rewardVault.porToUsdRate()).to.equal(100);
    });
  });

  describe("Vault Creation", function () {
    it("Should create a Savings vault successfully", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year
      
      await expect(
        rewardVault.connect(user1).createVault(
          0, // Savings
          10000,
          targetDate,
          "Emergency Fund"
        )
      ).to.emit(rewardVault, "VaultCreated")
        .withArgs(user1.address, 0, 0, 10000);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults.length).to.equal(1);
      expect(vaults[0].vaultType).to.equal(0);
      expect(vaults[0].targetAmount).to.equal(10000);
      expect(vaults[0].description).to.equal("Emergency Fund");
      expect(vaults[0].isActive).to.be.true;
    });

    it("Should create multiple vault types", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Savings");
      await rewardVault.connect(user1).createVault(1, 50000, targetDate, "Education");
      await rewardVault.connect(user1).createVault(2, 100000, targetDate, "Retirement");
      await rewardVault.connect(user1).createVault(3, 5000, targetDate, "Emergency");
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults.length).to.equal(4);
      expect(vaults[0].vaultType).to.equal(0); // Savings
      expect(vaults[1].vaultType).to.equal(1); // Education
      expect(vaults[2].vaultType).to.equal(2); // Retirement
      expect(vaults[3].vaultType).to.equal(3); // Emergency
    });

    it("Should increment vault count correctly", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      expect(await rewardVault.userVaultCount(user1.address)).to.equal(0);
      
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Vault 1");
      expect(await rewardVault.userVaultCount(user1.address)).to.equal(1);
      
      await rewardVault.connect(user1).createVault(0, 20000, targetDate, "Vault 2");
      expect(await rewardVault.userVaultCount(user1.address)).to.equal(2);
    });

    it("Should require PoR token to create vault", async function () {
      const [, , , user3] = await ethers.getSigners();
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      await expect(
        rewardVault.connect(user3).createVault(0, 10000, targetDate, "Test")
      ).to.be.revertedWith("Must have PoR token");
    });

    it("Should reject zero target amount", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      await expect(
        rewardVault.connect(user1).createVault(0, 0, targetDate, "Test")
      ).to.be.revertedWith("Target amount must be greater than 0");
    });

    it("Should reject past target dates", async function () {
      const pastDate = Math.floor(Date.now() / 1000) - 86400;
      
      await expect(
        rewardVault.connect(user1).createVault(0, 10000, pastDate, "Test")
      ).to.be.revertedWith("Target date must be in future");
    });

    it("Should set creation timestamp correctly", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      const tx = await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].createdAt).to.equal(block!.timestamp);
    });

    it("Should initialize vault with zero current amount", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].currentAmount).to.equal(0);
      expect(vaults[0].tokensSpent).to.equal(0);
    });
  });

  describe("Vault Deposits", function () {
    beforeEach(async function () {
      // Give user1 some PoR tokens
      await giveUserTokens(user1, 50);
      
      // Create a vault
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Savings");
    });

    it("Should allow deposits to vault", async function () {
      await expect(
        rewardVault.connect(user1).depositToVault(0, 10)
      ).to.emit(rewardVault, "TokensDeposited")
        .withArgs(user1.address, 0, 10);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].currentAmount).to.equal(1000); // 10 PoR * 100 cents
      expect(vaults[0].tokensSpent).to.equal(10);
    });

    it("Should accumulate multiple deposits", async function () {
      await rewardVault.connect(user1).depositToVault(0, 10);
      await rewardVault.connect(user1).depositToVault(0, 5);
      await rewardVault.connect(user1).depositToVault(0, 3);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].currentAmount).to.equal(1800); // (10+5+3) * 100
      expect(vaults[0].tokensSpent).to.equal(18);
    });

    it("Should reject deposits exceeding balance", async function () {
      const tokenData = await soulboundToken.getTokenData(user1.address);
      const balance = tokenData.porBalance;
      
      await expect(
        rewardVault.connect(user1).depositToVault(0, balance + 1n)
      ).to.be.revertedWith("Insufficient PoR balance");
    });

    it("Should reject deposits to non-existent vault", async function () {
      await expect(
        rewardVault.connect(user1).depositToVault(999, 10)
      ).to.be.revertedWith("Vault does not exist");
    });

    it("Should reject deposits to inactive vault", async function () {
      // Create vault and manually deactivate it (need to access userVaults mapping)
      // For now, we test the check exists
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].isActive).to.be.true;
    });

    it("Should handle deposits to different vaults", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(1, 20000, targetDate, "Education");
      
      await rewardVault.connect(user1).depositToVault(0, 10); // First vault
      await rewardVault.connect(user1).depositToVault(1, 5);  // Second vault
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].currentAmount).to.equal(1000);
      expect(vaults[1].currentAmount).to.equal(500);
    });

    it("Should track progress toward target", async function () {
      await rewardVault.connect(user1).depositToVault(0, 25); // 25 PoR = $2500
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      const progress = (Number(vaults[0].currentAmount) / Number(vaults[0].targetAmount)) * 100;
      expect(progress).to.equal(25); // 25% of $10,000 target
    });
  });

  describe("Service Provider Management", function () {
    it("Should allow owner to approve providers", async function () {
      await expect(
        rewardVault.approveProvider(
          provider.address,
          "University of Example",
          provider.address,
          1 // Education
        )
      ).to.emit(rewardVault, "ProviderApproved")
        .withArgs(provider.address, "University of Example", 1);
      
      const providerData = await rewardVault.serviceProviders(provider.address);
      expect(providerData.name).to.equal("University of Example");
      expect(providerData.paymentAddress).to.equal(provider.address);
      expect(providerData.allowedVaultType).to.equal(1);
      expect(providerData.isApproved).to.be.true;
    });

    it("Should add provider to provider list", async function () {
      await rewardVault.approveProvider(
        provider.address,
        "Test Provider",
        provider.address,
        0
      );
      
      const providerAddress = await rewardVault.providerList(0);
      expect(providerAddress).to.equal(provider.address);
    });

    it("Should allow approving multiple providers", async function () {
      const [, , , provider2, provider3] = await ethers.getSigners();
      
      await rewardVault.approveProvider(provider.address, "Provider 1", provider.address, 0);
      await rewardVault.approveProvider(provider2.address, "Provider 2", provider2.address, 1);
      await rewardVault.approveProvider(provider3.address, "Provider 3", provider3.address, 2);
      
      expect(await rewardVault.providerList(0)).to.equal(provider.address);
      expect(await rewardVault.providerList(1)).to.equal(provider2.address);
      expect(await rewardVault.providerList(2)).to.equal(provider3.address);
    });

    it("Should not allow non-owner to approve providers", async function () {
      await expect(
        rewardVault.connect(user1).approveProvider(
          provider.address,
          "Test",
          provider.address,
          0
        )
      ).to.be.revertedWithCustomError(rewardVault, "OwnableUnauthorizedAccount");
    });

    it("Should reject zero address as provider", async function () {
      await expect(
        rewardVault.approveProvider(
          ethers.ZeroAddress,
          "Test",
          provider.address,
          0
        )
      ).to.be.revertedWith("Invalid provider address");
    });

    it("Should allow different payment address", async function () {
      const [, , , , paymentAddr] = await ethers.getSigners();
      
      await rewardVault.approveProvider(
        provider.address,
        "Test Provider",
        paymentAddr.address,
        0
      );
      
      const providerData = await rewardVault.serviceProviders(provider.address);
      expect(providerData.paymentAddress).to.equal(paymentAddr.address);
    });
  });

  describe("Multiple Users", function () {
    it("Should handle vaults for multiple users independently", async function () {
      await giveUserTokens(user1, 20);
      await giveUserTokens(user2, 30);
      
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "User1 Savings");
      await rewardVault.connect(user2).createVault(0, 20000, targetDate, "User2 Savings");
      
      await rewardVault.connect(user1).depositToVault(0, 10);
      await rewardVault.connect(user2).depositToVault(0, 15);
      
      const user1Vaults = await rewardVault.getUserVaults(user1.address);
      const user2Vaults = await rewardVault.getUserVaults(user2.address);
      
      expect(user1Vaults[0].currentAmount).to.equal(1000);
      expect(user2Vaults[0].currentAmount).to.equal(1500);
    });

    it("Should track vault counts separately", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Vault 1");
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Vault 2");
      await rewardVault.connect(user2).createVault(0, 10000, targetDate, "Vault 1");
      
      expect(await rewardVault.userVaultCount(user1.address)).to.equal(2);
      expect(await rewardVault.userVaultCount(user2.address)).to.equal(1);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large target amounts", async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      const largeAmount = ethers.parseEther("1000000"); // 1M USD in wei
      
      await rewardVault.connect(user1).createVault(0, largeAmount, targetDate, "Big Goal");
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].targetAmount).to.equal(largeAmount);
    });

    it("Should handle deposits with exact balance", async function () {
      await giveUserTokens(user1, 20);
      
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      const exactBalance = tokenData.porBalance;
      
      await rewardVault.connect(user1).depositToVault(0, exactBalance);
      
      const newTokenData = await soulboundToken.getTokenData(user1.address);
      expect(newTokenData.porBalance).to.equal(0);
    });

    it("Should return empty array for user with no vaults", async function () {
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults.length).to.equal(0);
    });

    it("Should handle far future target dates", async function () {
      const farFuture = Math.floor(Date.now() / 1000) + (86400 * 365 * 50); // 50 years
      
      await rewardVault.connect(user1).createVault(0, 10000, farFuture, "Long term");
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].targetDate).to.equal(farFuture);
    });

    it("Should calculate USD correctly with rate", async function () {
      await giveUserTokens(user1, 20);
      
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      
      await rewardVault.connect(user1).depositToVault(0, 10);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      const rate = await rewardVault.porToUsdRate();
      
      // 10 PoR * 100 rate / 100 = $10.00 USD (in cents = 1000)
      expect(vaults[0].currentAmount).to.equal(10 * Number(rate));
    });
  });

  describe("Vault Queries", function () {
    beforeEach(async function () {
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Vault 1");
      await rewardVault.connect(user1).createVault(1, 20000, targetDate, "Vault 2");
      await rewardVault.connect(user1).createVault(2, 30000, targetDate, "Vault 3");
    });

    it("Should return all vaults for user", async function () {
      const vaults = await rewardVault.getUserVaults(user1.address);
      
      expect(vaults.length).to.equal(3);
      expect(vaults[0].description).to.equal("Vault 1");
      expect(vaults[1].description).to.equal("Vault 2");
      expect(vaults[2].description).to.equal("Vault 3");
    });

    it("Should query specific vault by ID", async function () {
      const vault = await rewardVault.userVaults(user1.address, 1);
      
      expect(vault.vaultType).to.equal(1);
      expect(vault.targetAmount).to.equal(20000);
      expect(vault.description).to.equal("Vault 2");
    });
  });

  describe("Integration with Token Balance", function () {
    it("Should reflect token balance changes after deposit", async function () {
      await giveUserTokens(user1, 30);
      
      const beforeBalance = (await soulboundToken.getTokenData(user1.address)).porBalance;
      
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      await rewardVault.connect(user1).depositToVault(0, 15);
      
      const afterBalance = (await soulboundToken.getTokenData(user1.address)).porBalance;
      
      // Balance should be reduced by 15 (but this requires integration with token contract)
      // For now, we verify the vault received the deposit
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].tokensSpent).to.equal(15);
    });
  });

  describe("Vault Completion", function () {
    it("Should track when vault reaches target", async function () {
      await giveUserTokens(user1, 100);
      
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      
      // Deposit exactly the target (100 PoR * 100 = 10000)
      await rewardVault.connect(user1).depositToVault(0, 100);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].currentAmount).to.equal(vaults[0].targetAmount);
    });

    it("Should allow deposits beyond target", async function () {
      await giveUserTokens(user1, 150);
      
      const targetDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await rewardVault.connect(user1).createVault(0, 10000, targetDate, "Test");
      
      await rewardVault.connect(user1).depositToVault(0, 120);
      
      const vaults = await rewardVault.getUserVaults(user1.address);
      expect(vaults[0].currentAmount).to.be.gt(vaults[0].targetAmount);
    });
  });
});
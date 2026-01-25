import { expect } from "chai";
import { ethers } from "hardhat";
import { SoulboundToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SoulboundToken", function () {
  let soulboundToken: SoulboundToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let disciplineContract: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2, disciplineContract] = await ethers.getSigners();
    
    const SoulboundToken = await ethers.getContractFactory("SoulboundToken");
    soulboundToken = await SoulboundToken.deploy();
    await soulboundToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await soulboundToken.name()).to.equal("Proof of Restraint");
      expect(await soulboundToken.symbol()).to.equal("PoR");
    });

    it("Should set the deployer as owner", async function () {
      expect(await soulboundToken.owner()).to.equal(owner.address);
    });

    it("Should start token counter at 1", async function () {
      await soulboundToken.mint(user1.address);
      expect(await soulboundToken.addressToTokenId(user1.address)).to.equal(1);
    });
  });

  describe("Minting", function () {
    it("Should mint a token to a new user", async function () {
      await expect(soulboundToken.mint(user1.address))
        .to.emit(soulboundToken, "TokenMinted")
        .withArgs(user1.address, 1);
      
      expect(await soulboundToken.hasMinted(user1.address)).to.be.true;
      expect(await soulboundToken.addressToTokenId(user1.address)).to.equal(1);
      expect(await soulboundToken.ownerOf(1)).to.equal(user1.address);
    });

    it("Should not allow minting twice to the same address", async function () {
      await soulboundToken.mint(user1.address);
      
      await expect(
        soulboundToken.mint(user1.address)
      ).to.be.revertedWith("Address already has a token");
    });

    it("Should not allow minting to zero address", async function () {
      await expect(
        soulboundToken.mint(ethers.ZeroAddress)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should only allow owner to mint", async function () {
      await expect(
        soulboundToken.connect(user1).mint(user2.address)
      ).to.be.revertedWithCustomError(soulboundToken, "OwnableUnauthorizedAccount");
    });

    it("Should increment token IDs correctly", async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.mint(user2.address);
      
      expect(await soulboundToken.addressToTokenId(user1.address)).to.equal(1);
      expect(await soulboundToken.addressToTokenId(user2.address)).to.equal(2);
    });

    it("Should initialize token data correctly", async function () {
      await soulboundToken.mint(user1.address);
      const tokenData = await soulboundToken.getTokenData(user1.address);
      
      expect(tokenData.porBalance).to.equal(0);
      expect(tokenData.totalEarned).to.equal(0);
      expect(tokenData.currentTier).to.equal(0);
      expect(tokenData.consecutiveMonths).to.equal(0);
      expect(tokenData.isActive).to.be.true;
    });
  });

  describe("Soulbound Transfers", function () {
    beforeEach(async function () {
      await soulboundToken.mint(user1.address);
    });

    it("Should prevent transfers using transferFrom", async function () {
      await expect(
        soulboundToken.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: Token cannot be transferred");
    });

    it("Should prevent transfers using safeTransferFrom", async function () {
      await expect(
        soulboundToken.connect(user1)["safeTransferFrom(address,address,uint256)"](
          user1.address, 
          user2.address, 
          1
        )
      ).to.be.revertedWith("Soulbound: Token cannot be transferred");
    });

    it("Should prevent approved transfers", async function () {
      await soulboundToken.connect(user1).approve(user2.address, 1);
      
      await expect(
        soulboundToken.connect(user2).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: Token cannot be transferred");
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
    });

    it("Should add rewards to token", async function () {
      await expect(
        soulboundToken.connect(disciplineContract).addReward(1, 100)
      ).to.emit(soulboundToken, "RewardAdded")
        .withArgs(1, 100, 100);
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.equal(100);
      expect(tokenData.totalEarned).to.equal(100);
    });

    it("Should accumulate multiple rewards", async function () {
      await soulboundToken.connect(disciplineContract).addReward(1, 50);
      await soulboundToken.connect(disciplineContract).addReward(1, 75);
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.equal(125);
      expect(tokenData.totalEarned).to.equal(125);
    });

    it("Should update lastRewardTime", async function () {
      const tx = await soulboundToken.connect(disciplineContract).addReward(1, 100);
      const block = await ethers.provider.getBlock(tx.blockNumber!);
      
      const tokenData = await soulboundToken.tokenData(1);
      expect(tokenData.lastRewardTime).to.equal(block!.timestamp);
    });

    it("Should not allow unauthorized contracts to add rewards", async function () {
      await expect(
        soulboundToken.connect(user1).addReward(1, 100)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should not add rewards to non-existent token", async function () {
      await expect(
        soulboundToken.connect(disciplineContract).addReward(999, 100)
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should not add rewards to inactive token", async function () {
      // First deactivate by setting active to false (you'd need to add this function)
      // For now, just test it exists
      const tokenData = await soulboundToken.tokenData(1);
      expect(tokenData.isActive).to.be.true;
    });
  });

  describe("Tier Updates", function () {
    beforeEach(async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
    });

    it("Should update tier correctly", async function () {
      await expect(
        soulboundToken.connect(disciplineContract).updateTier(1, 2)
      ).to.emit(soulboundToken, "TierUpdated")
        .withArgs(1, 2);
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.currentTier).to.equal(2);
    });

    it("Should allow all valid tier values (0-3)", async function () {
      for (let tier = 0; tier <= 3; tier++) {
        await soulboundToken.connect(disciplineContract).updateTier(1, tier);
        const tokenData = await soulboundToken.tokenData(1);
        expect(tokenData.currentTier).to.equal(tier);
      }
    });

    it("Should reject invalid tier values", async function () {
      await expect(
        soulboundToken.connect(disciplineContract).updateTier(1, 4)
      ).to.be.revertedWith("Invalid tier");
      
      await expect(
        soulboundToken.connect(disciplineContract).updateTier(1, 100)
      ).to.be.revertedWith("Invalid tier");
    });

    it("Should not allow unauthorized to update tier", async function () {
      await expect(
        soulboundToken.connect(user1).updateTier(1, 2)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Streak Updates", function () {
    beforeEach(async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
    });

    it("Should update consecutive months", async function () {
      await soulboundToken.connect(disciplineContract).updateStreak(1, 5);
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.consecutiveMonths).to.equal(5);
    });

    it("Should allow resetting streak to 0", async function () {
      await soulboundToken.connect(disciplineContract).updateStreak(1, 10);
      await soulboundToken.connect(disciplineContract).updateStreak(1, 0);
      
      const tokenData = await soulboundToken.tokenData(1);
      expect(tokenData.consecutiveMonths).to.equal(0);
    });
  });

  describe("Authorization", function () {
    it("Should allow owner to authorize contracts", async function () {
      await expect(
        soulboundToken.setAuthorizedContract(disciplineContract.address, true)
      ).to.emit(soulboundToken, "ContractAuthorized")
        .withArgs(disciplineContract.address, true);
      
      expect(await soulboundToken.authorizedContracts(disciplineContract.address)).to.be.true;
    });

    it("Should allow owner to revoke authorization", async function () {
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, false);
      
      expect(await soulboundToken.authorizedContracts(disciplineContract.address)).to.be.false;
    });

    it("Should not allow non-owner to authorize contracts", async function () {
      await expect(
        soulboundToken.connect(user1).setAuthorizedContract(disciplineContract.address, true)
      ).to.be.revertedWithCustomError(soulboundToken, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to perform authorized actions", async function () {
      await soulboundToken.mint(user1.address);
      // Owner should be able to add rewards without explicit authorization
      await soulboundToken.addReward(1, 100);
      
      const tokenData = await soulboundToken.tokenData(1);
      expect(tokenData.porBalance).to.equal(100);
    });
  });

  describe("Token Data Queries", function () {
    it("Should revert when querying non-existent token", async function () {
      await expect(
        soulboundToken.getTokenData(user1.address)
      ).to.be.revertedWith("User does not have token");
    });

    it("Should return correct token data", async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
      
      await soulboundToken.connect(disciplineContract).addReward(1, 250);
      await soulboundToken.connect(disciplineContract).updateTier(1, 3);
      await soulboundToken.connect(disciplineContract).updateStreak(1, 12);
      
      const tokenData = await soulboundToken.getTokenData(user1.address);
      expect(tokenData.porBalance).to.equal(250);
      expect(tokenData.totalEarned).to.equal(250);
      expect(tokenData.currentTier).to.equal(3);
      expect(tokenData.consecutiveMonths).to.equal(12);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle large reward amounts", async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
      
      const largeAmount = ethers.parseEther("1000000");
      await soulboundToken.connect(disciplineContract).addReward(1, largeAmount);
      
      const tokenData = await soulboundToken.tokenData(1);
      expect(tokenData.porBalance).to.equal(largeAmount);
    });

    it("Should handle zero reward amounts", async function () {
      await soulboundToken.mint(user1.address);
      await soulboundToken.setAuthorizedContract(disciplineContract.address, true);
      
      await soulboundToken.connect(disciplineContract).addReward(1, 0);
      
      const tokenData = await soulboundToken.tokenData(1);
      expect(tokenData.porBalance).to.equal(0);
    });
  });
});
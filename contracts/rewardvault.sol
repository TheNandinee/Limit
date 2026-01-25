// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISoulboundToken {
    function addressToTokenId(address user) external view returns (uint256);
    function hasMinted(address user) external view returns (bool);
    struct TokenData {
        uint256 porBalance;
        uint256 totalEarned;
        uint256 currentTier;
        uint256 consecutiveMonths;
        uint256 lastRewardTime;
        bool isActive;
    }
    
    function tokenData(uint256 tokenId) external view returns (TokenData memory);
        function spendReward(uint256 tokenId, uint256 amount) external;

}

/**
 * @title RewardVault
 * @dev Manages approved usage of PoR tokens (savings, education, retirement)
 */
contract RewardVault is Ownable, ReentrancyGuard {
    
    ISoulboundToken public soulboundToken;
    
    // Vault types
    enum VaultType { Savings, Education, Retirement, Emergency }
    
    // Vault information
    struct Vault {
        VaultType vaultType;
        uint256 targetAmount;
        uint256 currentAmount;
        uint256 tokensSpent;
        uint256 createdAt;
        uint256 targetDate;
        bool isActive;
        string description;
    }
    
    // Service provider
    struct ServiceProvider {
        string name;
        address paymentAddress;
        VaultType allowedVaultType;
        bool isApproved;
    }
    
    // User vaults
    mapping(address => mapping(uint256 => Vault)) public userVaults;
    mapping(address => uint256) public userVaultCount;
    
    // Approved providers
    mapping(address => ServiceProvider) public serviceProviders;
    address[] public providerList;
    
    // PoR to USD rate (in cents)
    uint256 public porToUsdRate = 100;
    
    // Events
    event VaultCreated(address indexed user, uint256 vaultId, VaultType vaultType, uint256 targetAmount);
    event TokensDeposited(address indexed user, uint256 vaultId, uint256 amount);
    event VaultUsed(address indexed user, uint256 vaultId, address provider, uint256 amount);
    event ProviderApproved(address indexed provider, string name, VaultType vaultType);
    
    constructor(address _soulboundToken) Ownable(msg.sender) {
        soulboundToken = ISoulboundToken(_soulboundToken);
    }
    
    function createVault(
        VaultType vaultType,
        uint256 targetAmount,
        uint256 targetDate,
        string memory description
    ) external returns (uint256) {
        require(soulboundToken.hasMinted(msg.sender), "Must have PoR token");
        require(targetAmount > 0, "Target amount must be greater than 0");
        require(targetDate > block.timestamp, "Target date must be in future");
        
        uint256 vaultId = userVaultCount[msg.sender];
        
        userVaults[msg.sender][vaultId] = Vault({
            vaultType: vaultType,
            targetAmount: targetAmount,
            currentAmount: 0,
            tokensSpent: 0,
            createdAt: block.timestamp,
            targetDate: targetDate,
            isActive: true,
            description: description
        });
        
        userVaultCount[msg.sender]++;
        
        emit VaultCreated(msg.sender, vaultId, vaultType, targetAmount);
        
        return vaultId;
    }
    
    function depositToVault(uint256 vaultId, uint256 porAmount) external {
    require(vaultId < userVaultCount[msg.sender], "Vault does not exist");
    require(userVaults[msg.sender][vaultId].isActive, "Vault is not active");
    
    uint256 tokenId = soulboundToken.addressToTokenId(msg.sender);
    ISoulboundToken.TokenData memory tokenData = soulboundToken.tokenData(tokenId);
    
    require(tokenData.porBalance >= porAmount, "Insufficient PoR balance");
    // Burn / spend PoR tokens
soulboundToken.spendReward(tokenId, porAmount);

    // ✅ Declare scaledAmount properly
    uint256 scaledAmount = porAmount * 100;
    
    userVaults[msg.sender][vaultId].currentAmount += scaledAmount;
    userVaults[msg.sender][vaultId].tokensSpent += porAmount;
    
    emit TokensDeposited(msg.sender, vaultId, porAmount);
}
    
    function getUserVaults(address user) external view returns (Vault[] memory) {
        uint256 count = userVaultCount[user];
        Vault[] memory vaults = new Vault[](count);
        
        for (uint256 i = 0; i < count; i++) {
            vaults[i] = userVaults[user][i];
        }
        
        return vaults;
    }
    
    function approveProvider(
        address provider,
        string memory name,
        address paymentAddress,
        VaultType allowedVaultType
    ) external onlyOwner {
        require(provider != address(0), "Invalid provider address");
        
        serviceProviders[provider] = ServiceProvider({
            name: name,
            paymentAddress: paymentAddress,
            allowedVaultType: allowedVaultType,
            isApproved: true
        });
        
        providerList.push(provider);
        
        emit ProviderApproved(provider, name, allowedVaultType);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

interface ISoulboundToken {
    function addReward(uint256 tokenId, uint256 amount) external;
    function updateTier(uint256 tokenId, uint256 newTier) external;
    function updateStreak(uint256 tokenId, uint256 months) external;
    function addressToTokenId(address user) external view returns (uint256);
    function hasMinted(address user) external view returns (bool);
}

/**
 * @title DisciplineRules
 * @dev Manages budget rules, tier progression, and reward distribution
 */
contract DisciplineRules is Ownable {
    
    ISoulboundToken public soulboundToken;
    
    // Tier definitions
    enum Tier { Bronze, Silver, Gold, Platinum }
    
    struct TierRequirements {
        uint256 budgetCompliancePercent; // e.g., 115 means 115% of budget
        uint256 impulseReductionPercent; // e.g., 10 means 10% reduction
        uint256 emergencyFundMonths;     // Number of months of emergency fund
        uint256 rewardAmount;            // PoR tokens per month
        uint256 streakRequired;          // Months required for this tier
    }
    
    // User spending data
    struct UserMonthlyData {
        uint256 budget;              // Monthly budget set by user
        uint256 actualSpent;         // Actual spending
        uint256 impulseSpent;        // Impulse purchases
        uint256 emergencyFundMonths; // Emergency fund coverage
        uint256 timestamp;           // When data was submitted
        bool evaluated;              // Whether rewards were calculated
    }
    
    // Tier requirements mapping
    mapping(uint256 => TierRequirements) public tierRequirements;//to track the tiers levels 
    
    // User data: address => month => data
    mapping(address => mapping(uint256 => UserMonthlyData)) public userMonthlyData;//to track monthly data 
    
    // User current month counter
    mapping(address => uint256) public userCurrentMonth;//each time the reward is calculated the reward is added 
    
    // User baseline impulse spending (for calculating reduction)
    mapping(address => uint256) public userBaselineImpulse;//first month of impulse spending this is set as the base leveel the future months are compared with it 
    
    // Emergency allowance (one per month)
    mapping(address => mapping(uint256 => bool)) public hasUsedEmergency;
    
    // Events
    event BudgetSet(address indexed user, uint256 month, uint256 budget);
    event SpendingRecorded(address indexed user, uint256 month, uint256 actualSpent, uint256 impulseSpent);
    event RewardCalculated(address indexed user, uint256 month, uint256 reward, uint256 tier);
    event EmergencyUsed(address indexed user, uint256 month);
    event TierPromoted(address indexed user, uint256 newTier);
    
    constructor(address _soulboundToken) Ownable(msg.sender) {
        soulboundToken = ISoulboundToken(_soulboundToken);
        
        // Initialize tier requirements
        tierRequirements[0] = TierRequirements(115, 10, 0, 10, 0);  // Bronze tier
        tierRequirements[1] = TierRequirements(105, 25, 1, 25, 1);  // Silver
        tierRequirements[2] = TierRequirements(100, 40, 4, 50, 3);  // Gold
        tierRequirements[3] = TierRequirements(95, 60, 12, 100, 6); // Platinum
    }
    
    /**
     * @dev Set monthly budget
     */
    function setBudget(uint256 budget) external {
        require(budget > 0, "Budget must be greater than 0");
        
        uint256 month = userCurrentMonth[msg.sender];
        
        userMonthlyData[msg.sender][month].budget = budget;//whoever is calling the address 
        userMonthlyData[msg.sender][month].timestamp = block.timestamp;
        
        emit BudgetSet(msg.sender, month, budget);
    }
    
    /**
     * @dev Record spending for current month
     */
    function recordSpending(uint256 actualSpent, uint256 impulseSpent) external {
        uint256 month = userCurrentMonth[msg.sender];
        
        require(userMonthlyData[msg.sender][month].budget > 0, "Set budget first");
        require(actualSpent > 0, "Spending must be greater than 0");
        
        userMonthlyData[msg.sender][month].actualSpent = actualSpent;
        userMonthlyData[msg.sender][month].impulseSpent = impulseSpent;
        
        // Set baseline impulse if first time
        if (userBaselineImpulse[msg.sender] == 0) {
            userBaselineImpulse[msg.sender] = impulseSpent;
        }
        
        emit SpendingRecorded(msg.sender, month, actualSpent, impulseSpent);//to broadcast an event
    }
    
    /**
     * @dev Update emergency fund months
     */
    function updateEmergencyFund(uint256 months) external {
        uint256 month = userCurrentMonth[msg.sender];
        userMonthlyData[msg.sender][month].emergencyFundMonths = months;
    }
    
    /**
     * @dev Use emergency allowance (allows overspend once per month)
     */
    function useEmergency() external {
        uint256 month = userCurrentMonth[msg.sender];
        require(!hasUsedEmergency[msg.sender][month], "Emergency already used this month");
        
        hasUsedEmergency[msg.sender][month] = true;
        emit EmergencyUsed(msg.sender, month);
    }
    
    /**
     * @dev Calculate and distribute rewards for current month
     */
    function calculateRewards() external {
        
        require(soulboundToken.hasMinted(msg.sender), "Must have PoR token");
        
        uint256 month = userCurrentMonth[msg.sender];
        UserMonthlyData storage data = userMonthlyData[msg.sender][month];
        
        require(data.budget > 0, "No budget set");
        require(data.actualSpent > 0, "No spending recorded");
        require(!data.evaluated, "Already evaluated");
        
        // Calculate compliance
        uint256 spentPercent = (data.actualSpent * 100) / data.budget;
        
        // Calculate impulse reduction
        uint256 impulseReductionPercent = 0;
        if (userBaselineImpulse[msg.sender] > 0) {
            if (data.impulseSpent < userBaselineImpulse[msg.sender]) {
                impulseReductionPercent = ((userBaselineImpulse[msg.sender] - data.impulseSpent) * 100) / userBaselineImpulse[msg.sender];
            }
        }
        
        // Determine tier
        uint256 tier = determineTier(spentPercent, impulseReductionPercent, data.emergencyFundMonths, msg.sender);
        
        // Check if emergency was used (soft penalty)
        uint256 rewardAmount = tierRequirements[tier].rewardAmount;
        if (hasUsedEmergency[msg.sender][month]) {
            rewardAmount = rewardAmount / 2; // 50% penalty for using emergency
        }
        
        // Mark as evaluated
        data.evaluated = true;
        
        // Update token
        uint256 tokenId = soulboundToken.addressToTokenId(msg.sender);
        soulboundToken.addReward(tokenId, rewardAmount);
        soulboundToken.updateTier(tokenId, tier);
        // --------------------
// UPDATE STREAK LOGIC
// --------------------
uint256 previousMonth = month;

if (previousMonth == 0) {
    // First evaluated month → streak = 1
    soulboundToken.updateStreak(tokenId, 1);
} else {
    UserMonthlyData storage prevData =
        userMonthlyData[msg.sender][previousMonth - 1];

    if (prevData.evaluated) {
        // Consecutive success → increment streak
        soulboundToken.updateStreak(tokenId, previousMonth + 1);
    } else {
        // Break in streak
        soulboundToken.updateStreak(tokenId, 1);
    }
}
        
        // Increment month
        userCurrentMonth[msg.sender]++;
        
        emit RewardCalculated(msg.sender, month, rewardAmount, tier);
    }
    
    /**
     * @dev Determine user's tier based on performance
     */
    function determineTier(
        uint256 spentPercent,
        uint256 impulseReductionPercent,
        uint256 emergencyFundMonths,
        address user
    ) internal view returns (uint256) {
        // Check from highest to lowest tier
        for (uint256 i = 3; i > 0; i--) {
            TierRequirements memory req = tierRequirements[i];
            
            if (spentPercent <= req.budgetCompliancePercent &&
                impulseReductionPercent >= req.impulseReductionPercent &&
                emergencyFundMonths >= req.emergencyFundMonths) {
                return i;
            }
        }
        
        // Default to Bronze
        return 0;
    }
    
    /**
     * @dev Get user's current month data
     */
    function getCurrentMonthData(address user) external view returns (UserMonthlyData memory) {
        uint256 month = userCurrentMonth[user];
        return userMonthlyData[user][month];
    }
    
    /**
     * @dev Update tier requirements (only owner)
     */
    function updateTierRequirements(
        uint256 tier,
        uint256 budgetCompliance,
        uint256 impulseReduction,
        uint256 emergencyFund,
        uint256 reward,
        uint256 streak
    ) external onlyOwner {
        require(tier <= 3, "Invalid tier");
        
        tierRequirements[tier] = TierRequirements(
            budgetCompliance,
            impulseReduction,
            emergencyFund,
            reward,
            streak
        );
    }
}
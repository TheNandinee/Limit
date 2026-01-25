// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SoulboundToken
 * @dev Non-transferable NFT representing Proof of Restraint achievements
 * Each user can only have ONE soulbound token that accumulates rewards
 */
contract SoulboundToken is ERC721, Ownable {

    // Counter for token IDs
    uint256 private _tokenIdCounter;

    // Mapping from address to whether they have minted
    mapping(address => bool) public hasMinted;

    // Mapping from address to their token ID
    mapping(address => uint256) public addressToTokenId;

    // Token metadata structure
    struct TokenData {
        uint256 porBalance;        // Accumulated PoR tokens
        uint256 totalEarned;       // Lifetime earnings
        uint256 currentTier;       // 0=Bronze,1=Silver,2=Gold,3=Platinum
        uint256 consecutiveMonths; // Streak of successful months
        uint256 lastRewardTime;    // Timestamp of last reward
        bool isActive;             // Whether token is active
    }

    // Mapping from token ID to token data
    mapping(uint256 => TokenData) public tokenData;

    // Authorized contracts
    mapping(address => bool) public authorizedContracts;

    // Events
    event TokenMinted(address indexed to, uint256 indexed tokenId);
    event RewardAdded(uint256 indexed tokenId, uint256 amount, uint256 newBalance);
    event RewardSpent(uint256 indexed tokenId, uint256 amount, uint256 newBalance);
    event TierUpdated(uint256 indexed tokenId, uint256 newTier);
    event ContractAuthorized(address indexed contractAddress, bool status);

    constructor() ERC721("Proof of Restraint", "PoR") Ownable(msg.sender) {
        _tokenIdCounter = 1;
    }

    /**
     * @dev Mint soulbound token (one per address)
     */
    function mint(address to) public onlyOwner {
        require(!hasMinted[to], "Address already has a token");
        require(to != address(0), "Cannot mint to zero address");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);

        hasMinted[to] = true;
        addressToTokenId[to] = tokenId;

        tokenData[tokenId] = TokenData({
            porBalance: 0,
            totalEarned: 0,
            currentTier: 0,
            consecutiveMonths: 0,
            lastRewardTime: block.timestamp,
            isActive: true
        });

        emit TokenMinted(to, tokenId);
    }

    /**
     * @dev Add PoR rewards
     */
    function addReward(uint256 tokenId, uint256 amount)
        external
        onlyAuthorized
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(tokenData[tokenId].isActive, "Token inactive");

        tokenData[tokenId].porBalance += amount;
        tokenData[tokenId].totalEarned += amount;
        tokenData[tokenId].lastRewardTime = block.timestamp;

        emit RewardAdded(tokenId, amount, tokenData[tokenId].porBalance);
    }

    /**
     * ✅ NEW FUNCTION
     * @dev Spend PoR tokens (used by RewardVault)
     */
    function spendReward(uint256 tokenId, uint256 amount)
        external
        onlyAuthorized
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(tokenData[tokenId].porBalance >= amount, "Insufficient balance");

        tokenData[tokenId].porBalance -= amount;

        emit RewardSpent(tokenId, amount, tokenData[tokenId].porBalance);
    }

    /**
     * @dev Update tier
     */
    function updateTier(uint256 tokenId, uint256 newTier)
        external
        onlyAuthorized
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(newTier <= 3, "Invalid tier");

        tokenData[tokenId].currentTier = newTier;

        emit TierUpdated(tokenId, newTier);
    }

    /**
     * @dev Update streak
     */
    function updateStreak(uint256 tokenId, uint256 months)
        external
        onlyAuthorized
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        tokenData[tokenId].consecutiveMonths = months;
    }

    /**
     * @dev Get token data for user
     */
    function getTokenData(address user)
        external
        view
        returns (TokenData memory)
    {
        require(hasMinted[user], "User does not have token");
        return tokenData[addressToTokenId[user]];
    }

    /**
     * @dev Authorize contracts
     */
    function setAuthorizedContract(address contractAddress, bool status)
        external
        onlyOwner
    {
        authorizedContracts[contractAddress] = status;
        emit ContractAuthorized(contractAddress, status);
    }

    /**
     * @dev Make NFT soulbound
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        require(
            from == address(0),
            "Soulbound: Token cannot be transferred"
        );

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Only authorized contracts
     */
    modifier onlyAuthorized() {
        require(
            authorizedContracts[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }
}
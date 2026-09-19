// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDuelArena {
    enum DuelState {
        CREATED,
        JOINED,
        ACTIVE,
        COMMITTED,
        SETTLED,
        CANCELLED
    }

    struct Duel {
        uint256 id;
        address playerA;
        address playerB;
        uint256 entryStake;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        bytes32 rulesHash;
        bytes32 finalStateHash;
        address winner;
        DuelState state;
        uint256 totalPredictionPoolA;
        uint256 totalPredictionPoolB;
        bool traderRewardsClaimed;
    }

    struct Prediction {
        uint256 amount;
        address predictedWinner;
        bool claimed;
    }

    event DuelCreated(uint256 indexed duelId, address indexed creator, uint256 stake, uint256 duration, bytes32 rulesHash);
    event DuelJoined(uint256 indexed duelId, address indexed opponent);
    event DuelStarted(uint256 indexed duelId, uint256 startTime, uint256 endTime);
    event PredictionPlaced(uint256 indexed duelId, address indexed predictor, address indexed predictedWinner, uint256 amount);
    event PredictionPoolClosed(uint256 indexed duelId, uint256 totalPoolA, uint256 totalPoolB);
    event OutcomeCommitted(uint256 indexed duelId, address indexed winner, bytes32 stateHash, uint256 priceStart, uint256 priceEnd);
    event DuelSettled(uint256 indexed duelId, address indexed winner, uint256 traderPayout, uint256 spectatorPoolPayout);
    event RewardClaimed(uint256 indexed duelId, address indexed claimant, uint256 amount);
    event PredictionClaimed(uint256 indexed duelId, address indexed predictor, uint256 payout);
    event DuelCancelled(uint256 indexed duelId, string reason);
    event TreasuryUpdated(address indexed newTreasury);
    event FeesDistributed(address indexed treasury, uint256 amount);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    function createDuel(uint256 duration, bytes32 rulesHash) external payable returns (uint256 duelId);
    function joinDuel(uint256 duelId) external payable;
    function startDuel(uint256 duelId) external;
    function placePrediction(uint256 duelId, address predictedWinner) external payable;
    function commitOutcome(
        uint256 duelId,
        address winner,
        bytes32 stateHash,
        uint256 priceStart,
        uint256 priceEnd,
        bytes calldata sigA,
        bytes calldata sigB
    ) external;
    function settleDuel(uint256 duelId) external;
    function claimReward(uint256 duelId) external;
    function claimPrediction(uint256 duelId) external;
    function cancelDuel(uint256 duelId) external;
    function setTreasury(address newTreasury) external;
    function withdrawFees(address payable recipient) external;
    function treasury() external view returns (address);
    function accumulatedFees() external view returns (uint256);
}

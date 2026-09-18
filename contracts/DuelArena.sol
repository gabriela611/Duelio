// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IDuelArena.sol";

/**
 * @title DuelArena
 * @notice Authoritative on-chain settlement and prediction contract for Duelio on Monad.
 * @dev Optimized for Monad EVM. Holds escrow stakes, enforces match lifecycle,
 * and distributes spectator prediction rewards deterministically.
 */
contract DuelArena is IDuelArena {
    uint256 public duelCounter;
    address public owner;
    bool private locked;

    mapping(uint256 => Duel) public duels;
    // duelId => predictor => Prediction
    mapping(uint256 => mapping(address => Prediction)) public predictions;
    // duelId => list of predictors
    mapping(uint256 => address[]) private duelPredictors;

    uint256 public constant MIN_DURATION = 30 seconds;
    uint256 public constant MAX_DURATION = 15 minutes;
    uint256 public constant PLATFORM_FEE_BPS = 200; // 2% protocol fee (200 / 10000)
    uint256 public constant BPS_DIVISOR = 10000;

    modifier nonReentrant() {
        require(!locked, "REENTRANCY_GUARD");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Create a new PvP duel with testnet MON stake.
     * @param duration Duration of the match in seconds.
     * @param rulesHash Hash of the agreed rule set and asset pool.
     */
    function createDuel(uint256 duration, bytes32 rulesHash) external payable override returns (uint256) {
        require(msg.value > 0, "STAKE_REQUIRED");
        require(duration >= MIN_DURATION && duration <= MAX_DURATION, "INVALID_DURATION");

        duelCounter++;
        uint256 duelId = duelCounter;

        Duel storage duel = duels[duelId];
        duel.id = duelId;
        duel.playerA = msg.sender;
        duel.entryStake = msg.value;
        duel.duration = duration;
        duel.rulesHash = rulesHash;
        duel.state = DuelState.CREATED;

        emit DuelCreated(duelId, msg.sender, msg.value, duration, rulesHash);
        return duelId;
    }

    /**
     * @notice Opponent joins an existing duel, matching the entry stake.
     * @param duelId ID of the duel to join.
     */
    function joinDuel(uint256 duelId) external payable override {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.CREATED, "DUEL_NOT_AVAILABLE");
        require(msg.sender != duel.playerA, "CANNOT_DUEL_SELF");
        require(msg.value == duel.entryStake, "INCORRECT_STAKE");

        duel.playerB = msg.sender;
        duel.state = DuelState.JOINED;

        emit DuelJoined(duelId, msg.sender);
    }

    /**
     * @notice Starts the duel timer. Can be invoked once playerB has joined.
     * @param duelId ID of the duel to start.
     */
    function startDuel(uint256 duelId) external override {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.JOINED, "DUEL_NOT_READY");
        require(msg.sender == duel.playerA || msg.sender == duel.playerB || msg.sender == owner, "UNAUTHORIZED");

        duel.startTime = block.timestamp;
        duel.endTime = block.timestamp + duel.duration;
        duel.state = DuelState.ACTIVE;

        emit DuelStarted(duelId, duel.startTime, duel.endTime);
    }

    /**
     * @notice Spectator prediction on winner before the prediction window closes (50% of duration).
     * @param duelId ID of the duel.
     * @param predictedWinner The address of the trader backed (must be playerA or playerB).
     */
    function placePrediction(uint256 duelId, address predictedWinner) external payable override nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.ACTIVE || duel.state == DuelState.JOINED, "DUEL_NOT_ACTIVE");
        require(msg.value > 0, "AMOUNT_ZERO");
        require(msg.sender != duel.playerA && msg.sender != duel.playerB, "PARTICIPANTS_CANNOT_PREDICT");
        require(predictedWinner == duel.playerA || predictedWinner == duel.playerB, "INVALID_PREDICTED_WINNER");

        // Anti-frontrunning: predictions close at 50% of the match duration
        if (duel.state == DuelState.ACTIVE) {
            uint256 midpoint = duel.startTime + (duel.duration / 2);
            require(block.timestamp <= midpoint, "PREDICTION_WINDOW_CLOSED");
        }

        Prediction storage userPred = predictions[duelId][msg.sender];
        if (userPred.amount == 0) {
            duelPredictors[duelId].push(msg.sender);
            userPred.predictedWinner = predictedWinner;
        } else {
            require(userPred.predictedWinner == predictedWinner, "CANNOT_SWITCH_SIDE");
        }

        userPred.amount += msg.value;

        if (predictedWinner == duel.playerA) {
            duel.totalPredictionPoolA += msg.value;
        } else {
            duel.totalPredictionPoolB += msg.value;
        }

        emit PredictionPlaced(duelId, msg.sender, predictedWinner, msg.value);
    }

    /**
     * @notice Commits the off-chain game outcome with signed evidence or referee proof.
     * @param duelId ID of the duel.
     * @param winner Declared winner address.
     * @param stateHash Hash of the deterministic game transcript.
     * @param priceStart Verified start price snapshot.
     * @param priceEnd Verified end price snapshot.
     * @param sigA Signature of Player A or referee.
     * @param sigB Signature of Player B or referee.
     */
    function commitOutcome(
        uint256 duelId,
        address winner,
        bytes32 stateHash,
        uint256 priceStart,
        uint256 priceEnd,
        bytes calldata sigA,
        bytes calldata sigB
    ) external override {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.ACTIVE, "DUEL_NOT_ACTIVE");
        require(winner == duel.playerA || winner == duel.playerB, "INVALID_WINNER");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(duelId, winner, stateHash, priceStart, priceEnd))
            )
        );

        address recoveredA = recoverSigner(messageHash, sigA);
        address recoveredB = recoverSigner(messageHash, sigB);

        // Verification: Either both players signed the mutual outcome hash, or authorized owner/referee signed
        bool mutualConsent = (recoveredA == duel.playerA && recoveredB == duel.playerB);
        bool refereeAuthorized = (recoveredA == owner || recoveredB == owner || msg.sender == owner);

        require(mutualConsent || refereeAuthorized, "INVALID_SIGNATURES");

        duel.winner = winner;
        duel.finalStateHash = stateHash;
        duel.state = DuelState.COMMITTED;

        emit OutcomeCommitted(duelId, winner, stateHash, priceStart, priceEnd);
    }

    /**
     * @notice Settles the duel and closes prediction pools.
     * @param duelId ID of the duel.
     */
    function settleDuel(uint256 duelId) external override nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.COMMITTED, "OUTCOME_NOT_COMMITTED");

        duel.state = DuelState.SETTLED;

        uint256 totalTraderPool = duel.entryStake * 2;
        uint256 protocolFee = (totalTraderPool * PLATFORM_FEE_BPS) / BPS_DIVISOR;
        uint256 traderPayout = totalTraderPool - protocolFee;

        uint256 winningSpectatorPool = (duel.winner == duel.playerA) ? duel.totalPredictionPoolA : duel.totalPredictionPoolB;
        uint256 losingSpectatorPool = (duel.winner == duel.playerA) ? duel.totalPredictionPoolB : duel.totalPredictionPoolA;
        uint256 spectatorPoolPayout = winningSpectatorPool + losingSpectatorPool;

        emit PredictionPoolClosed(duelId, duel.totalPredictionPoolA, duel.totalPredictionPoolB);
        emit DuelSettled(duelId, duel.winner, traderPayout, spectatorPoolPayout);
    }

    /**
     * @notice Winning trader claims their purse.
     * @param duelId ID of the duel.
     */
    function claimReward(uint256 duelId) external override nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.SETTLED, "DUEL_NOT_SETTLED");
        require(msg.sender == duel.winner, "NOT_WINNER");
        require(!duel.traderRewardsClaimed, "ALREADY_CLAIMED");

        duel.traderRewardsClaimed = true;

        uint256 totalTraderPool = duel.entryStake * 2;
        uint256 protocolFee = (totalTraderPool * PLATFORM_FEE_BPS) / BPS_DIVISOR;
        uint256 payout = totalTraderPool - protocolFee;

        (bool success, ) = payable(duel.winner).call{value: payout}("");
        require(success, "TRANSFER_FAILED");

        emit RewardClaimed(duelId, msg.sender, payout);
    }

    /**
     * @notice Winning spectators claim their pro-rata prediction rewards.
     * @param duelId ID of the duel.
     */
    function claimPrediction(uint256 duelId) external override nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.SETTLED, "DUEL_NOT_SETTLED");

        Prediction storage userPred = predictions[duelId][msg.sender];
        require(userPred.amount > 0, "NO_PREDICTION");
        require(!userPred.claimed, "ALREADY_CLAIMED");
        require(userPred.predictedWinner == duel.winner, "LOST_PREDICTION");

        userPred.claimed = true;

        uint256 winningPool = (duel.winner == duel.playerA) ? duel.totalPredictionPoolA : duel.totalPredictionPoolB;
        uint256 losingPool = (duel.winner == duel.playerA) ? duel.totalPredictionPoolB : duel.totalPredictionPoolA;
        uint256 totalPool = winningPool + losingPool;

        // Pro-rata distribution: (userStake / winningPool) * totalPool
        uint256 payout = (userPred.amount * totalPool) / winningPool;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "TRANSFER_FAILED");

        emit PredictionClaimed(duelId, msg.sender, payout);
    }

    /**
     * @notice Cancels a created duel if no opponent joined within 1 hour.
     * @param duelId ID of the duel.
     */
    function cancelDuel(uint256 duelId) external nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.CREATED, "CANNOT_CANCEL");
        require(msg.sender == duel.playerA || msg.sender == owner, "UNAUTHORIZED");

        duel.state = DuelState.CANCELLED;
        (bool success, ) = payable(duel.playerA).call{value: duel.entryStake}("");
        require(success, "REFUND_FAILED");

        emit DuelCancelled(duelId, "Cancelled by creator");
    }

    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(hash, v, r, s);
    }

    receive() external payable {}
}

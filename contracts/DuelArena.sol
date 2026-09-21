// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IDuelArena.sol";

/**
 * @title DuelArena
 * @notice Authoritative on-chain settlement and prediction contract for Duelio on Monad.
 * @dev Optimized for Monad EVM. Holds escrow stakes, enforces match lifecycle,
 * routes platform fees to the house treasury, and distributes spectator prediction rewards deterministically.
 */
contract DuelArena is IDuelArena {
    uint256 public duelCounter;
    address public owner;
    address public override treasury;
    address public override referee;
    uint256 public override accumulatedFees;
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

    // EIP-712 Typed Data Constants
    bytes32 public constant OUTCOME_TYPEHASH = keccak256(
        "Outcome(uint256 duelId,address winner,bytes32 stateHash,uint256 priceStart,uint256 priceEnd,uint256 deadline)"
    );

    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public immutable DOMAIN_NAME_HASH = keccak256(bytes("DuelArena"));
    bytes32 public immutable DOMAIN_VERSION_HASH = keccak256(bytes("1"));

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

    constructor(address _initialTreasury) {
        owner = msg.sender;
        treasury = _initialTreasury != address(0) ? _initialTreasury : msg.sender;
        referee = msg.sender;
    }

    /**
     * @notice Returns the EIP-712 Domain Separator dynamically bound to chainId and this contract address.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                DOMAIN_NAME_HASH,
                DOMAIN_VERSION_HASH,
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Computes the EIP-712 digest for duel outcome commit evidence.
     */
    function hashOutcome(
        uint256 duelId,
        address winner,
        bytes32 stateHash,
        uint256 priceStart,
        uint256 priceEnd,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                OUTCOME_TYPEHASH,
                duelId,
                winner,
                stateHash,
                priceStart,
                priceEnd,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /**
     * @notice Updates the House Treasury destination address.
     * @param newTreasury The address of the new house wallet.
     */
    function setTreasury(address newTreasury) external override onlyOwner {
        require(newTreasury != address(0), "INVALID_TREASURY");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /**
     * @notice Updates the designated oracle referee address.
     * @param newReferee The address of the new referee signer.
     */
    function setReferee(address newReferee) external override onlyOwner {
        require(newReferee != address(0), "INVALID_REFEREE");
        referee = newReferee;
        emit RefereeUpdated(newReferee);
    }

    /**
     * @notice Allows protocol owner to sweep unforwarded accumulated fees to an authorized recipient.
     * @param recipient The recipient address for the fee withdrawal.
     */
    function withdrawFees(address payable recipient) external override onlyOwner nonReentrant {
        require(recipient != address(0), "INVALID_RECIPIENT");
        uint256 amount = accumulatedFees;
        require(amount > 0, "NO_FEES_TO_WITHDRAW");
        require(address(this).balance >= amount, "INSUFFICIENT_BALANCE");

        accumulatedFees = 0;
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "FEE_WITHDRAW_FAILED");

        emit FeesWithdrawn(recipient, amount);
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

    function _verifyOutcomeSignatures(
        bytes32 digest,
        bytes calldata sigA,
        bytes calldata sigB,
        address playerA,
        address playerB
    ) internal view returns (bool) {
        address recoveredA = recoverSigner(digest, sigA);
        address recoveredB = recoverSigner(digest, sigB);

        bool mutualConsent = (recoveredA == playerA && recoveredB == playerB);
        bool refereeAuthorized = (referee != address(0) && (recoveredA == referee || recoveredB == referee));

        return (mutualConsent || refereeAuthorized);
    }

    /**
     * @notice Commits the off-chain game outcome with EIP-712 signed evidence.
     * @dev Outcome must be signed mutually by both players OR by the authorized referee.
     * Zero msg.sender owner bypass. Replay protected by chainid, verifying contract, and deadline.
     * @param duelId ID of the duel.
     * @param winner Declared winner address, or address(0) in case of a DRAW.
     * @param stateHash Hash of the deterministic game transcript.
     * @param priceStart Verified start price snapshot.
     * @param priceEnd Verified end price snapshot.
     * @param deadline Expiration timestamp for the signatures.
     * @param sigA Signature of Player A or referee.
     * @param sigB Signature of Player B or referee.
     */
    function commitOutcome(
        uint256 duelId,
        address winner,
        bytes32 stateHash,
        uint256 priceStart,
        uint256 priceEnd,
        uint256 deadline,
        bytes calldata sigA,
        bytes calldata sigB
    ) external override {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.ACTIVE, "DUEL_NOT_ACTIVE");
        require(block.timestamp >= duel.endTime, "DUEL_NOT_FINISHED");
        require(block.timestamp <= deadline, "SIGNATURE_EXPIRED");
        require(
            winner == address(0) || winner == duel.playerA || winner == duel.playerB,
            "INVALID_WINNER"
        );

        bytes32 digest = hashOutcome(duelId, winner, stateHash, priceStart, priceEnd, deadline);
        require(
            _verifyOutcomeSignatures(digest, sigA, sigB, duel.playerA, duel.playerB),
            "INVALID_SIGNATURES"
        );

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
        _settleDuel(duelId);
    }

    function _settleDuel(uint256 duelId) internal {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.COMMITTED, "OUTCOME_NOT_COMMITTED");

        duel.state = DuelState.SETTLED;

        if (duel.winner == address(0)) {
            // DRAW: No platform fees, pools refunded in full
            emit PredictionPoolClosed(duelId, duel.totalPredictionPoolA, duel.totalPredictionPoolB);
            emit DuelSettled(duelId, address(0), 0, 0);
            return;
        }

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
     * @notice Winning trader claims their purse, or participants claim refund in case of DRAW.
     * @param duelId ID of the duel.
     */
    function claimReward(uint256 duelId) external override nonReentrant {
        _claimReward(duelId);
    }

    function _claimReward(uint256 duelId) internal {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.SETTLED, "DUEL_NOT_SETTLED");

        if (duel.winner == address(0)) {
            // DRAW: each participant can claim refund of their entry stake
            require(msg.sender == duel.playerA || msg.sender == duel.playerB, "NOT_PARTICIPANT");
            if (msg.sender == duel.playerA) {
                require(!duel.playerAClaimed, "ALREADY_CLAIMED");
                duel.playerAClaimed = true;
            } else {
                require(!duel.playerBClaimed, "ALREADY_CLAIMED");
                duel.playerBClaimed = true;
            }

            (bool refundOk, ) = payable(msg.sender).call{value: duel.entryStake}("");
            require(refundOk, "TRANSFER_FAILED");

            emit RewardClaimed(duelId, msg.sender, duel.entryStake);
            return;
        }

        require(msg.sender == duel.winner, "NOT_WINNER");
        require(!duel.traderRewardsClaimed, "ALREADY_CLAIMED");

        duel.traderRewardsClaimed = true;

        uint256 totalTraderPool = duel.entryStake * 2;
        uint256 protocolFee = (totalTraderPool * PLATFORM_FEE_BPS) / BPS_DIVISOR;
        uint256 payout = totalTraderPool - protocolFee;

        (bool success, ) = payable(duel.winner).call{value: payout}("");
        require(success, "TRANSFER_FAILED");

        // Forward platform fee directly to the House Treasury wallet
        if (protocolFee > 0) {
            if (treasury != address(0)) {
                (bool feeSuccess, ) = payable(treasury).call{value: protocolFee}("");
                if (feeSuccess) {
                    emit FeesDistributed(treasury, protocolFee);
                } else {
                    accumulatedFees += protocolFee;
                }
            } else {
                accumulatedFees += protocolFee;
            }
        }

        emit RewardClaimed(duelId, msg.sender, payout);
    }

    /**
     * @notice Convenience helper to settle and claim a duel in a single transaction.
     * @param duelId ID of the duel.
     */
    function settleAndClaim(uint256 duelId) external nonReentrant {
        Duel storage duel = duels[duelId];
        if (duel.state == DuelState.COMMITTED) {
            _settleDuel(duelId);
        }
        _claimReward(duelId);
    }

    /**
     * @notice Winning spectators claim their pro-rata prediction rewards (or refund in DRAW).
     * @param duelId ID of the duel.
     */
    function claimPrediction(uint256 duelId) external override nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.SETTLED, "DUEL_NOT_SETTLED");

        Prediction storage userPred = predictions[duelId][msg.sender];
        require(userPred.amount > 0, "NO_PREDICTION");
        require(!userPred.claimed, "ALREADY_CLAIMED");

        userPred.claimed = true;

        uint256 winningPool = (duel.winner == duel.playerA) ? duel.totalPredictionPoolA : duel.totalPredictionPoolB;
        uint256 losingPool = (duel.winner == duel.playerA) ? duel.totalPredictionPoolB : duel.totalPredictionPoolA;
        uint256 totalPool = winningPool + losingPool;

        uint256 payout;
        if (duel.winner == address(0) || winningPool == 0) {
            // DRAW or unbacked winner safeguard: refund original prediction stake
            payout = userPred.amount;
        } else {
            require(userPred.predictedWinner == duel.winner, "LOST_PREDICTION");
            // Pro-rata distribution: (userStake / winningPool) * totalPool
            payout = (userPred.amount * totalPool) / winningPool;
        }

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "TRANSFER_FAILED");

        emit PredictionClaimed(duelId, msg.sender, payout);
    }

    /**
     * @notice Cancels a created or joined duel if participants abandon the match before start.
     * @param duelId ID of the duel.
     */
    function cancelDuel(uint256 duelId) external override nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.state == DuelState.CREATED || duel.state == DuelState.JOINED, "CANNOT_CANCEL");
        require(msg.sender == duel.playerA || msg.sender == duel.playerB || msg.sender == owner, "UNAUTHORIZED");

        duel.state = DuelState.CANCELLED;

        (bool successA, ) = payable(duel.playerA).call{value: duel.entryStake}("");
        require(successA, "REFUND_A_FAILED");

        if (duel.playerB != address(0)) {
            (bool successB, ) = payable(duel.playerB).call{value: duel.entryStake}("");
            require(successB, "REFUND_B_FAILED");
        }

        emit DuelCancelled(duelId, "Cancelled by participant or owner");
    }

    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly ("memory-safe") {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // EIP-2 malleability protection
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
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

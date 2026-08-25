// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VRFConsumer} from "../core/VRFConsumer.sol";

/**
 * @title PvPArena
 * @notice 1v1 Coin Duel PvP Arena on Base with provably fair Chainlink VRF v2.5 resolution.
 * @dev Platform takes a 2% rake with zero house bankroll exposure. Includes pull-payment fallback.
 */
contract PvPArena is VRFConsumer, ReentrancyGuard {
    enum RoomStatus {
        OPEN,
        MATCHED,
        SETTLED,
        CANCELLED
    }

    struct Room {
        uint256 roomId;
        address playerA;
        address playerB;
        uint256 betAmount;
        uint8 choiceA; // 0 = Heads, 1 = Tails
        uint256 vrfRequestId;
        RoomStatus status;
        uint256 blockNumber;
        address winner;
        uint256 createdAt;
    }

    uint256 public nextRoomId = 1;
    uint256 public rakeBps = 200; // 2% rake (200 / 10000)
    uint256 public constant MAX_RAKE_BPS = 500; // Max 5%
    uint256 public minBet = 0.000115 ether;
    uint256 public maxBet = 0.05 ether;
    uint256 public constant TIMEOUT_BLOCKS = 60;

    address public treasury;
    bool public paused;

    mapping(uint256 => Room) public rooms;
    mapping(uint256 => uint256) public vrfRequestToRoomId;
    mapping(address => uint256) public playerActiveRoom;
    mapping(address => uint256) public pendingWithdrawals;

    event RoomCreated(
        uint256 indexed roomId,
        address indexed playerA,
        uint256 betAmount,
        uint8 choiceA
    );
    event RoomJoined(
        uint256 indexed roomId,
        address indexed playerB,
        uint256 vrfRequestId
    );
    event RoomSettled(
        uint256 indexed roomId,
        address indexed winner,
        address indexed loser,
        uint256 payout,
        uint256 rake,
        uint8 outcome
    );
    event RoomCancelled(
        uint256 indexed roomId,
        address indexed playerA,
        uint256 refundedAmount
    );
    event RoomTimeoutRefunded(
        uint256 indexed roomId,
        address indexed playerA,
        address indexed playerB,
        uint256 amountPerPlayer
    );
    event WithdrawalClaimed(address indexed player, uint256 amount);
    event RakeBpsUpdated(uint256 oldRake, uint256 newRake);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event ArenaPauseUpdated(bool paused);
    event MinMaxBetUpdated(uint256 minBet, uint256 maxBet);

    error ArenaPaused();
    error InvalidBetAmount(uint256 amount, uint256 min, uint256 max);
    error InvalidChoice(uint8 choice);
    error PlayerHasActiveRoom(uint256 roomId);
    error RoomNotFound(uint256 roomId);
    error RoomNotOpen(uint256 roomId);
    error RoomNotMatched(uint256 roomId);
    error CannotPlayAgainstSelf();
    error MismatchedBetAmount(uint256 sent, uint256 required);
    error OnlyCreatorCanCancel();
    error TimeoutNotReached(uint256 currentBlock, uint256 eligibleBlock);
    error TransferFailed();
    error NoPendingWithdrawal();
    error InvalidRakeBps();
    error InvalidTreasury();

    constructor(
        address treasury_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) VRFConsumer(coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {
        if (treasury_ == address(0)) revert InvalidTreasury();
        treasury = treasury_;
    }

    /**
     * @notice Create a new PvP duel room with a bet and side choice.
     * @param choice 0 for Heads, 1 for Tails
     */
    function createRoom(uint8 choice) external payable nonReentrant returns (uint256 roomId) {
        if (paused) revert ArenaPaused();
        if (msg.value < minBet || msg.value > maxBet) {
            revert InvalidBetAmount(msg.value, minBet, maxBet);
        }
        if (choice != 0 && choice != 1) revert InvalidChoice(choice);
        if (playerActiveRoom[msg.sender] != 0) {
            revert PlayerHasActiveRoom(playerActiveRoom[msg.sender]);
        }

        roomId = nextRoomId++;
        rooms[roomId] = Room({
            roomId: roomId,
            playerA: msg.sender,
            playerB: address(0),
            betAmount: msg.value,
            choiceA: choice,
            vrfRequestId: 0,
            status: RoomStatus.OPEN,
            blockNumber: block.number,
            winner: address(0),
            createdAt: block.timestamp
        });

        playerActiveRoom[msg.sender] = roomId;
        emit RoomCreated(roomId, msg.sender, msg.value, choice);
    }

    /**
     * @notice Join an open room by matching the host's bet. Triggers Chainlink VRF request.
     * @param roomId ID of the room to join
     */
    function joinRoom(uint256 roomId) external payable nonReentrant {
        if (paused) revert ArenaPaused();
        Room storage room = rooms[roomId];
        if (room.roomId == 0) revert RoomNotFound(roomId);
        if (room.status != RoomStatus.OPEN) revert RoomNotOpen(roomId);
        if (room.playerA == msg.sender) revert CannotPlayAgainstSelf();
        if (msg.value != room.betAmount) {
            revert MismatchedBetAmount(msg.value, room.betAmount);
        }
        if (playerActiveRoom[msg.sender] != 0) {
            revert PlayerHasActiveRoom(playerActiveRoom[msg.sender]);
        }

        room.playerB = msg.sender;
        room.status = RoomStatus.MATCHED;
        room.blockNumber = block.number;
        playerActiveRoom[msg.sender] = roomId;

        uint256 requestId = _requestRandomness();
        room.vrfRequestId = requestId;
        vrfRequestToRoomId[requestId] = roomId;

        emit RoomJoined(roomId, msg.sender, requestId);
    }

    /**
     * @notice Cancel an unmatched open room and receive a full refund.
     * @param roomId ID of the room to cancel
     */
    function cancelRoom(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.roomId == 0) revert RoomNotFound(roomId);
        if (room.status != RoomStatus.OPEN) revert RoomNotOpen(roomId);
        if (room.playerA != msg.sender) revert OnlyCreatorCanCancel();

        room.status = RoomStatus.CANCELLED;
        playerActiveRoom[msg.sender] = 0;

        uint256 refundAmount = room.betAmount;
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) {
            pendingWithdrawals[msg.sender] += refundAmount;
        }

        emit RoomCancelled(roomId, msg.sender, refundAmount);
    }

    /**
     * @notice If VRF does not respond within TIMEOUT_BLOCKS, either player can trigger a full refund.
     * @param roomId ID of the matched room
     */
    function claimTimeout(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.roomId == 0) revert RoomNotFound(roomId);
        if (room.status != RoomStatus.MATCHED) revert RoomNotMatched(roomId);

        uint256 eligibleBlock = room.blockNumber + TIMEOUT_BLOCKS;
        if (block.number <= eligibleBlock) {
            revert TimeoutNotReached(block.number, eligibleBlock);
        }

        room.status = RoomStatus.CANCELLED;
        playerActiveRoom[room.playerA] = 0;
        playerActiveRoom[room.playerB] = 0;

        uint256 amount = room.betAmount;
        (bool successA, ) = payable(room.playerA).call{value: amount}("");
        if (!successA) pendingWithdrawals[room.playerA] += amount;

        (bool successB, ) = payable(room.playerB).call{value: amount}("");
        if (!successB) pendingWithdrawals[room.playerB] += amount;

        emit RoomTimeoutRefunded(roomId, room.playerA, room.playerB, amount);
    }

    /**
     * @notice Claim any pending withdrawals from failed direct transfers.
     */
    function withdrawPending() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoPendingWithdrawal();

        pendingWithdrawals[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit WithdrawalClaimed(msg.sender, amount);
    }

    /**
     * @dev Chainlink VRF callback that resolves the coin flip and pays the winner.
     */
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 roomId = vrfRequestToRoomId[requestId];
        Room storage room = rooms[roomId];

        if (room.roomId == 0 || room.status != RoomStatus.MATCHED) return;

        room.status = RoomStatus.SETTLED;
        playerActiveRoom[room.playerA] = 0;
        playerActiveRoom[room.playerB] = 0;

        // 0 = Heads, 1 = Tails
        uint8 outcome = uint8(randomWords[0] % 2);
        address winner = (room.choiceA == outcome) ? room.playerA : room.playerB;
        address loser = (winner == room.playerA) ? room.playerB : room.playerA;
        room.winner = winner;

        uint256 totalPot = room.betAmount * 2;
        uint256 rake = (totalPot * rakeBps) / 10_000;
        uint256 payout = totalPot - rake;

        // Safe payouts with pull-payment fallback
        (bool successWinner, ) = payable(winner).call{value: payout}("");
        if (!successWinner) {
            pendingWithdrawals[winner] += payout;
        }

        (bool successRake, ) = payable(treasury).call{value: rake}("");
        if (!successRake) {
            pendingWithdrawals[treasury] += rake;
        }

        emit RoomSettled(roomId, winner, loser, payout, rake, outcome);
    }

    // --- Admin Configuration ---

    function setRakeBps(uint256 newRakeBps) external onlyOwner {
        if (newRakeBps > MAX_RAKE_BPS) revert InvalidRakeBps();
        emit RakeBpsUpdated(rakeBps, newRakeBps);
        rakeBps = newRakeBps;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setMinMaxBet(uint256 newMinBet, uint256 newMaxBet) external onlyOwner {
        require(newMinBet > 0 && newMinBet <= newMaxBet, "Invalid bounds");
        minBet = newMinBet;
        maxBet = newMaxBet;
        emit MinMaxBetUpdated(newMinBet, newMaxBet);
    }

    function setPaused(bool isPaused) external onlyOwner {
        paused = isPaused;
        emit ArenaPauseUpdated(isPaused);
    }
}

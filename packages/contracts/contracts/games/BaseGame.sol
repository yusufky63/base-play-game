// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GameVault} from "../core/GameVault.sol";
import {VRFConsumer} from "../core/VRFConsumer.sol";

abstract contract BaseGame is VRFConsumer, ReentrancyGuard {
    GameVault public immutable vault;

    uint256 public constant VRF_TIMEOUT_BLOCKS = 60;
    uint256 public constant MAX_BETS_PER_BLOCK = 3;

    struct Round {
        address player;
        uint256 betAmount;
        uint256 reservedPayout;
        uint256 requestId;
        bytes gameParams;
        bool settled;
        uint256 blockNumber;
    }

    mapping(uint256 => Round) public rounds;
    mapping(address => uint256) public activeRound;
    mapping(address => mapping(uint256 => uint256)) private betsInBlock;

    bool public gamePaused;

    event BetPlaced(address indexed player, uint256 indexed requestId, uint256 betAmount, bytes params);
    event RoundSettled(
        address indexed player,
        uint256 indexed requestId,
        uint256 betAmount,
        uint256 payout,
        bool won
    );
    event BetRefundClaimed(address indexed player, uint256 indexed requestId, uint256 betAmount);
    event GamePauseUpdated(bool paused);

    error GamePaused();
    error ActiveRoundExists(uint256 requestId);
    error NoActiveRound();
    error RoundAlreadySettled(uint256 requestId);
    error RefundTooEarly(uint256 currentBlock, uint256 eligibleBlock);
    error RateLimitExceeded();

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) VRFConsumer(coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {
        vault = GameVault(payable(vault_));
    }

    function placeBet(bytes calldata params) external payable nonReentrant returns (uint256 requestId) {
        if (gamePaused) revert GamePaused();
        if (activeRound[msg.sender] != 0) revert ActiveRoundExists(activeRound[msg.sender]);

        uint256 blockBetCount = betsInBlock[msg.sender][block.number] + 1;
        if (blockBetCount > MAX_BETS_PER_BLOCK) revert RateLimitExceeded();
        betsInBlock[msg.sender][block.number] = blockBetCount;

        uint256 maxGrossPayout = _maxGrossPayout(params, msg.value);
        uint256 maxNetPayout = _netPayout(maxGrossPayout);
        vault.lockFunds{value: msg.value}(msg.sender, msg.value, maxNetPayout);

        requestId = _requestRandomness();
        rounds[requestId] = Round({
            player: msg.sender,
            betAmount: msg.value,
            reservedPayout: maxNetPayout,
            requestId: requestId,
            gameParams: params,
            settled: false,
            blockNumber: block.number
        });
        activeRound[msg.sender] = requestId;

        _onBetPlaced(requestId, params);
        emit BetPlaced(msg.sender, requestId, msg.value, params);
    }

    function claimRefund() external nonReentrant {
        uint256 requestId = activeRound[msg.sender];
        if (requestId == 0) revert NoActiveRound();

        Round storage round = rounds[requestId];
        if (round.settled) revert RoundAlreadySettled(requestId);

        uint256 eligibleBlock = round.blockNumber + VRF_TIMEOUT_BLOCKS;
        if (block.number <= eligibleBlock) revert RefundTooEarly(block.number, eligibleBlock);

        round.settled = true;
        activeRound[msg.sender] = 0;
        vault.refundBet(msg.sender, round.betAmount, round.reservedPayout);
        emit BetRefundClaimed(msg.sender, requestId, round.betAmount);
    }

    function setGamePaused(bool paused) external onlyOwner {
        gamePaused = paused;
        emit GamePauseUpdated(paused);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        Round storage round = rounds[requestId];
        if (round.player == address(0) || round.settled) return;

        round.settled = true;
        activeRound[round.player] = 0;

        uint256 grossPayout = _processResult(requestId, randomWords[0]);
        bool won = grossPayout > 0;

        if (won) {
            vault.payout(round.player, round.betAmount, grossPayout, round.reservedPayout);
        } else {
            vault.settleLoss(round.player, round.betAmount, round.reservedPayout);
        }

        emit RoundSettled(round.player, requestId, round.betAmount, grossPayout, won);
    }

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal virtual;

    function _processResult(uint256 requestId, uint256 randomWord) internal virtual returns (uint256);

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal virtual returns (uint256);

    function _netPayout(uint256 grossPayout) internal view returns (uint256) {
        uint256 fee = (grossPayout * vault.houseEdgeBps()) / 10_000;
        return grossPayout - fee;
    }
}

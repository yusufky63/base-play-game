// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract LimboGame is BaseGame {
    uint256 public constant SCALE = 1_000_000;
    uint256 public constant MIN_TARGET_BPS = 11000; // 1.10x
    uint256 public constant MAX_TARGET_BPS = 200_000; // 20x

    struct LimboRound {
        uint256 targetBps;
        uint256 roll;
    }

    mapping(uint256 => LimboRound) public limboRounds;

    event LimboResult(uint256 indexed requestId, uint256 targetBps, uint256 roll, uint256 threshold, bool won);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint256 targetBps = abi.decode(params, (uint256));
        _validate(targetBps);
        limboRounds[requestId].targetBps = targetBps;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        LimboRound storage round = limboRounds[requestId];
        uint256 roll = randomWord % SCALE;
        uint256 threshold = (SCALE * 10_000) / round.targetBps;
        bool won = roll < threshold;
        round.roll = roll;

        emit LimboResult(requestId, round.targetBps, roll, threshold, won);
        return won ? (rounds[requestId].betAmount * round.targetBps) / 10_000 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint256 targetBps = abi.decode(params, (uint256));
        _validate(targetBps);
        return (betAmount * targetBps) / 10_000;
    }

    function _validate(uint256 targetBps) internal pure {
        require(targetBps >= MIN_TARGET_BPS && targetBps <= MAX_TARGET_BPS, "Target multiplier out of range");
    }
}

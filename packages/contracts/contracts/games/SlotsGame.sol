// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract SlotsGame is BaseGame {
    uint8 public constant REEL_COUNT = 3;
    uint8 public constant SYMBOL_COUNT = 6;

    uint256 public constant PAIR_MULTIPLIER_BPS = 14_500; // 1.45x
    uint256 public constant TRIPLE_MULTIPLIER_BPS = 120_000; // 12x
    uint256 public constant JACKPOT_MULTIPLIER_BPS = 250_000; // 25x

    event SlotsResult(
        uint256 indexed requestId,
        uint8 reelA,
        uint8 reelB,
        uint8 reelC,
        uint256 multiplierBps,
        bool won
    );

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256, bytes calldata params) internal pure override {
        require(params.length == 0, "No params");
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 reelA = uint8(randomWord % SYMBOL_COUNT);
        uint8 reelB = uint8((randomWord / SYMBOL_COUNT) % SYMBOL_COUNT);
        uint8 reelC = uint8((randomWord / (SYMBOL_COUNT * SYMBOL_COUNT)) % SYMBOL_COUNT);
        uint256 multiplierBps = _multiplierBps(reelA, reelB, reelC);
        bool won = multiplierBps > 0;

        emit SlotsResult(requestId, reelA, reelB, reelC, multiplierBps, won);
        return (rounds[requestId].betAmount * multiplierBps) / 10_000;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        require(params.length == 0, "No params");
        return (betAmount * JACKPOT_MULTIPLIER_BPS) / 10_000;
    }

    function _multiplierBps(uint8 reelA, uint8 reelB, uint8 reelC) internal pure returns (uint256) {
        if (reelA == reelB && reelB == reelC) {
            return reelA == 0 ? JACKPOT_MULTIPLIER_BPS : TRIPLE_MULTIPLIER_BPS;
        }

        if (reelA == reelB || reelA == reelC || reelB == reelC) {
            return PAIR_MULTIPLIER_BPS;
        }

        return 0;
    }
}

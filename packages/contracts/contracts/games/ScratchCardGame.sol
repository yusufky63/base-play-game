// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract ScratchCardGame is BaseGame {
    uint16 public constant OUTCOME_SCALE = 1000;

    event ScratchCardResult(uint256 indexed requestId, uint16 roll, uint8 tier, uint256 multiplierBps, bool won);

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
        uint16 roll = uint16(randomWord % OUTCOME_SCALE);
        (uint8 tier, uint256 multiplierBps) = _tierForRoll(roll);
        bool won = multiplierBps > 0;

        emit ScratchCardResult(requestId, roll, tier, multiplierBps, won);
        return (rounds[requestId].betAmount * multiplierBps) / 10_000;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        require(params.length == 0, "No params");
        return (betAmount * 300_000) / 10_000;
    }

    function _tierForRoll(uint16 roll) internal pure returns (uint8 tier, uint256 multiplierBps) {
        if (roll < 1) return (4, 300_000); // 0.1% at 30x
        if (roll < 13) return (3, 100_000); // 1.2% at 10x
        if (roll < 113) return (2, 40_000); // 10.0% at 4x
        if (roll < 338) return (1, 20_000); // 22.5% at 2x
        return (0, 0);
    }
}

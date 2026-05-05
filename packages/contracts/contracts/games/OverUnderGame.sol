// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract OverUnderGame is BaseGame {
    uint256 public constant MAX_MULTIPLIER_BPS = 200_000; // 20x

    struct OverUnderRound {
        uint8 choice;
        uint8 target;
        uint8 rolled;
    }

    mapping(uint256 => OverUnderRound) public overUnderRounds;

    event OverUnderResult(uint256 indexed requestId, uint8 choice, uint8 target, uint8 rolled, bool won, uint256 multiplierBps);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        (uint8 choice, uint8 target) = abi.decode(params, (uint8, uint8));
        _validate(choice, target);
        overUnderRounds[requestId].choice = choice;
        overUnderRounds[requestId].target = target;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        OverUnderRound storage round = overUnderRounds[requestId];
        uint8 rolled = uint8((randomWord % 100) + 1);
        round.rolled = rolled;

        bool won = round.choice == 0 ? rolled < round.target : rolled > round.target;
        uint256 multiplierBps = _multiplierBps(round.choice, round.target);

        emit OverUnderResult(requestId, round.choice, round.target, rolled, won, multiplierBps);
        return won ? (rounds[requestId].betAmount * multiplierBps) / 10_000 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        (uint8 choice, uint8 target) = abi.decode(params, (uint8, uint8));
        _validate(choice, target);
        return (betAmount * _multiplierBps(choice, target)) / 10_000;
    }

    function _validate(uint8 choice, uint8 target) internal pure {
        require(choice <= 1, "Choice must be under or over");
        require(target >= 6 && target <= 95, "Target out of range");
        uint8 winNumbers = choice == 0 ? target - 1 : 100 - target;
        require(winNumbers >= 5, "Odds too extreme");
    }

    function _multiplierBps(uint8 choice, uint8 target) internal pure returns (uint256) {
        uint8 winNumbers = choice == 0 ? target - 1 : 100 - target;
        uint256 multiplierBps = (100 * 10_000) / winNumbers;
        return multiplierBps > MAX_MULTIPLIER_BPS ? MAX_MULTIPLIER_BPS : multiplierBps;
    }
}

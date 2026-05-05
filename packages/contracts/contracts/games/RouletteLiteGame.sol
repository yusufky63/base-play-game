// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract RouletteLiteGame is BaseGame {
    uint8 public constant SLOT_COUNT = 12;

    // 0 = exact number, 1 = color, 2 = range
    mapping(uint256 => uint8) public betTypeByRequest;
    mapping(uint256 => uint8) public choiceByRequest;

    event RouletteLiteResult(
        uint256 indexed requestId,
        uint8 betType,
        uint8 choice,
        uint8 result,
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

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        (uint8 betType, uint8 choice) = abi.decode(params, (uint8, uint8));
        _validateBet(betType, choice);
        betTypeByRequest[requestId] = betType;
        choiceByRequest[requestId] = choice;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 result = uint8(randomWord % SLOT_COUNT);
        uint8 betType = betTypeByRequest[requestId];
        uint8 choice = choiceByRequest[requestId];
        bool won = _isWinningBet(betType, choice, result);
        uint256 multiplierBps = won ? _multiplierBps(betType) : 0;

        emit RouletteLiteResult(requestId, betType, choice, result, multiplierBps, won);
        return (rounds[requestId].betAmount * multiplierBps) / 10_000;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        (uint8 betType, uint8 choice) = abi.decode(params, (uint8, uint8));
        _validateBet(betType, choice);
        return (betAmount * _multiplierBps(betType)) / 10_000;
    }

    function _validateBet(uint8 betType, uint8 choice) internal pure {
        require(betType <= 2, "Invalid bet type");
        if (betType == 0) {
            require(choice < SLOT_COUNT, "Invalid number");
        } else {
            require(choice <= 1, "Invalid choice");
        }
    }

    function _isWinningBet(uint8 betType, uint8 choice, uint8 result) internal pure returns (bool) {
        if (betType == 0) return result == choice;
        if (betType == 1) return result % 2 == choice;
        return (choice == 0 && result < 6) || (choice == 1 && result >= 6);
    }

    function _multiplierBps(uint8 betType) internal pure returns (uint256) {
        return betType == 0 ? 120_000 : 20_000;
    }
}

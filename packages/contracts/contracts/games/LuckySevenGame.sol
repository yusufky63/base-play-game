// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract LuckySevenGame is BaseGame {
    mapping(uint256 => uint8) public playerChoice;

    event LuckySevenResult(uint256 indexed requestId, uint8 choice, uint8 dieA, uint8 dieB, uint8 total, uint256 multiplierBps, bool won);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 choice = abi.decode(params, (uint8));
        require(choice <= 2, "Invalid choice");
        playerChoice[requestId] = choice;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 dieA = uint8((randomWord % 6) + 1);
        uint8 dieB = uint8(((randomWord / 6) % 6) + 1);
        uint8 total = dieA + dieB;
        uint8 choice = playerChoice[requestId];
        bool won = choice == 0 ? total < 7 : choice == 1 ? total == 7 : total > 7;
        uint256 multiplierBps = _multiplierBps(choice);

        emit LuckySevenResult(requestId, choice, dieA, dieB, total, multiplierBps, won);
        return won ? (rounds[requestId].betAmount * multiplierBps) / 10_000 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 choice = abi.decode(params, (uint8));
        require(choice <= 2, "Invalid choice");
        return (betAmount * _multiplierBps(choice)) / 10_000;
    }

    function _multiplierBps(uint8 choice) internal pure returns (uint256) {
        return choice == 1 ? 60_000 : 24_000;
    }
}

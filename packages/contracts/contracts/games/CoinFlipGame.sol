// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract CoinFlipGame is BaseGame {
    mapping(uint256 => uint8) public playerChoice;

    event CoinFlipResult(uint256 indexed requestId, uint8 playerChoice, uint8 result, bool won);

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
        require(choice == 0 || choice == 1, "Choice must be 0 or 1");
        playerChoice[requestId] = choice;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 result = uint8(randomWord % 2);
        bool won = playerChoice[requestId] == result;

        emit CoinFlipResult(requestId, playerChoice[requestId], result, won);
        return won ? rounds[requestId].betAmount * 2 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 choice = abi.decode(params, (uint8));
        require(choice == 0 || choice == 1, "Choice must be 0 or 1");
        return betAmount * 2;
    }
}

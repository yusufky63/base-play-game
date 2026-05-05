// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract DiceGame is BaseGame {
    mapping(uint256 => uint8) public playerGuess;

    event DiceResult(uint256 indexed requestId, uint8 playerGuess, uint8 rolled, bool won);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 guess = abi.decode(params, (uint8));
        require(guess >= 1 && guess <= 6, "Guess must be between 1 and 6");
        playerGuess[requestId] = guess;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 rolled = uint8((randomWord % 6) + 1);
        bool won = playerGuess[requestId] == rolled;

        emit DiceResult(requestId, playerGuess[requestId], rolled, won);
        return won ? rounds[requestId].betAmount * 6 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 guess = abi.decode(params, (uint8));
        require(guess >= 1 && guess <= 6, "Guess must be between 1 and 6");
        return betAmount * 6;
    }
}

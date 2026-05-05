// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract ColorPickGame is BaseGame {
    uint8 public constant COLOR_COUNT = 4;

    mapping(uint256 => uint8) public playerColor;

    event ColorPickResult(uint256 indexed requestId, uint8 playerColor, uint8 resultColor, bool won);

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
        require(choice < COLOR_COUNT, "Invalid color");
        playerColor[requestId] = choice;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 result = uint8(randomWord % COLOR_COUNT);
        bool won = playerColor[requestId] == result;

        emit ColorPickResult(requestId, playerColor[requestId], result, won);
        return won ? rounds[requestId].betAmount * COLOR_COUNT : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 choice = abi.decode(params, (uint8));
        require(choice < COLOR_COUNT, "Invalid color");
        return betAmount * COLOR_COUNT;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract TreasureChestGame is BaseGame {
    uint8 public constant CHEST_COUNT = 9;

    mapping(uint256 => uint8) public playerChest;

    event TreasureChestResult(uint256 indexed requestId, uint8 playerChest, uint8 winningChest, bool won);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 chest = abi.decode(params, (uint8));
        require(chest < CHEST_COUNT, "Invalid chest");
        playerChest[requestId] = chest;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 winningChest = uint8(randomWord % CHEST_COUNT);
        bool won = playerChest[requestId] == winningChest;

        emit TreasureChestResult(requestId, playerChest[requestId], winningChest, won);
        return won ? rounds[requestId].betAmount * CHEST_COUNT : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 chest = abi.decode(params, (uint8));
        require(chest < CHEST_COUNT, "Invalid chest");
        return betAmount * CHEST_COUNT;
    }
}

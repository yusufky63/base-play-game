// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract RockPaperScissorsGame is BaseGame {
    uint8 public constant MOVE_COUNT = 3;

    mapping(uint256 => uint8) public playerMove;

    event RockPaperScissorsResult(uint256 indexed requestId, uint8 playerMove, uint8 houseMove, bool won);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 move = abi.decode(params, (uint8));
        require(move < MOVE_COUNT, "Invalid move");
        playerMove[requestId] = move;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 move = playerMove[requestId];
        uint8 houseMove = uint8(randomWord % MOVE_COUNT);

        if (houseMove == move) {
            uint8 offset = uint8(((randomWord / MOVE_COUNT) % 2) + 1);
            houseMove = (move + offset) % MOVE_COUNT;
        }

        bool won = _beats(move, houseMove);
        emit RockPaperScissorsResult(requestId, move, houseMove, won);
        return won ? rounds[requestId].betAmount * 2 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 move = abi.decode(params, (uint8));
        require(move < MOVE_COUNT, "Invalid move");
        return betAmount * 2;
    }

    function _beats(uint8 move, uint8 houseMove) internal pure returns (bool) {
        return (move + 2) % MOVE_COUNT == houseMove;
    }
}

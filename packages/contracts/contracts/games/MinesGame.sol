// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract MinesGame is BaseGame {
    uint8 public constant GRID_SIZE = 25;
    uint8 public constant MAX_MINES = 24;
    uint256 public constant MAX_MULTIPLIER_BPS = 200_000; // 20x

    struct MinesRound {
        uint8 mineCount;
        uint32 revealMask;
        uint32 mineMask;
        uint8 revealedCount;
    }

    mapping(uint256 => MinesRound) public minesRounds;

    event MinesResult(
        uint256 indexed requestId,
        uint8 mineCount,
        uint32 revealMask,
        uint32 mineMask,
        uint8 revealedCount,
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
        (uint8 mineCount, uint32 revealMask) = abi.decode(params, (uint8, uint32));
        require(mineCount > 0 && mineCount <= MAX_MINES, "Invalid mine count");
        require(revealMask > 0 && revealMask < (uint32(1) << GRID_SIZE), "Invalid reveal mask");

        uint8 revealedCount = _popCount(revealMask);
        require(revealedCount <= GRID_SIZE - mineCount, "Too many reveals");
        require(_calcMultiplierBps(mineCount, revealedCount) <= MAX_MULTIPLIER_BPS, "Payout exceeds max");

        minesRounds[requestId].mineCount = mineCount;
        minesRounds[requestId].revealMask = revealMask;
        minesRounds[requestId].revealedCount = revealedCount;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        MinesRound storage round = minesRounds[requestId];
        uint32 mineMask = _placeMines(randomWord, round.mineCount);
        round.mineMask = mineMask;

        bool won = (round.revealMask & mineMask) == 0;
        emit MinesResult(requestId, round.mineCount, round.revealMask, mineMask, round.revealedCount, won);

        if (!won) return 0;

        uint256 multiplierBps = _calcMultiplierBps(round.mineCount, round.revealedCount);
        return (rounds[requestId].betAmount * multiplierBps) / 10_000;
    }

    function _placeMines(uint256 seed, uint8 count) internal pure returns (uint32 mask) {
        uint8 placed;
        uint256 nonce;

        while (placed < count) {
            uint8 position = uint8(uint256(keccak256(abi.encode(seed, nonce))) % GRID_SIZE);
            uint32 bit = uint32(1) << position;
            if (mask & bit == 0) {
                mask |= bit;
                placed++;
            }
            nonce++;
        }
    }

    function _calcMultiplierBps(uint8 mineCount, uint8 revealedCount) public pure returns (uint256) {
        uint256 safeCells = GRID_SIZE - mineCount;
        uint256 multiplierBps = 10_000;

        for (uint8 i = 0; i < revealedCount; i++) {
            multiplierBps = (multiplierBps * (GRID_SIZE - i)) / (safeCells - i);
        }

        return multiplierBps;
    }

    function _popCount(uint32 value) internal pure returns (uint8 count) {
        while (value != 0) {
            value &= value - 1;
            count++;
        }
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        (uint8 mineCount, uint32 revealMask) = abi.decode(params, (uint8, uint32));
        require(mineCount > 0 && mineCount <= MAX_MINES, "Invalid mine count");
        require(revealMask > 0 && revealMask < (uint32(1) << GRID_SIZE), "Invalid reveal mask");

        uint8 revealedCount = _popCount(revealMask);
        require(revealedCount <= GRID_SIZE - mineCount, "Too many reveals");

        uint256 multiplierBps = _calcMultiplierBps(mineCount, revealedCount);
        require(multiplierBps <= MAX_MULTIPLIER_BPS, "Payout exceeds max");
        return (betAmount * multiplierBps) / 10_000;
    }
}

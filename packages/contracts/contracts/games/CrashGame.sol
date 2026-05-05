// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract CrashGame is BaseGame {
    uint256 public constant CRASH_SCALE = 1_000_000;

    struct CrashData {
        uint256 crashPoint;
        uint256 cashoutAt;
    }

    mapping(uint256 => CrashData) public crashData;

    event CrashPointGenerated(uint256 indexed requestId, uint256 crashPoint);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint256 cashoutAt = abi.decode(params, (uint256));
        require(cashoutAt >= 101 && cashoutAt <= 1000, "Cashout must be 101-1000");
        crashData[requestId].cashoutAt = cashoutAt;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint256 h = uint256(keccak256(abi.encodePacked(randomWord, requestId)));
        uint256 crashPoint = computeCrashPoint(h);

        crashData[requestId].crashPoint = crashPoint;
        emit CrashPointGenerated(requestId, crashPoint);

        uint256 cashoutAt = crashData[requestId].cashoutAt;
        if (cashoutAt <= crashPoint) {
            return (rounds[requestId].betAmount * cashoutAt) / 100;
        }
        return 0;
    }

    function computeCrashPoint(uint256 h) public pure returns (uint256) {
        uint256 roll = h % CRASH_SCALE;
        uint256 point = (100 * CRASH_SCALE) / (CRASH_SCALE - roll);
        return point < 100 ? 100 : point;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint256 cashoutAt = abi.decode(params, (uint256));
        require(cashoutAt >= 101 && cashoutAt <= 1000, "Cashout must be 101-1000");
        return (betAmount * cashoutAt) / 100;
    }
}

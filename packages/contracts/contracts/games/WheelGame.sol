// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract WheelGame is BaseGame {
    uint8 public constant SEGMENTS = 16;

    mapping(uint256 => uint8) public wheelProfile;

    event WheelResult(uint256 indexed requestId, uint8 profile, uint8 segment, uint256 multiplierBps, bool won);

    constructor(
        address vault_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) BaseGame(vault_, coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 profile = abi.decode(params, (uint8));
        require(profile <= 2, "Invalid profile");
        wheelProfile[requestId] = profile;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 segment = uint8(randomWord % SEGMENTS);
        uint8 profile = wheelProfile[requestId];
        uint256 multiplierBps = _segmentMultiplierBps(profile, segment);
        bool won = multiplierBps > 0;

        emit WheelResult(requestId, profile, segment, multiplierBps, won);
        return (rounds[requestId].betAmount * multiplierBps) / 10_000;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 profile = abi.decode(params, (uint8));
        require(profile <= 2, "Invalid profile");
        return (betAmount * _maxMultiplierBps(profile)) / 10_000;
    }

    function _maxMultiplierBps(uint8 profile) internal pure returns (uint256) {
        if (profile == 0) return 20_000;
        if (profile == 1) return 25_000;
        return 80_000;
    }

    function _segmentMultiplierBps(uint8 profile, uint8 segment) public pure returns (uint256) {
        if (profile == 0) {
            if (segment < 4) return 0;
            if (segment < 10) return 10_000;
            if (segment < 14) return 15_000;
            return 20_000;
        }

        if (profile == 1) {
            if (segment < 8) return 0;
            if (segment < 12) return 15_000;
            return 25_000;
        }

        if (segment < 12) return 0;
        if (segment < 14) return 20_000;
        if (segment == 14) return 40_000;
        return 80_000;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract PlinkoLiteGame is BaseGame {
    uint8 public constant ROWS = 8;

    mapping(uint256 => uint8) public plinkoProfile;

    event PlinkoLiteResult(uint256 indexed requestId, uint8 profile, uint8 slot, uint16 pathBits, uint256 multiplierBps, bool won);

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
        plinkoProfile[requestId] = profile;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint16 pathBits = uint16(randomWord & 0xff);
        uint8 slot = _slotFromPath(pathBits);
        uint8 profile = plinkoProfile[requestId];
        uint256 multiplierBps = _slotMultiplierBps(profile, slot);
        bool won = multiplierBps > 0;

        emit PlinkoLiteResult(requestId, profile, slot, pathBits, multiplierBps, won);
        return (rounds[requestId].betAmount * multiplierBps) / 10_000;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        uint8 profile = abi.decode(params, (uint8));
        require(profile <= 2, "Invalid profile");
        return (betAmount * _maxMultiplierBps(profile)) / 10_000;
    }

    function _slotFromPath(uint16 pathBits) internal pure returns (uint8 slot) {
        for (uint8 i = 0; i < ROWS; i++) {
            if ((pathBits & (uint16(1) << i)) != 0) slot++;
        }
    }

    function _maxMultiplierBps(uint8 profile) internal pure returns (uint256) {
        if (profile == 0) return 50_000;
        if (profile == 1) return 200_000;
        return 250_000;
    }

    function _slotMultiplierBps(uint8 profile, uint8 slot) public pure returns (uint256) {
        require(slot <= ROWS, "Invalid slot");

        if (profile == 0) {
            uint16[9] memory table = [uint16(50_000), 18_000, 12_000, 9_000, 7_000, 9_000, 12_000, 18_000, 50_000];
            return table[slot];
        }

        if (profile == 1) {
            uint32[9] memory table = [uint32(200_000), 40_000, 12_300, 6_300, 2_300, 6_300, 12_300, 40_000, 200_000];
            return table[slot];
        }

        uint32[9] memory highTable = [uint32(250_000), 50_000, 13_000, 5_000, 0, 5_000, 13_000, 50_000, 250_000];
        return highTable[slot];
    }
}

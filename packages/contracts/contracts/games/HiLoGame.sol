// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseGame} from "./BaseGame.sol";

contract HiLoGame is BaseGame {
    uint256 public constant MAX_MULTIPLIER_BPS = 80_000; // 8x

    struct HiLoRound {
        uint8 choice;
        uint8 currentCard;
        uint8 nextCard;
    }

    mapping(uint256 => HiLoRound) public hiloRounds;

    event HiLoResult(
        uint256 indexed requestId,
        uint8 choice,
        uint8 currentCard,
        uint8 nextCard,
        bool won,
        uint256 multiplierBps
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
        (uint8 choice, uint8 currentCard) = abi.decode(params, (uint8, uint8));
        require(choice <= 1, "Choice must be lower or higher");
        require(currentCard >= 1 && currentCard <= 13, "Card must be 1-13");
        require(choice == 0 ? currentCard > 1 : currentCard < 13, "Choice has no winning card");
        require(_winCards(choice, currentCard) >= 2, "Payout exceeds max");
        hiloRounds[requestId].choice = choice;
        hiloRounds[requestId].currentCard = currentCard;
    }

    function _processResult(uint256 requestId, uint256 randomWord) internal override returns (uint256) {
        uint8 nextCard = uint8((randomWord % 13) + 1);
        HiLoRound storage round = hiloRounds[requestId];
        round.nextCard = nextCard;

        bool higher = round.choice == 1;
        bool won = higher ? nextCard > round.currentCard : nextCard < round.currentCard;
        uint8 winCards = _winCards(round.choice, round.currentCard);
        uint256 multiplierBps = won && winCards > 0 ? (13 * 10_000) / winCards : 0;
        if (multiplierBps > MAX_MULTIPLIER_BPS) multiplierBps = MAX_MULTIPLIER_BPS;

        emit HiLoResult(requestId, round.choice, round.currentCard, nextCard, won, multiplierBps);
        return won ? (rounds[requestId].betAmount * multiplierBps) / 10_000 : 0;
    }

    function _maxGrossPayout(bytes calldata params, uint256 betAmount) internal pure override returns (uint256) {
        (uint8 choice, uint8 currentCard) = abi.decode(params, (uint8, uint8));
        require(choice <= 1, "Choice must be lower or higher");
        require(currentCard >= 1 && currentCard <= 13, "Card must be 1-13");
        require(choice == 0 ? currentCard > 1 : currentCard < 13, "Choice has no winning card");
        uint8 winCards = _winCards(choice, currentCard);
        require(winCards >= 2, "Payout exceeds max");
        uint256 multiplierBps = (13 * 10_000) / winCards;
        if (multiplierBps > MAX_MULTIPLIER_BPS) multiplierBps = MAX_MULTIPLIER_BPS;
        return (betAmount * multiplierBps) / 10_000;
    }

    function _winCards(uint8 choice, uint8 currentCard) internal pure returns (uint8) {
        return choice == 1 ? 13 - currentCard : currentCard - 1;
    }
}

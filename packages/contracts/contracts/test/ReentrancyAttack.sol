// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IGame {
    function claimRefund() external;
}

contract ReentrancyAttack {
    IGame public game;
    bool public attackOnReceive;

    constructor(address game_) {
        game = IGame(game_);
    }

    receive() external payable {
        if (attackOnReceive) {
            game.claimRefund();
        }
    }

    function setAttackOnReceive(bool enabled) external {
        attackOnReceive = enabled;
    }
}

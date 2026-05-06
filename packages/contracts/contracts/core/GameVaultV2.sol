// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GameVaultV2 is Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant MIN_BET_FLOOR = 0.00001 ether;
    uint256 public constant MAX_BET_CEIL = 0.01 ether;
    uint256 public constant MAX_EDGE_BPS = 500;
    uint256 public constant LIQUIDITY_MULT = 50;

    uint256 public minBet = 0.0002 ether;
    uint256 public maxBet = 0.001 ether;
    uint256 public houseEdgeBps = 300;

    mapping(address => bool) public approvedGames;
    mapping(address => uint256) public lockedFunds;
    mapping(address => uint256) public reservedPayouts;
    uint256 public totalReservedPayout;

    event GameApproved(address indexed game);
    event GameRevoked(address indexed game);
    event FundsLocked(address indexed player, uint256 amount);
    event BetLost(address indexed player, uint256 amount);
    event PayoutSent(address indexed player, uint256 betAmount, uint256 net, uint256 fee);
    event BetRefunded(address indexed player, uint256 amount);
    event MinBetUpdated(uint256 oldValue, uint256 newValue);
    event MaxBetUpdated(uint256 oldValue, uint256 newValue);
    event HouseEdgeUpdated(uint256 oldValue, uint256 newValue);
    event VaultFunded(address indexed sender, uint256 amount);
    event VaultWithdraw(address indexed owner, uint256 amount);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    error InvalidBetAmount(uint256 amount, uint256 min, uint256 max);
    error InsufficientLiquidity(uint256 required, uint256 available);
    error NotApprovedGame(address caller);
    error InsufficientLockedFunds(address player, uint256 required, uint256 available);
    error InsufficientReservedPayout(address player, uint256 required, uint256 available);
    error TransferFailed(address recipient, uint256 amount);
    error InvalidConfiguration();
    error ExceedsMaxBetCeiling(uint256 value);
    error ActivePayoutsReserved(uint256 reserved);
    error InvalidAmount();

    modifier onlyApprovedGame() {
        if (!approvedGames[msg.sender]) revert NotApprovedGame(msg.sender);
        _;
    }

    constructor() Ownable(msg.sender) {}

    receive() external payable {
        emit VaultFunded(msg.sender, msg.value);
    }

    function fund() external payable {
        if (msg.value == 0) revert InvalidAmount();
        emit VaultFunded(msg.sender, msg.value);
    }

    function approveGame(address game) external onlyOwner {
        require(game != address(0), "Zero address");
        require(game.code.length > 0, "Not a contract");
        approvedGames[game] = true;
        emit GameApproved(game);
    }

    function revokeGame(address game) external onlyOwner {
        approvedGames[game] = false;
        emit GameRevoked(game);
    }

    function lockFunds(address player, uint256 amount, uint256 maxNetPayout)
        external
        payable
        onlyApprovedGame
        whenNotPaused
        nonReentrant
    {
        if (msg.value != amount) revert InvalidBetAmount(msg.value, amount, amount);
        if (amount < minBet || amount > maxBet) revert InvalidBetAmount(amount, minBet, maxBet);
        _checkLiquidity(maxNetPayout);

        lockedFunds[player] += amount;
        reservedPayouts[player] += maxNetPayout;
        totalReservedPayout += maxNetPayout;
        emit FundsLocked(player, amount);
    }

    function payout(address player, uint256 betAmount, uint256 grossAmount, uint256 reservedAmount)
        external
        onlyApprovedGame
        nonReentrant
    {
        _decreaseLocked(player, betAmount);
        _decreaseReserved(player, reservedAmount);

        uint256 fee = (grossAmount * houseEdgeBps) / 10_000;
        uint256 net = grossAmount - fee;

        (bool ok,) = payable(player).call{value: net}("");
        if (!ok) revert TransferFailed(player, net);

        emit PayoutSent(player, betAmount, net, fee);
    }

    function settleLoss(address player, uint256 betAmount, uint256 reservedAmount) external onlyApprovedGame nonReentrant {
        _decreaseLocked(player, betAmount);
        _decreaseReserved(player, reservedAmount);
        emit BetLost(player, betAmount);
    }

    function refundBet(address player, uint256 amount, uint256 reservedAmount) external onlyApprovedGame nonReentrant {
        _decreaseLocked(player, amount);
        _decreaseReserved(player, reservedAmount);

        (bool ok,) = payable(player).call{value: amount}("");
        if (!ok) revert TransferFailed(player, amount);

        emit BetRefunded(player, amount);
    }

    function setMinBet(uint256 newMin) external onlyOwner {
        if (newMin < MIN_BET_FLOOR || newMin >= maxBet) revert InvalidConfiguration();
        emit MinBetUpdated(minBet, newMin);
        minBet = newMin;
    }

    function setMaxBet(uint256 newMax) external onlyOwner {
        if (newMax > MAX_BET_CEIL) revert ExceedsMaxBetCeiling(newMax);
        if (newMax <= minBet) revert InvalidConfiguration();
        emit MaxBetUpdated(maxBet, newMax);
        maxBet = newMax;
    }

    function setHouseEdge(uint256 newBps) external onlyOwner {
        if (newBps > MAX_EDGE_BPS) revert InvalidConfiguration();
        if (totalReservedPayout != 0) revert ActivePayoutsReserved(totalReservedPayout);
        emit HouseEdgeUpdated(houseEdgeBps, newBps);
        houseEdgeBps = newBps;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant whenPaused {
        if (amount == 0) revert InvalidAmount();
        uint256 available = _availableLiquidity();
        if (amount > available) revert InsufficientLiquidity(amount, available);

        (bool ok,) = payable(owner()).call{value: amount}("");
        if (!ok) revert TransferFailed(owner(), amount);
        emit VaultWithdraw(owner(), amount);
    }

    function emergencyWithdraw() external onlyOwner nonReentrant whenPaused {
        if (totalReservedPayout != 0) revert ActivePayoutsReserved(totalReservedPayout);
        uint256 balance = address(this).balance;
        (bool ok,) = payable(owner()).call{value: balance}("");
        if (!ok) revert TransferFailed(owner(), balance);
        emit EmergencyWithdraw(owner(), balance);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function canAcceptBet(uint256 amount) external view returns (bool) {
        return !paused() && amount >= minBet && amount <= maxBet && _availableLiquidity() >= amount * LIQUIDITY_MULT;
    }

    function _checkLiquidity(uint256 requiredPayoutReserve) internal view {
        uint256 available = _availableLiquidity();
        if (available < requiredPayoutReserve) revert InsufficientLiquidity(requiredPayoutReserve, available);
    }

    function availableLiquidity() external view returns (uint256) {
        return _availableLiquidity();
    }

    function _availableLiquidity() internal view returns (uint256) {
        uint256 balance = address(this).balance;
        if (balance <= totalReservedPayout) return 0;
        return balance - totalReservedPayout;
    }

    function _decreaseLocked(address player, uint256 amount) internal {
        uint256 current = lockedFunds[player];
        if (current < amount) revert InsufficientLockedFunds(player, amount, current);
        lockedFunds[player] = current - amount;
    }

    function _decreaseReserved(address player, uint256 amount) internal {
        uint256 current = reservedPayouts[player];
        if (current < amount) revert InsufficientReservedPayout(player, amount, current);
        reservedPayouts[player] = current - amount;
        totalReservedPayout -= amount;
    }
}

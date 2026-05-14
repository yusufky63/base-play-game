// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VRFConsumer} from "../core/VRFConsumer.sol";

interface IBasePlayRoundReader {
    function rounds(uint256 requestId)
        external
        view
        returns (
            address player,
            uint256 betAmount,
            uint256 reservedPayout,
            uint256 storedRequestId,
            bytes memory gameParams,
            bool settled,
            uint256 blockNumber
        );
}

contract LuckyDraw is VRFConsumer, Pausable, ReentrancyGuard {
    uint256 public constant MAX_PRIZES = 12;
    uint256 public constant MAX_ROUNDS_REQUIRED = 50;
    uint256 public constant MAX_PRIZE_AMOUNT = 0.02 ether;
    uint256 public constant DRAW_TIMEOUT_BLOCKS = 120;

    struct Prize {
        uint96 amount;
        uint32 weight;
    }

    struct RoundProof {
        address game;
        uint256 requestId;
    }

    struct Draw {
        address player;
        uint256 requestId;
        uint256 requestedBlock;
        uint256 maxPrizeAmount;
        uint256 totalWeight;
        uint256 prizeAmount;
        uint16 prizeIndex;
        bool settled;
        bool claimed;
        bool cancelled;
    }

    Prize[] private prizeTable;
    uint256 public totalWeight;
    uint256 public roundsRequired = 10;
    uint256 public minEligibleBet;
    uint256 public totalPendingReserve;
    uint256 public totalClaimablePrizes;

    mapping(address => bool) public approvedGames;
    mapping(bytes32 => bool) public consumedRounds;
    mapping(uint256 => Draw) public draws;
    mapping(uint256 => bytes32[]) private drawRoundKeys;
    mapping(uint256 => Prize[]) private drawPrizeTables;
    mapping(address => uint256) public activeDraw;

    event GameApprovalUpdated(address indexed game, bool approved);
    event PrizeTableUpdated(uint256 totalWeight);
    event DrawConfigUpdated(uint256 roundsRequired, uint256 minEligibleBet);
    event DrawRequested(address indexed player, uint256 indexed requestId, uint256 maxPrizeAmount);
    event DrawResolved(address indexed player, uint256 indexed requestId, uint16 prizeIndex, uint256 prizeAmount, uint256 randomWord);
    event PrizeClaimed(address indexed player, uint256 indexed requestId, uint256 amount);
    event DrawCancelled(address indexed player, uint256 indexed requestId);
    event DrawPauseUpdated(bool paused);
    event Funded(address indexed sender, uint256 amount);
    event AvailableWithdrawn(address indexed owner, uint256 amount);

    error InvalidConfiguration();
    error InvalidGame(address game);
    error InvalidProofCount(uint256 provided, uint256 required);
    error InvalidRound(address game, uint256 requestId);
    error RoundAlreadyConsumed(address game, uint256 requestId);
    error ActiveDrawExists(uint256 requestId);
    error UnknownDraw(uint256 requestId);
    error DrawNotSettled(uint256 requestId);
    error DrawAlreadyClaimed(uint256 requestId);
    error DrawAlreadySettled(uint256 requestId);
    error DrawNotExpired(uint256 currentBlock, uint256 eligibleBlock);
    error NotDrawPlayer(address caller, address player);
    error InsufficientDrawLiquidity(uint256 required, uint256 available);
    error TransferFailed(address recipient, uint256 amount);
    error InvalidAmount();

    constructor(
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) VRFConsumer(coordinator_, keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_) {
        Prize[] memory defaults = new Prize[](6);
        defaults[0] = Prize({amount: 43_478_260_869_565, weight: 62_000});
        defaults[1] = Prize({amount: 217_391_304_347_826, weight: 25_000});
        defaults[2] = Prize({amount: 434_782_608_695_652, weight: 9_000});
        defaults[3] = Prize({amount: 1_086_956_521_739_130, weight: 3_000});
        defaults[4] = Prize({amount: 2_173_913_043_478_261, weight: 800});
        defaults[5] = Prize({amount: 4_347_826_086_956_522, weight: 200});
        _setPrizeTable(defaults);
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function fund() external payable {
        if (msg.value == 0) revert InvalidAmount();
        emit Funded(msg.sender, msg.value);
    }

    function requestDraw(RoundProof[] calldata proofs) external whenNotPaused nonReentrant returns (uint256 requestId) {
        if (activeDraw[msg.sender] != 0) revert ActiveDrawExists(activeDraw[msg.sender]);
        if (proofs.length != roundsRequired) revert InvalidProofCount(proofs.length, roundsRequired);

        uint256 maxPrize = maxPrizeAmount();
        uint256 available = availableLiquidity();
        if (available < maxPrize) revert InsufficientDrawLiquidity(maxPrize, available);

        requestId = _requestRandomness();
        Draw storage draw = draws[requestId];
        draw.player = msg.sender;
        draw.requestId = requestId;
        draw.requestedBlock = block.number;
        draw.maxPrizeAmount = maxPrize;
        draw.totalWeight = totalWeight;

        for (uint256 i = 0; i < prizeTable.length; i++) {
            drawPrizeTables[requestId].push(prizeTable[i]);
        }

        for (uint256 i = 0; i < proofs.length; i++) {
            bytes32 key = _validateAndConsumeProof(msg.sender, proofs[i]);
            drawRoundKeys[requestId].push(key);
        }

        activeDraw[msg.sender] = requestId;
        totalPendingReserve += maxPrize;
        emit DrawRequested(msg.sender, requestId, maxPrize);
    }

    function claimPrize(uint256 requestId) external nonReentrant {
        Draw storage draw = draws[requestId];
        if (draw.player == address(0)) revert UnknownDraw(requestId);
        if (draw.player != msg.sender) revert NotDrawPlayer(msg.sender, draw.player);
        if (!draw.settled) revert DrawNotSettled(requestId);
        if (draw.claimed) revert DrawAlreadyClaimed(requestId);

        uint256 amount = draw.prizeAmount;
        draw.claimed = true;
        if (amount > 0) {
            totalClaimablePrizes -= amount;
            (bool ok,) = payable(msg.sender).call{value: amount}("");
            if (!ok) revert TransferFailed(msg.sender, amount);
        }
        emit PrizeClaimed(msg.sender, requestId, amount);
    }

    function cancelExpiredDraw(uint256 requestId) external nonReentrant {
        Draw storage draw = draws[requestId];
        if (draw.player == address(0)) revert UnknownDraw(requestId);
        if (draw.settled) revert DrawAlreadySettled(requestId);
        if (msg.sender != draw.player && msg.sender != owner()) revert NotDrawPlayer(msg.sender, draw.player);

        uint256 eligibleBlock = draw.requestedBlock + DRAW_TIMEOUT_BLOCKS;
        if (block.number <= eligibleBlock) revert DrawNotExpired(block.number, eligibleBlock);

        draw.cancelled = true;
        draw.settled = true;
        activeDraw[draw.player] = 0;
        totalPendingReserve -= draw.maxPrizeAmount;

        bytes32[] storage keys = drawRoundKeys[requestId];
        for (uint256 i = 0; i < keys.length; i++) {
            consumedRounds[keys[i]] = false;
        }

        emit DrawCancelled(draw.player, requestId);
    }

    function setApprovedGame(address game, bool approved) external onlyOwner {
        if (game == address(0) || game.code.length == 0) revert InvalidGame(game);
        approvedGames[game] = approved;
        emit GameApprovalUpdated(game, approved);
    }

    function setApprovedGames(address[] calldata games, bool approved) external onlyOwner {
        for (uint256 i = 0; i < games.length; i++) {
            if (games[i] == address(0) || games[i].code.length == 0) revert InvalidGame(games[i]);
            approvedGames[games[i]] = approved;
            emit GameApprovalUpdated(games[i], approved);
        }
    }

    function setDrawConfig(uint256 newRoundsRequired, uint256 newMinEligibleBet) external onlyOwner {
        if (newRoundsRequired == 0 || newRoundsRequired > MAX_ROUNDS_REQUIRED) revert InvalidConfiguration();
        roundsRequired = newRoundsRequired;
        minEligibleBet = newMinEligibleBet;
        emit DrawConfigUpdated(newRoundsRequired, newMinEligibleBet);
    }

    function setPrizeTable(Prize[] calldata prizes) external onlyOwner {
        _setPrizeTable(prizes);
    }

    function pause() external onlyOwner {
        _pause();
        emit DrawPauseUpdated(true);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit DrawPauseUpdated(false);
    }

    function withdrawAvailable(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 available = availableLiquidity();
        if (amount > available) revert InsufficientDrawLiquidity(amount, available);

        (bool ok,) = payable(owner()).call{value: amount}("");
        if (!ok) revert TransferFailed(owner(), amount);
        emit AvailableWithdrawn(owner(), amount);
    }

    function prizeCount() external view returns (uint256) {
        return prizeTable.length;
    }

    function getPrizes() external view returns (Prize[] memory) {
        return prizeTable;
    }

    function getDrawRoundKeys(uint256 requestId) external view returns (bytes32[] memory) {
        return drawRoundKeys[requestId];
    }

    function getDrawPrizes(uint256 requestId) external view returns (Prize[] memory) {
        return drawPrizeTables[requestId];
    }

    function maxPrizeAmount() public view returns (uint256 maxAmount) {
        for (uint256 i = 0; i < prizeTable.length; i++) {
            if (prizeTable[i].amount > maxAmount) maxAmount = prizeTable[i].amount;
        }
    }

    function availableLiquidity() public view returns (uint256) {
        uint256 reserved = totalPendingReserve + totalClaimablePrizes;
        uint256 balance = address(this).balance;
        return balance > reserved ? balance - reserved : 0;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        Draw storage draw = draws[requestId];
        if (draw.player == address(0) || draw.settled) return;

        (uint16 prizeIndex, uint256 prizeAmount) = _resolvePrize(requestId, randomWords[0]);
        draw.settled = true;
        draw.prizeIndex = prizeIndex;
        draw.prizeAmount = prizeAmount;
        activeDraw[draw.player] = 0;
        totalPendingReserve -= draw.maxPrizeAmount;
        totalClaimablePrizes += prizeAmount;

        emit DrawResolved(draw.player, requestId, prizeIndex, prizeAmount, randomWords[0]);
    }

    function _validateAndConsumeProof(address player, RoundProof calldata proof) private returns (bytes32 key) {
        if (!approvedGames[proof.game]) revert InvalidGame(proof.game);
        key = keccak256(abi.encodePacked(proof.game, proof.requestId));
        if (consumedRounds[key]) revert RoundAlreadyConsumed(proof.game, proof.requestId);

        (
            address roundPlayer,
            uint256 betAmount,
            ,
            uint256 storedRequestId,
            ,
            bool settled,
            uint256 blockNumber
        ) = IBasePlayRoundReader(proof.game).rounds(proof.requestId);

        if (
            roundPlayer != player ||
            storedRequestId != proof.requestId ||
            !settled ||
            blockNumber == 0 ||
            betAmount < minEligibleBet
        ) {
            revert InvalidRound(proof.game, proof.requestId);
        }

        consumedRounds[key] = true;
    }

    function _resolvePrize(uint256 requestId, uint256 randomWord) private view returns (uint16 prizeIndex, uint256 prizeAmount) {
        Draw storage draw = draws[requestId];
        Prize[] storage prizes = drawPrizeTables[requestId];
        uint256 roll = randomWord % draw.totalWeight;
        uint256 cursor = 0;

        for (uint256 i = 0; i < prizes.length; i++) {
            cursor += prizes[i].weight;
            if (roll < cursor) {
                return (uint16(i), prizes[i].amount);
            }
        }

        uint256 fallbackIndex = prizes.length - 1;
        return (uint16(fallbackIndex), prizes[fallbackIndex].amount);
    }

    function _setPrizeTable(Prize[] memory prizes) private {
        if (prizes.length == 0 || prizes.length > MAX_PRIZES) revert InvalidConfiguration();

        uint256 nextTotalWeight = 0;
        delete prizeTable;

        for (uint256 i = 0; i < prizes.length; i++) {
            if (prizes[i].amount == 0 || prizes[i].amount > MAX_PRIZE_AMOUNT || prizes[i].weight == 0) {
                revert InvalidConfiguration();
            }
            prizeTable.push(prizes[i]);
            nextTotalWeight += prizes[i].weight;
        }

        if (nextTotalWeight == 0) revert InvalidConfiguration();
        totalWeight = nextTotalWeight;
        emit PrizeTableUpdated(nextTotalWeight);
    }
}

# 02 — Smart Contracts

> All contracts are deployed via **Remix IDE** — no Hardhat deploy scripts needed.
> Remix IDE: [remix.ethereum.org](https://remix.ethereum.org)
> OpenZeppelin: [docs.openzeppelin.com](https://docs.openzeppelin.com)
> Chainlink VRF: [docs.chain.link/vrf/v2-5](https://docs.chain.link/vrf/v2-5)

---

## Current Implementation Notes

- The repository now supports Hardhat deploy scripts in addition to manual Remix deployment.
- Active mainnet game contracts: Coin Flip, Dice, Crash, Mines, Hi-Lo, Over/Under, Limbo, Wheel, Plinko Lite, Color Pick, Treasure Chest, Lucky Seven, Roulette Lite, Scratch Card, Rock Paper Scissors, Slots.
- Every game extends `BaseGame`, locks the player's choice before the VRF request, uses Chainlink VRF for settlement, and reserves the maximum gross payout through `GameVault` before accepting the bet.
- `GameVault` owns bet limits, house edge, approved-game access, pause controls, and locked payout accounting.
- `LuckyDraw` is a separate funded promotional reward contract. It verifies settled round proofs against approved game contracts, prevents proof reuse, snapshots the prize table at request time, requests Chainlink VRF, and exposes a pull-based `claimPrize()` for the resolved ETH reward.
- Crash, Hi-Lo, and Mines were reviewed for payout consistency:
  - Crash gross curve is fair before vault edge.
  - Hi-Lo rejects choices with only one winning card because fair payout would exceed the 8x cap.
  - Mines rejects reveal counts whose fair payout would exceed the 20x cap.
- Current utility batch:
  - `RouletteLiteGame`: `uint8 betType, uint8 choice`; 12 slots; exact pays 12x, color/range pay 2x.
  - `ScratchCardGame`: no params; VRF picks tier; max gross payout 30x.
  - `RockPaperScissorsGame`: `uint8 move`; VRF picks house move and rerolls ties into a non-tie outcome; win pays 2x.
  - `SlotsGame`: no params; VRF creates three reels; pair/triple/jackpot table, max gross payout 25x.

## Contract Hierarchy

```
GameVault.sol          ← Central ETH vault (all funds held here)
VRFConsumer.sol        ← Chainlink VRF v2.5 base
     └── BaseGame.sol  ← Abstract game template
              ├── CoinFlipGame.sol
              ├── DiceGame.sol
              ├── CrashGame.sol
              ├── MinesGame.sol
              ├── HiLoGame.sol
              └── SlotsGame.sol

Leaderboard.sol        ← Independent, reads GameVault events
Referral.sol           ← Independent, distributes rake share
```

---

## Bet Limits & Economics

```
Min bet:    0.0002 ETH  ≈ $0.50
Max bet:    0.001  ETH  ≈ $3.00
House edge: 3% (fixed in contract)
Max multiplier: 30× (Scratch Card), 25× (Slots), 20× (Mines), 12× (Roulette Lite), 10× (Crash), 8× (Hi-Lo), 6× (Dice), 2× (Coin Flip/RPS)

Vault liquidity rule:
  vault.balance >= maxBet × 50 (= 0.05 ETH minimum)
  If below threshold → new bets are rejected

Wei equivalents for Remix:
  0.0002 ETH = 200000000000000  wei
  0.001  ETH = 1000000000000000 wei
```

---

Current max gross payout by game:

| Game | Max gross payout |
|------|------------------|
| Coin Flip | 2x |
| Dice | 6x |
| Crash | 10x client cap |
| Mines | 20x |
| Hi-Lo | 8x |
| Over/Under | odds-dependent, capped by game params |
| Limbo | target-dependent, capped by game params |
| Wheel | risk-table dependent |
| Plinko Lite | risk-table dependent |
| Color Pick | 4x |
| Treasure Chest | tier-table dependent |
| Lucky Seven | 6x |
| Roulette Lite | 12x |
| Scratch Card | 30x |
| Rock Paper Scissors | 2x |
| Slots | 25x |

## VRFConsumer.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/IVRFCoordinatorV2Plus.sol";

/**
 * @title VRFConsumer
 * @notice Base contract for Chainlink VRF v2.5 integration.
 *         All game contracts inherit this to get verifiable randomness.
 */
abstract contract VRFConsumer is VRFConsumerBaseV2Plus {

    IVRFCoordinatorV2Plus public immutable coordinator;
    bytes32  public immutable keyHash;
    uint256  public immutable subscriptionId;
    uint32   public callbackGasLimit;
    uint16   public requestConfirmations;
    uint32   private constant NUM_WORDS = 1;

    constructor(
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) VRFConsumerBaseV2Plus(_coordinator) {
        coordinator          = IVRFCoordinatorV2Plus(_coordinator);
        keyHash              = _keyHash;
        subscriptionId       = _subId;
        callbackGasLimit     = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
    }

    /**
     * @notice Sends a randomness request to Chainlink VRF.
     * @return requestId Unique ID for this randomness request.
     */
    function _requestRandomness() internal returns (uint256 requestId) {
        requestId = coordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash:              keyHash,
                subId:                subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit:     callbackGasLimit,
                numWords:             NUM_WORDS,
                extraArgs:            VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                )
            })
        );
    }

    /**
     * @notice Called by Chainlink oracle when randomness is ready.
     *         Must be implemented by each game contract.
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal virtual override;
}
```

---

## GameVault.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GameVault
 * @notice Central ETH vault for all BasePlay games.
 *         - Holds all player funds and house liquidity.
 *         - Only approved game contracts can lock or release funds.
 *         - Owner can update bet limits and pause in emergencies.
 *
 * Security measures:
 *   - ReentrancyGuard on all fund-moving functions
 *   - CEI pattern (Checks → Effects → Interactions)
 *   - Ownable2Step for safe ownership transfer
 *   - Pausable for emergency stop
 *   - Absolute min/max constants that cannot be overridden
 *   - Liquidity ratio check before accepting bets
 */
contract GameVault is Ownable2Step, ReentrancyGuard, Pausable {

    // ─── Immutable constants ─────────────────────────────────────────────
    uint256 public constant MIN_BET_FLOOR  = 0.00001 ether;  // Absolute minimum — cannot be set lower
    uint256 public constant MAX_BET_CEIL   = 0.01 ether;     // Absolute maximum — cannot be set higher
    uint256 public constant MAX_EDGE_BPS   = 500;             // House edge cap: 5%
    uint256 public constant LIQUIDITY_MULT = 50;              // vault.balance must be >= maxBet × 50

    // ─── Configurable state ─────────────────────────────────────────────
    uint256 public minBet       = 0.0002 ether;  // ~$0.50
    uint256 public maxBet       = 0.001  ether;  // ~$3.00
    uint256 public houseEdgeBps = 300;            // 3.00%

    // ─── Mappings ────────────────────────────────────────────────────────
    mapping(address => bool)    public approvedGames; // Authorized game contracts
    mapping(address => uint256) public lockedFunds;   // Funds locked per player

    // ─── Events ──────────────────────────────────────────────────────────
    event GameApproved(address indexed game);
    event GameRevoked(address indexed game);
    event FundsLocked(address indexed player, uint256 amount);
    event PayoutSent(address indexed player, uint256 net, uint256 fee);
    event BetRefunded(address indexed player, uint256 amount);
    event MinBetUpdated(uint256 oldValue, uint256 newValue);
    event MaxBetUpdated(uint256 oldValue, uint256 newValue);
    event HouseEdgeUpdated(uint256 oldValue, uint256 newValue);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    // ─── Custom errors ───────────────────────────────────────────────────
    error InvalidBetAmount(uint256 amount, uint256 min, uint256 max);
    error InsufficientLiquidity(uint256 required, uint256 available);
    error NotApprovedGame(address caller);
    error NoLockedFunds(address player);
    error TransferFailed(address recipient, uint256 amount);
    error InvalidConfiguration(string reason);
    error ExceedsMaxBetCeiling(uint256 value);

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyApprovedGame() {
        if (!approvedGames[msg.sender]) revert NotApprovedGame(msg.sender);
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice Accept ETH deposits (house liquidity or player bets).
    receive() external payable {}

    // ─── Internal helpers ────────────────────────────────────────────────

    function _checkLiquidity(uint256 betAmount) internal view {
        uint256 required = betAmount * LIQUIDITY_MULT;
        if (address(this).balance < required) {
            revert InsufficientLiquidity(required, address(this).balance);
        }
    }

    // ─── Game management ─────────────────────────────────────────────────

    /**
     * @notice Authorize a game contract to use the vault.
     * @param game Must be a deployed contract address (not EOA).
     */
    function approveGame(address game) external onlyOwner {
        require(game != address(0),       "Zero address");
        require(game.code.length > 0,     "Not a contract");
        approvedGames[game] = true;
        emit GameApproved(game);
    }

    /// @notice Revoke a game contract's vault access.
    function revokeGame(address game) external onlyOwner {
        approvedGames[game] = false;
        emit GameRevoked(game);
    }

    // ─── Bet lifecycle ───────────────────────────────────────────────────

    /**
     * @notice Lock player funds for an in-progress round.
     *         Called by game contracts when a bet is placed.
     * @param player  The player's wallet address.
     * @param amount  Bet amount in wei.
     */
    function lockFunds(address player, uint256 amount)
        external payable
        onlyApprovedGame
        whenNotPaused
        nonReentrant
    {
        if (amount < minBet || amount > maxBet) {
            revert InvalidBetAmount(amount, minBet, maxBet);
        }
        _checkLiquidity(amount);
        lockedFunds[player] += amount;
        emit FundsLocked(player, amount);
    }

    /**
     * @notice Pay out winnings to a player.
     *         Follows CEI pattern: state cleared before transfer.
     * @param player      The winner's wallet address.
     * @param grossAmount Total payout before house edge deduction.
     */
    function payout(address player, uint256 grossAmount)
        external
        onlyApprovedGame
        nonReentrant
    {
        if (lockedFunds[player] == 0) revert NoLockedFunds(player);

        // Checks
        uint256 fee = (grossAmount * houseEdgeBps) / 10_000;
        uint256 net = grossAmount - fee;

        // Effects — clear state before external call
        lockedFunds[player] = 0;

        // Interactions — transfer ETH to player
        (bool ok,) = payable(player).call{value: net}("");
        if (!ok) revert TransferFailed(player, net);

        emit PayoutSent(player, net, fee);
    }

    /**
     * @notice Refund a player's bet when VRF times out.
     *         Called by game contracts after VRF_TIMEOUT_BLOCKS.
     * @param player The player to refund.
     * @param amount The original bet amount.
     */
    function refundBet(address player, uint256 amount)
        external
        onlyApprovedGame
        nonReentrant
    {
        if (lockedFunds[player] < amount) revert NoLockedFunds(player);

        // Effects before interaction
        lockedFunds[player] -= amount;

        (bool ok,) = payable(player).call{value: amount}("");
        if (!ok) revert TransferFailed(player, amount);

        emit BetRefunded(player, amount);
    }

    // ─── Owner configuration ─────────────────────────────────────────────

    function setMinBet(uint256 newMin) external onlyOwner {
        if (newMin < MIN_BET_FLOOR) revert InvalidConfiguration("Below floor");
        if (newMin >= maxBet)       revert InvalidConfiguration("Min must be < max");
        emit MinBetUpdated(minBet, newMin);
        minBet = newMin;
    }

    function setMaxBet(uint256 newMax) external onlyOwner {
        if (newMax > MAX_BET_CEIL) revert ExceedsMaxBetCeiling(newMax);
        if (newMax <= minBet)      revert InvalidConfiguration("Max must be > min");
        emit MaxBetUpdated(maxBet, newMax);
        maxBet = newMax;
    }

    function setHouseEdge(uint256 newBps) external onlyOwner {
        if (newBps > MAX_EDGE_BPS) revert InvalidConfiguration("Exceeds 5% cap");
        emit HouseEdgeUpdated(houseEdgeBps, newBps);
        houseEdgeBps = newBps;
    }

    // ─── Emergency controls ───────────────────────────────────────────────

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Withdraw all ETH from the vault.
     *         Only callable when contract is paused.
     */
    function emergencyWithdraw() external onlyOwner nonReentrant whenPaused {
        uint256 balance = address(this).balance;
        (bool ok,) = payable(owner()).call{value: balance}("");
        if (!ok) revert TransferFailed(owner(), balance);
        emit EmergencyWithdraw(owner(), balance);
    }

    // ─── View functions ──────────────────────────────────────────────────

    /// @return Current ETH balance of the vault.
    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Check whether a bet amount can currently be accepted.
     * @param amount Bet amount in wei.
     * @return True if the vault can accept the bet.
     */
    function canAcceptBet(uint256 amount) external view returns (bool) {
        return !paused()
            && amount >= minBet
            && amount <= maxBet
            && address(this).balance >= amount * LIQUIDITY_MULT;
    }
}
```

---

## BaseGame.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./VRFConsumer.sol";
import "./GameVault.sol";

/**
 * @title BaseGame
 * @notice Abstract base contract for all BasePlay game contracts.
 *         Handles the common bet → VRF → settle lifecycle.
 *
 * Game contracts only need to implement:
 *   - _onBetPlaced()   : decode and store game-specific params
 *   - _processResult() : compute payout from randomWord
 *
 * Security:
 *   - Per-player mutex via activeRound mapping
 *   - Per-block rate limiting (anti-bot)
 *   - VRF timeout: player can reclaim bet after 60 blocks
 *   - Double-settlement protection via settled flag
 *   - All state cleared before external calls (CEI)
 */
abstract contract BaseGame is VRFConsumer {

    GameVault public immutable vault;

    uint256 public constant VRF_TIMEOUT_BLOCKS = 60; // ~2 minutes on Base
    uint256 public constant MAX_BETS_PER_BLOCK  = 3;  // Anti-bot limit

    // ─── Round data ──────────────────────────────────────────────────────
    struct Round {
        address player;
        uint256 betAmount;
        uint256 requestId;
        bytes   gameParams;   // ABI-encoded game-specific params
        bool    settled;
        uint256 blockNumber;  // Used for timeout calculation
    }

    mapping(uint256 => Round)   public rounds;      // requestId → Round
    mapping(address => uint256) public activeRound; // player → active requestId (0 if none)

    // ─── Rate limiting ────────────────────────────────────────────────────
    mapping(address => mapping(uint256 => uint256)) private _betsInBlock;

    // ─── Game pause (independent of vault pause) ──────────────────────────
    bool public gamePaused;

    // ─── Events ──────────────────────────────────────────────────────────
    event BetPlaced(
        address indexed player,
        uint256 indexed requestId,
        uint256         amount,
        bytes           gameParams
    );
    event RoundSettled(
        address indexed player,
        uint256 indexed requestId,
        uint256         payout,
        bool            won,
        uint256         randomWord
    );
    event BetRefunded(address indexed player, uint256 amount);

    // ─── Custom errors ────────────────────────────────────────────────────
    error RoundAlreadyActive(address player);
    error TooManyBetsInBlock(address player);
    error NotPlayerRound(address caller, uint256 requestId);
    error AlreadySettled(uint256 requestId);
    error TimeoutNotReached(uint256 requestId, uint256 currentBlock, uint256 timeoutBlock);
    error GameIsPaused();

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier whenGameNotPaused() {
        if (gamePaused) revert GameIsPaused();
        _;
    }

    constructor(
        address _vault,
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) VRFConsumer(_coordinator, _keyHash, _subId, _callbackGasLimit, _requestConfirmations) {
        vault = GameVault(payable(_vault));
    }

    // ─── Bet placement ────────────────────────────────────────────────────

    /**
     * @notice Place a bet. ETH sent must equal the desired bet amount.
     * @param gameParams ABI-encoded game-specific parameters (choice, mine count, etc.)
     */
    function placeBet(bytes calldata gameParams)
        external payable
        whenGameNotPaused
        nonReentrant
    {
        // Mutex: prevent placing bet while a round is active
        if (activeRound[msg.sender] != 0) revert RoundAlreadyActive(msg.sender);

        // Rate limit: max MAX_BETS_PER_BLOCK bets per address per block
        uint256 blockBets = _betsInBlock[msg.sender][block.number];
        if (blockBets >= MAX_BETS_PER_BLOCK) revert TooManyBetsInBlock(msg.sender);
        _betsInBlock[msg.sender][block.number] = blockBets + 1;

        // Lock funds in vault
        vault.lockFunds{value: msg.value}(msg.sender, msg.value);

        // Request randomness from Chainlink VRF
        uint256 requestId = _requestRandomness();

        // Store round
        rounds[requestId] = Round({
            player:      msg.sender,
            betAmount:   msg.value,
            requestId:   requestId,
            gameParams:  gameParams,
            settled:     false,
            blockNumber: block.number
        });
        activeRound[msg.sender] = requestId;

        // Let the game contract process params (e.g. validate choice)
        _onBetPlaced(requestId, gameParams);

        emit BetPlaced(msg.sender, requestId, msg.value, gameParams);
    }

    // ─── VRF callback ────────────────────────────────────────────────────

    /**
     * @notice Called by Chainlink oracle when randomness is ready.
     *         Computes result, settles round, and triggers payout if won.
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override nonReentrant {
        Round storage round = rounds[requestId];

        // Guard against unknown or already-settled rounds
        if (round.player == address(0)) return;
        if (round.settled)              return;

        // Effects — clear state before any external calls
        round.settled             = true;
        activeRound[round.player] = 0;

        // Compute game-specific payout
        uint256 payoutAmount = _processResult(requestId, randomWords[0]);

        // Interaction — only if player won
        if (payoutAmount > 0) {
            vault.payout(round.player, payoutAmount);
        }

        emit RoundSettled(round.player, requestId, payoutAmount, payoutAmount > 0, randomWords[0]);
    }

    // ─── VRF timeout refund ───────────────────────────────────────────────

    /**
     * @notice Reclaim a stuck bet if VRF has not responded after VRF_TIMEOUT_BLOCKS.
     *         Available to the round's player only.
     * @param requestId The VRF request ID of the stuck round.
     */
    function claimRefund(uint256 requestId) external nonReentrant {
        Round storage round = rounds[requestId];

        if (round.player != msg.sender) revert NotPlayerRound(msg.sender, requestId);
        if (round.settled)              revert AlreadySettled(requestId);

        uint256 timeoutBlock = round.blockNumber + VRF_TIMEOUT_BLOCKS;
        if (block.number <= timeoutBlock) {
            revert TimeoutNotReached(requestId, block.number, timeoutBlock);
        }

        // Effects before interaction
        round.settled             = true;
        activeRound[msg.sender]   = 0;

        vault.refundBet(msg.sender, round.betAmount);

        emit BetRefunded(msg.sender, round.betAmount);
    }

    // ─── Abstract hooks (implemented by each game) ─────────────────────────

    /**
     * @notice Hook called after a bet is placed and before VRF is requested.
     *         Use to validate and store game-specific params.
     */
    function _onBetPlaced(uint256 requestId, bytes calldata params) internal virtual {}

    /**
     * @notice Compute the payout for a settled round.
     * @param requestId  The round's VRF request ID.
     * @param randomWord The random number delivered by Chainlink VRF.
     * @return payout    Gross payout amount (before house edge). 0 if player lost.
     */
    function _processResult(
        uint256 requestId,
        uint256 randomWord
    ) internal virtual returns (uint256 payout);
}
```

---

## CoinFlipGame.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./BaseGame.sol";

/**
 * @title CoinFlipGame
 * @notice Player picks heads (0) or tails (1).
 *         Win condition: randomWord % 2 === player's choice.
 *         Payout: bet × 2 × (1 - 3% house edge) = bet × 1.94
 */
contract CoinFlipGame is BaseGame {

    mapping(uint256 => uint8) public playerChoice; // requestId → 0 (heads) or 1 (tails)

    event CoinFlipResult(
        uint256 indexed requestId,
        uint8   playerChoice,
        uint8   result,
        bool    won
    );

    constructor(
        address _vault,
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) BaseGame(_vault, _coordinator, _keyHash, _subId, _callbackGasLimit, _requestConfirmations) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 choice = abi.decode(params, (uint8));
        require(choice == 0 || choice == 1, "Choice must be 0 (heads) or 1 (tails)");
        playerChoice[requestId] = choice;
    }

    function _processResult(
        uint256 requestId,
        uint256 randomWord
    ) internal override returns (uint256) {
        uint8 result = uint8(randomWord % 2); // 0 = heads, 1 = tails
        Round memory round = rounds[requestId];
        bool won = playerChoice[requestId] == result;

        emit CoinFlipResult(requestId, playerChoice[requestId], result, won);

        if (won) {
            // Gross payout: 2× bet. House edge applied in vault.payout().
            return round.betAmount * 2;
        }
        return 0;
    }
}
```

---

## DiceGame.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./BaseGame.sol";

/**
 * @title DiceGame
 * @notice Player guesses a number from 1 to 6.
 *         Win condition: (randomWord % 6) + 1 === player's guess.
 *         Payout: bet × 6 × 0.97 = bet × 5.82 (after 3% house edge)
 */
contract DiceGame is BaseGame {

    mapping(uint256 => uint8) public playerGuess; // requestId → 1-6

    event DiceResult(
        uint256 indexed requestId,
        uint8   playerGuess,
        uint8   rolled,
        bool    won
    );

    constructor(
        address _vault,
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) BaseGame(_vault, _coordinator, _keyHash, _subId, _callbackGasLimit, _requestConfirmations) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 guess = abi.decode(params, (uint8));
        require(guess >= 1 && guess <= 6, "Guess must be between 1 and 6");
        playerGuess[requestId] = guess;
    }

    function _processResult(
        uint256 requestId,
        uint256 randomWord
    ) internal override returns (uint256) {
        uint8 rolled = uint8((randomWord % 6) + 1); // 1–6
        Round memory round = rounds[requestId];
        bool won = playerGuess[requestId] == rolled;

        emit DiceResult(requestId, playerGuess[requestId], rolled, won);

        if (won) {
            return round.betAmount * 6; // Gross payout: 6× bet
        }
        return 0;
    }
}
```

---

## CrashGame.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./BaseGame.sol";

/**
 * @title CrashGame
 * @notice Player sets an auto-cashout multiplier (101–1000 = 1.01×–10.00×).
 *         VRF determines the crash point. If crash point >= cashout target, player wins.
 *
 *         Crash point formula: provably fair, house edge ~3% built in via modular arithmetic.
 *         Backend broadcasts the rising multiplier via WebSocket using the same formula.
 *
 * Note: Max cashout is 10× (1000 in basis form) to keep payouts within vault capacity.
 */
contract CrashGame is BaseGame {

    struct CrashData {
        uint256 crashPoint; // e.g. 250 = 2.50× crash point (100 = 1.00×)
        uint256 cashoutAt;  // Player's auto-cashout target (101–1000)
    }

    mapping(uint256 => CrashData) public crashData;

    event CrashPointGenerated(uint256 indexed requestId, uint256 crashPoint);

    constructor(
        address _vault,
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) BaseGame(_vault, _coordinator, _keyHash, _subId, _callbackGasLimit, _requestConfirmations) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint256 cashoutAt = abi.decode(params, (uint256));
        require(cashoutAt >= 101 && cashoutAt <= 1000, "Cashout must be 1.01x–10.00x (101–1000)");
        crashData[requestId].cashoutAt = cashoutAt;
    }

    function _processResult(
        uint256 requestId,
        uint256 randomWord
    ) internal override returns (uint256) {
        // Derive a secondary hash from VRF output for crash calculation
        uint256 h          = uint256(keccak256(abi.encodePacked(randomWord, requestId)));
        uint256 crashPoint = _computeCrashPoint(h);

        crashData[requestId].crashPoint = crashPoint;
        emit CrashPointGenerated(requestId, crashPoint);

        Round memory round = rounds[requestId];
        uint256 cashoutAt  = crashData[requestId].cashoutAt;

        // Player wins if they cashed out at or below the crash point
        if (cashoutAt <= crashPoint) {
            // Gross payout: bet × (cashoutAt / 100), scaled to avoid decimals
            return (round.betAmount * cashoutAt) / 100;
        }
        return 0;
    }

    /**
     * @notice Provably fair crash point formula.
     *         ~3% of outcomes crash at 1.00× (instant loss = house edge).
     *         Remaining outcomes follow a pseudo-exponential distribution capped at 10×.
     * @param h A secondary hash derived from the VRF random word.
     * @return  Crash point in basis form (100 = 1.00×, 1000 = 10.00×).
     */
    function _computeCrashPoint(uint256 h) internal pure returns (uint256) {
        if (h % 33 == 0) return 100; // 1/33 ≈ 3% chance of instant crash (house edge)
        return (h % 900) + 101;      // 101–1000 range (1.01×–10.00×)
    }
}
```

---

## MinesGame.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./BaseGame.sol";

/**
 * @title MinesGame
 * @notice 5×5 grid (25 cells). Player picks mine count (1–20).
 *         VRF places mines. Player reveals cells one at a time.
 *         Multiplier grows with each safe reveal. Player can cash out anytime.
 *         Hitting a mine ends the round with no payout.
 *
 *         Mine positions stored as a 25-bit bitmask (uint32).
 *         Revealed cells stored as a 25-bit bitmask (uint32).
 */
contract MinesGame is BaseGame {

    uint8 public constant GRID_SIZE = 25; // 5×5 grid

    struct MinesData {
        uint8  mineCount;
        uint32 minePositions; // Bitmask: bit N set → cell N is a mine
        uint32 revealedMask;  // Bitmask: bit N set → cell N has been revealed
        bool   active;        // False after mine hit or cashout
    }

    mapping(uint256 => MinesData) public minesData;

    event MineHit(uint256 indexed requestId, uint8 position);
    event GemRevealed(uint256 indexed requestId, uint8 position, uint256 multiplierBps);
    event CashedOut(uint256 indexed requestId, uint256 payout);

    constructor(
        address _vault,
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) BaseGame(_vault, _coordinator, _keyHash, _subId, _callbackGasLimit, _requestConfirmations) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 mineCount = abi.decode(params, (uint8));
        require(mineCount >= 1 && mineCount <= 20, "Mine count must be 1–20");
        minesData[requestId].mineCount = mineCount;
    }

    function _processResult(
        uint256 requestId,
        uint256 randomWord
    ) internal override returns (uint256) {
        // Place mines using VRF randomness
        minesData[requestId].minePositions = _placeMines(randomWord, minesData[requestId].mineCount);
        minesData[requestId].active        = true;
        // Payout is deferred to cashOut() — return 0 here
        return 0;
    }

    /**
     * @notice Reveal a single cell. Ends round if mine hit.
     * @param requestId The round's VRF request ID.
     * @param position  Cell index 0–24.
     */
    function revealCell(uint256 requestId, uint8 position) external {
        require(rounds[requestId].player == msg.sender, "Not your round");
        MinesData storage md = minesData[requestId];
        require(md.active,          "Round not active");
        require(position < GRID_SIZE, "Position out of range");
        require((md.revealedMask >> position) & 1 == 0, "Cell already revealed");

        md.revealedMask |= uint32(1 << position);

        if ((md.minePositions >> position) & 1 == 1) {
            // Mine hit — end round, no payout
            md.active = false;
            emit MineHit(requestId, position);
        } else {
            // Safe cell — compute current multiplier
            uint256 gems = _countBits(md.revealedMask);
            uint256 mult = _calcMultiplierBps(md.mineCount, gems);
            emit GemRevealed(requestId, position, mult);
        }
    }

    /**
     * @notice Cash out current winnings and end the round.
     * @param requestId The round's VRF request ID.
     */
    function cashOut(uint256 requestId) external nonReentrant {
        require(rounds[requestId].player == msg.sender, "Not your round");
        MinesData storage md = minesData[requestId];
        require(md.active, "Round not active");

        md.active = false;

        uint256 gems       = _countBits(md.revealedMask);
        uint256 multBps    = _calcMultiplierBps(md.mineCount, gems);
        uint256 grossPayout = (rounds[requestId].betAmount * multBps) / 10_000;

        vault.payout(msg.sender, grossPayout);
        emit CashedOut(requestId, grossPayout);
    }

    // ─── Internal math ────────────────────────────────────────────────────

    /**
     * @notice Deterministically place `count` mines using VRF seed.
     *         Uses sequential hashing to avoid collisions.
     */
    function _placeMines(uint256 seed, uint8 count) internal pure returns (uint32 mask) {
        uint8 placed = 0;
        for (uint8 i = 0; placed < count && i < 200; i++) {
            uint8 pos = uint8(uint256(keccak256(abi.encodePacked(seed, i))) % GRID_SIZE);
            if ((mask >> pos) & 1 == 0) {
                mask   |= uint32(1 << pos);
                placed += 1;
            }
        }
    }

    /// @notice Count the number of set bits in a 32-bit integer.
    function _countBits(uint32 mask) internal pure returns (uint256 count) {
        while (mask > 0) {
            count += mask & 1;
            mask >>= 1;
        }
    }

    /**
     * @notice Calculate gross multiplier in basis points (10000 = 1.00×).
     *         Based on combinatorial probability: C(safe, gems) / C(total, gems).
     *         House edge of ~3% applied via 0.97 factor.
     * @param mines Number of mines in the grid.
     * @param gems  Number of safe cells revealed so far.
     */
    function _calcMultiplierBps(uint8 mines, uint256 gems) internal pure returns (uint256) {
        if (gems == 0) return 10_000; // 1.00× — no cells revealed yet
        uint256 safeCells = GRID_SIZE - mines;
        uint256 mult      = 10_000;
        for (uint256 i = 0; i < gems; i++) {
            // Each reveal: mult *= (total cells / remaining safe cells)
            mult = (mult * GRID_SIZE) / (safeCells - i);
        }
        // Apply 3% house edge
        return (mult * 9_700) / 10_000;
    }
}
```

---

## HiLoGame.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./BaseGame.sol";

/**
 * @title HiLoGame
 * @notice Card-based prediction game.
 *         Player predicts whether the next card will be Higher (1) or Lower (0).
 *         Cards range 1–13. Correct predictions multiply the running payout.
 *         Player can cash out after any successful prediction.
 *
 * Note: Uses block.prevrandao for continuation rounds (not the initial VRF round).
 *       This is acceptable since the stakes are small and the initial VRF establishes fairness.
 */
contract HiLoGame is BaseGame {

    struct HiLoData {
        uint8   currentCard;    // 1–13 (current face-up card)
        uint8   choice;         // 0 = lower, 1 = higher
        uint256 accumulatedBps; // Running multiplier in basis points (10000 = 1.00×)
        bool    active;
    }

    mapping(uint256 => HiLoData) public hiloData;

    event CardDealt(uint256 indexed requestId, uint8 card);
    event RoundContinued(uint256 indexed requestId, uint8 newCard, uint256 accumulatedBps);
    event HiLoCashedOut(uint256 indexed requestId, uint256 payout);

    constructor(
        address _vault,
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subId,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) BaseGame(_vault, _coordinator, _keyHash, _subId, _callbackGasLimit, _requestConfirmations) {}

    function _onBetPlaced(uint256 requestId, bytes calldata params) internal override {
        uint8 choice = abi.decode(params, (uint8));
        require(choice == 0 || choice == 1, "Choice: 0 = lower, 1 = higher");
        hiloData[requestId].choice         = choice;
        hiloData[requestId].accumulatedBps = 10_000; // Start at 1.00×
    }

    function _processResult(
        uint256 requestId,
        uint256 randomWord
    ) internal override returns (uint256) {
        // Deal the first card from VRF randomness
        uint8 card = uint8((randomWord % 13) + 1);
        hiloData[requestId].currentCard = card;
        hiloData[requestId].active      = true;
        emit CardDealt(requestId, card);
        // Payout is deferred to cashOut()
        return 0;
    }

    /**
     * @notice Continue the round with a new prediction.
     * @param requestId The round's VRF request ID.
     * @param choice    0 = next card will be lower, 1 = next card will be higher.
     */
    function continueRound(uint256 requestId, uint8 choice) external {
        require(rounds[requestId].player == msg.sender, "Not your round");
        HiLoData storage hd = hiloData[requestId];
        require(hd.active,                   "Round not active");
        require(choice == 0 || choice == 1,  "Invalid choice");

        hd.choice = choice;

        // Derive next card from block entropy (acceptable for small stakes)
        uint256 pseudo = uint256(keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, msg.sender, requestId, hd.accumulatedBps
        )));
        uint8 newCard = uint8((pseudo % 13) + 1);

        bool correct = (choice == 1 && newCard > hd.currentCard)
                    || (choice == 0 && newCard < hd.currentCard);

        if (correct) {
            uint256 mult        = _calcMultiplierBps(hd.currentCard, choice);
            hd.accumulatedBps   = (hd.accumulatedBps * mult) / 10_000;
            hd.currentCard      = newCard;
            emit RoundContinued(requestId, newCard, hd.accumulatedBps);
        } else {
            // Wrong prediction — round ends, no payout
            hd.active = false;
            emit RoundContinued(requestId, newCard, 0);
        }
    }

    /**
     * @notice Cash out current accumulated winnings.
     * @param requestId The round's VRF request ID.
     */
    function cashOut(uint256 requestId) external nonReentrant {
        require(rounds[requestId].player == msg.sender, "Not your round");
        HiLoData storage hd = hiloData[requestId];
        require(hd.active, "Round not active");

        hd.active = false;

        // Gross payout: bet × accumulated × 0.97 (house edge)
        uint256 grossPayout = (rounds[requestId].betAmount * hd.accumulatedBps * 9_700)
                              / (10_000 * 10_000);

        vault.payout(msg.sender, grossPayout);
        emit HiLoCashedOut(requestId, grossPayout);
    }

    /**
     * @notice Calculate the multiplier for a single correct prediction.
     * @param currentCard The current face-up card (1–13).
     * @param choice      0 = lower, 1 = higher.
     * @return multiplierBps Basis-point multiplier for this prediction (10000 = 1.00×).
     */
    function _calcMultiplierBps(uint8 currentCard, uint8 choice) internal pure returns (uint256) {
        // Count cards that would be a winning outcome
        uint8 winCards = choice == 1
            ? 13 - currentCard   // Cards higher than current
            : currentCard - 1;   // Cards lower than current

        if (winCards == 0) return 10_000; // Edge case: can only go one direction

        // Fair payout: 13/winCards, scaled to basis points
        // House edge (~3%) applied via 0.97 factor
        return (13 * 10_000 * 9_700) / (uint256(winCards) * 10_000);
    }
}
```

---

## Referral.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Referral
 * @notice On-chain referral tracking. Referrers earn 0.5% of referred players' bets.
 *         Earnings accumulate in this contract and are claimed via pull pattern.
 */
contract Referral is Ownable, ReentrancyGuard {

    uint256 public referrerShareBps = 50; // 0.5% of bet amount

    mapping(address => address) public referrers;  // player → referrer
    mapping(address => uint256) public earnings;   // referrer → unclaimed ETH

    event Registered(address indexed player, address indexed referrer);
    event EarningAccrued(address indexed referrer, uint256 amount);
    event EarningClaimed(address indexed referrer, uint256 amount);

    error AlreadyRegistered();
    error SelfReferral();
    error NothingToClaim();
    error TransferFailed(address recipient, uint256 amount);

    constructor() Ownable(msg.sender) {}

    receive() external payable {}

    /// @notice Register a referrer for the caller.
    function register(address referrer) external {
        if (referrers[msg.sender] != address(0)) revert AlreadyRegistered();
        if (referrer == msg.sender)              revert SelfReferral();
        referrers[msg.sender] = referrer;
        emit Registered(msg.sender, referrer);
    }

    /**
     * @notice Accrue referral earnings when a referred player places a bet.
     *         Called by the backend after a round is settled.
     * @param player    The player who placed the bet.
     * @param betAmount The bet amount in wei.
     */
    function distribute(address player, uint256 betAmount) external onlyOwner {
        address ref = referrers[player];
        if (ref == address(0)) return;
        uint256 share = (betAmount * referrerShareBps) / 10_000;
        earnings[ref] += share;
        emit EarningAccrued(ref, share);
    }

    /// @notice Claim accumulated referral earnings (pull pattern).
    function claim() external nonReentrant {
        uint256 amount = earnings[msg.sender];
        if (amount == 0) revert NothingToClaim();

        earnings[msg.sender] = 0;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed(msg.sender, amount);

        emit EarningClaimed(msg.sender, amount);
    }

    function setReferrerShare(uint256 newBps) external onlyOwner {
        require(newBps <= 200, "Max 2%");
        referrerShareBps = newBps;
    }
}
```



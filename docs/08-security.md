# 08 — Security

## Attack Vectors & Mitigations

| Attack | Severity | Mitigation |
|--------|----------|-----------|
| Reentrancy | Critical | `ReentrancyGuard` on all fund-moving functions; CEI pattern |
| Integer overflow | High | Solidity 0.8.24 built-in checks |
| Front-running | Medium | VRF commit-reveal — result unknowable before bet tx |
| Oracle manipulation | High | Chainlink VRF v2.5 — cryptographically secure |
| Unauthorized access | Critical | `onlyOwner`, `onlyApprovedGame`, custom errors |
| Vault drain | Critical | `LIQUIDITY_MULT` ratio check; `pause()` kill switch |
| Flash loan | Medium | Per-block bet limit; `activeRound` mutex per player |
| Sandwich attack | Low | VRF takes 1–3 blocks; atomic sandwich impossible |
| Double settlement | Medium | `settled` flag checked before processing |
| Signature replay | Medium | `requestId` is single-use; `settled` flag |
| Ownership takeover | High | `Ownable2Step` requires two-step transfer acceptance |

---

## Audit Checklist — Run in Remix Static Analysis

### GameVault.sol

```
[x] ReentrancyGuard on lockFunds, payout, refundBet, emergencyWithdraw
[x] CEI pattern: state cleared before external call in payout()
[x] No tx.origin usage — uses msg.sender only
[x] Solidity 0.8.24 — overflow protection built-in
[x] House edge arithmetic uses 10,000 basis points (no precision loss)
[x] Zero address check in approveGame()
[x] Contract existence check (code.length > 0) in approveGame()
[x] Ownable2Step — two-step ownership transfer
[x] emergencyWithdraw only callable when paused
[x] MIN_BET_FLOOR / MAX_BET_CEIL — immutable constants
[x] Events emitted on every state change
[x] Custom errors used (gas savings vs revert strings)
[x] canAcceptBet() view covers all failure conditions
```

### BaseGame.sol

```
[x] activeRound mutex — prevents double-bet per player
[x] MAX_BETS_PER_BLOCK limit — anti-bot protection
[x] VRF_TIMEOUT_BLOCKS (60) — player can reclaim stuck bets
[x] Double-settlement guard: if (round.settled) return;
[x] Null round guard: if (round.player == address(0)) return;
[x] nonReentrant on fulfillRandomWords and claimRefund
[x] gameParams decoded safely with abi.decode (reverts on bad data)
[x] State cleared (settled, activeRound) before vault.payout() call
```

### Game Contracts (Coin Flip, Dice, Crash, Mines, Hi-Lo)

```
[x] _processResult is pure computation — no external calls
[x] cashOut / revealCell verify msg.sender == round.player
[x] Mines: _placeMines loop bounded (max 200 iterations)
[x] Mines: multiplier formula prevents division by zero (gems <= safeCells)
[x] Crash: max cashout 10x — within vault capacity
[x] Hi-Lo: edge case handled when winCards == 0
```

### General

```
[x] SPDX-License-Identifier in every file
[x] Fixed pragma: 0.8.24 (not ^0.8.24)
[x] OpenZeppelin imports from latest stable release
[x] All public/external functions have NatSpec @notice
[x] No selfdestruct usage
[x] No delegatecall usage
[x] No assembly usage
[x] Verified on Basescan (source code public)
```

---

## Pre-Mainnet Security Steps

```
1. Run Hardhat test suite — all tests pass, coverage > 90%
2. Run Remix Static Analysis — no high or critical warnings
3. Deploy to mainnet — run for 48+ hours with real transactions
4. Independent review — at minimum one other developer reads the contracts
5. Owner wallet → hardware wallet (Ledger / Trezor)
6. Consider Gnosis Safe multisig for owner address (2-of-3)
7. Set up Chainlink VRF email alerts for low LINK balance
8. Verify all contracts on Basescan before announcing
```



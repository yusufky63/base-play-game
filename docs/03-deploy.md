# 03 — Deploy Guide

> Remix IDE: [remix.ethereum.org](https://remix.ethereum.org)
> VRF Addresses: [docs.chain.link/vrf/v2-5/supported-networks](https://docs.chain.link/vrf/v2-5/supported-networks)

## Step 1 — Preparation

```
1. Open remix.ethereum.org
2. Connect MetaMask → switch to Base Sepolia
3. Get test ETH: faucet.quicknode.com/base/sepolia
4. Get LINK tokens: faucets.chain.link → select Base Sepolia
5. Create VRF Subscription: vrf.chain.link → Create Subscription
6. Fund subscription with at least 5 LINK
7. Note your Subscription ID
```

## Step 2 — Base Sepolia Constants

```
VRF Coordinator:  0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE
Key Hash:         0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71
Callback Gas:     200000
Confirmations:    3
```

## Step 3 — Deploy Order

```
STEP 1 ── GameVault.sol
  Constructor args: (none)
  → Save as: VAULT_ADDR

STEP 2 ── CoinFlipGame.sol
  Constructor args:
    _vault:                 VAULT_ADDR
    _coordinator:           0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE
    _keyHash:               0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71
    _subId:                 YOUR_VRF_SUBSCRIPTION_ID
    _callbackGasLimit:      200000
    _requestConfirmations:  3
  → Save as: COINFLIP_ADDR

STEP 3 ── DiceGame.sol     (same constructor args)  → DICE_ADDR
STEP 4 ── CrashGame.sol    (same constructor args)  → CRASH_ADDR
STEP 5 ── MinesGame.sol    (callbackGasLimit: 300000) → MINES_ADDR
STEP 6 ── HiLoGame.sol     (same as step 2)         → HILO_ADDR
STEP 7 ── Referral.sol     (no constructor args)    → REFERRAL_ADDR
STEP 8 ── Leaderboard.sol  (no constructor args)    → LEADERBOARD_ADDR

STEP 9 ── Approve games in vault
  GameVault → approveGame(COINFLIP_ADDR)
  GameVault → approveGame(DICE_ADDR)
  GameVault → approveGame(CRASH_ADDR)
  GameVault → approveGame(MINES_ADDR)
  GameVault → approveGame(HILO_ADDR)

STEP 10 ── Add consumers to VRF Subscription
  vrf.chain.link → Your Subscription → Add Consumer
  Add all 5 game contract addresses

STEP 11 ── Fund vault with liquidity
  Send 0.5 ETH to VAULT_ADDR (paste in MetaMask)
  Verify: GameVault.canAcceptBet(1000000000000000) → true

STEP 12 ── Copy ABIs to shared/abis/
  Remix → File Explorer → artifacts/ → download each .json
  Paste into: packages/shared/abis/

STEP 13 ── Update addresses.ts
  packages/shared/config/addresses.ts → fill in all addresses for chainId 84532
```

## Step 4 — Basescan Verification

```bash
# For each contract:
# 1. Go to sepolia.basescan.org → search contract address
# 2. Contract tab → Verify and Publish
# 3. Compiler: v0.8.24
# 4. License: MIT
# 5. Optimization: Yes, 200 runs
# 6. Paste flattened source code
#    (Remix → Plugin Manager → Flattener → Flatten)

# Or use Remix Etherscan Plugin:
# Remix → Plugin Manager → search "Etherscan" → Activate
# Enter Basescan API key (get from sepolia.basescan.org/myapikey)
# Select contract → Verify
```

## Step 5 — Mainnet Deploy

Same process, different constants:

```
VRF Coordinator:  0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
Key Hash:         0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd
Block Explorer:   basescan.org
```

## Wei Converter Reference

```
0.0002 ETH = 200000000000000  wei   ← minBet
0.001  ETH = 1000000000000000 wei   ← maxBet
0.5    ETH = 500000000000000000 wei ← initial vault liquidity
```

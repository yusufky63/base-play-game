import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.25");
const DRAW_LIQUIDITY = ethers.parseEther("0.05");
const KEY_HASH = "0x" + "11".repeat(32);
const COIN_FLIP_PARAMS = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
const FIRST_PRIZE = 43_478_260_869_565n;

describe("LuckyDraw", function () {
  async function deployFixture() {
    const [owner, player, other] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("GameVault");
    const vault = await Vault.deploy();
    await owner.sendTransaction({ to: await vault.getAddress(), value: LIQUIDITY });

    const Coordinator = await ethers.getContractFactory("MockVRFCoordinatorV2Plus");
    const coordinator = await Coordinator.deploy();

    const CoinFlip = await ethers.getContractFactory("CoinFlipGame");
    const game = await CoinFlip.deploy(await vault.getAddress(), await coordinator.getAddress(), KEY_HASH, 1, 200_000, 3);
    await vault.approveGame(await game.getAddress());

    const LuckyDraw = await ethers.getContractFactory("LuckyDraw");
    const luckyDraw = await LuckyDraw.deploy(await coordinator.getAddress(), KEY_HASH, 1, 250_000, 3);
    await luckyDraw.fund({ value: DRAW_LIQUIDITY });
    await luckyDraw.setApprovedGame(await game.getAddress(), true);
    await luckyDraw.setDrawConfig(2, BET);

    return { coordinator, game, luckyDraw, owner, player, other };
  }

  async function settleCoinFlipRounds(game: any, coordinator: any, player: any, count: number, startRequestId = 1n) {
    const proofs: Array<{ game: string; requestId: bigint }> = [];
    for (let i = 0; i < count; i++) {
      const requestId = startRequestId + BigInt(i);
      await game.connect(player).placeBet(COIN_FLIP_PARAMS, { value: BET });
      await coordinator.fulfill(requestId, 1);
      proofs.push({ game: await game.getAddress(), requestId });
    }
    return proofs;
  }

  it("verifies settled game rounds, resolves with VRF, and lets the player claim", async function () {
    const { coordinator, game, luckyDraw, player } = await deployFixture();
    const proofs = await settleCoinFlipRounds(game, coordinator, player, 2);

    await expect(luckyDraw.connect(player).requestDraw(proofs))
      .to.emit(luckyDraw, "DrawRequested")
      .withArgs(player.address, 3, await luckyDraw.maxPrizeAmount());

    await expect(coordinator.fulfill(3, 0))
      .to.emit(luckyDraw, "DrawResolved")
      .withArgs(player.address, 3, 0, FIRST_PRIZE, 0);

    await expect(luckyDraw.connect(player).claimPrize(3)).to.changeEtherBalances(
      [luckyDraw, player],
      [-FIRST_PRIZE, FIRST_PRIZE]
    );
    expect(await luckyDraw.totalClaimablePrizes()).to.equal(0);
  });

  it("blocks reused proofs after a draw request consumes the rounds", async function () {
    const { coordinator, game, luckyDraw, player } = await deployFixture();
    const proofs = await settleCoinFlipRounds(game, coordinator, player, 2);

    await luckyDraw.connect(player).requestDraw(proofs);
    await coordinator.fulfill(3, 0);

    await expect(luckyDraw.connect(player).requestDraw(proofs))
      .to.be.revertedWithCustomError(luckyDraw, "RoundAlreadyConsumed")
      .withArgs(await game.getAddress(), 1);
  });

  it("rejects unsettled, wrong-player, or unapproved game proofs", async function () {
    const { coordinator, game, luckyDraw, player, other } = await deployFixture();
    await game.connect(player).placeBet(COIN_FLIP_PARAMS, { value: BET });
    await game.connect(other).placeBet(COIN_FLIP_PARAMS, { value: BET });
    await coordinator.fulfill(2, 1);

    await expect(
      luckyDraw.connect(player).requestDraw([
        { game: await game.getAddress(), requestId: 1 },
        { game: await game.getAddress(), requestId: 2 }
      ])
    ).to.be.revertedWithCustomError(luckyDraw, "InvalidRound");

    await expect(
      luckyDraw.connect(player).requestDraw([
        { game: await luckyDraw.getAddress(), requestId: 1 },
        { game: await game.getAddress(), requestId: 2 }
      ])
    ).to.be.revertedWithCustomError(luckyDraw, "InvalidGame");
  });

  it("lets the owner pause and update reward controls", async function () {
    const { luckyDraw, player } = await deployFixture();
    await luckyDraw.setPrizeTable([
      { amount: ethers.parseEther("0.0001"), weight: 9_000 },
      { amount: ethers.parseEther("0.001"), weight: 1_000 }
    ]);
    await luckyDraw.setDrawConfig(3, ethers.parseEther("0.0002"));
    await luckyDraw.pause();

    expect(await luckyDraw.roundsRequired()).to.equal(3);
    expect(await luckyDraw.minEligibleBet()).to.equal(ethers.parseEther("0.0002"));
    expect(await luckyDraw.totalWeight()).to.equal(10_000);
    await expect(luckyDraw.connect(player).requestDraw([])).to.be.revertedWithCustomError(luckyDraw, "EnforcedPause");
  });

  it("uses the prize table snapshot from request time", async function () {
    const { coordinator, game, luckyDraw, player } = await deployFixture();
    const proofs = await settleCoinFlipRounds(game, coordinator, player, 2);

    await luckyDraw.setPrizeTable([
      { amount: ethers.parseEther("0.0001"), weight: 1 },
      { amount: ethers.parseEther("0.0002"), weight: 1 }
    ]);
    await luckyDraw.connect(player).requestDraw(proofs);
    await luckyDraw.setPrizeTable([{ amount: ethers.parseEther("0.001"), weight: 1 }]);

    await expect(coordinator.fulfill(3, 0))
      .to.emit(luckyDraw, "DrawResolved")
      .withArgs(player.address, 3, 0, ethers.parseEther("0.0001"), 0);
  });

  it("can cancel an expired draw and release consumed rounds", async function () {
    const { coordinator, game, luckyDraw, player } = await deployFixture();
    const proofs = await settleCoinFlipRounds(game, coordinator, player, 2);

    await luckyDraw.connect(player).requestDraw(proofs);
    await ethers.provider.send("hardhat_mine", ["0x79"]);

    await expect(luckyDraw.connect(player).cancelExpiredDraw(3))
      .to.emit(luckyDraw, "DrawCancelled")
      .withArgs(player.address, 3);

    expect(await luckyDraw.activeDraw(player.address)).to.equal(0);
    expect(await luckyDraw.consumedRounds(ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [await game.getAddress(), 1])))).to.equal(false);
  });
});

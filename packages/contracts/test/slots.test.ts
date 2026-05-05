import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.2");
const KEY_HASH = "0x" + "77".repeat(32);

describe("SlotsGame", function () {
  async function deployFixture() {
    const [owner, player] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("GameVault");
    const vault = await Vault.deploy();
    await owner.sendTransaction({ to: await vault.getAddress(), value: LIQUIDITY });

    const Coordinator = await ethers.getContractFactory("MockVRFCoordinatorV2Plus");
    const coordinator = await Coordinator.deploy();

    const Game = await ethers.getContractFactory("SlotsGame");
    const game = await Game.deploy(await vault.getAddress(), await coordinator.getAddress(), KEY_HASH, 1, 300_000, 3);
    await vault.approveGame(await game.getAddress());

    return { coordinator, game, player, vault };
  }

  it("reserves the max 25x payout", async function () {
    const { game, player, vault } = await deployFixture();
    const expectedReserve = (BET * 25n * 9700n) / 10_000n;

    await game.connect(player).placeBet("0x", { value: BET });

    expect(await vault.reservedPayouts(player.address)).to.equal(expectedReserve);
  });

  it("settles a jackpot triple", async function () {
    const { coordinator, game, player } = await deployFixture();

    await game.connect(player).placeBet("0x", { value: BET });

    await expect(coordinator.fulfill(1, 0))
      .to.emit(game, "RoundSettled")
      .withArgs(player.address, 1, BET, BET * 25n, true);
  });

  it("settles a pair win", async function () {
    const { coordinator, game, player } = await deployFixture();

    await game.connect(player).placeBet("0x", { value: BET });

    await expect(coordinator.fulfill(1, 6))
      .to.emit(game, "RoundSettled")
      .withArgs(player.address, 1, BET, (BET * 14_500n) / 10_000n, true);
  });

  it("settles a losing spin", async function () {
    const { coordinator, game, player } = await deployFixture();

    await game.connect(player).placeBet("0x", { value: BET });

    await expect(coordinator.fulfill(1, 78))
      .to.emit(game, "RoundSettled")
      .withArgs(player.address, 1, BET, 0, false);
  });

  it("rejects params", async function () {
    const { game, player } = await deployFixture();

    await expect(game.connect(player).placeBet("0x01", { value: BET })).to.be.revertedWith("No params");
  });
});

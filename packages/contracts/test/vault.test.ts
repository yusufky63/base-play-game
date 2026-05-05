import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.1");
const KEY_HASH = "0x" + "55".repeat(32);

describe("GameVault controls", function () {
  async function deployFixture() {
    const [owner, player] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("GameVault");
    const vault = await Vault.deploy();
    await owner.sendTransaction({ to: await vault.getAddress(), value: LIQUIDITY });

    const Coordinator = await ethers.getContractFactory("MockVRFCoordinatorV2Plus");
    const coordinator = await Coordinator.deploy();

    const CoinFlip = await ethers.getContractFactory("CoinFlipGame");
    const game = (await CoinFlip.deploy(await vault.getAddress(), await coordinator.getAddress(), KEY_HASH, 1, 200_000, 3)) as any;
    await vault.approveGame(await game.getAddress());

    return { game, owner, player, vault };
  }

  it("updates bet limits and house edge", async function () {
    const { vault } = await deployFixture();
    const minBet = ethers.parseEther("0.0001");
    const maxBet = ethers.parseEther("0.002");

    await expect(vault.setMaxBet(maxBet)).to.emit(vault, "MaxBetUpdated");
    await expect(vault.setMinBet(minBet)).to.emit(vault, "MinBetUpdated");
    await expect(vault.setHouseEdge(250)).to.emit(vault, "HouseEdgeUpdated");

    expect(await vault.minBet()).to.equal(minBet);
    expect(await vault.maxBet()).to.equal(maxBet);
    expect(await vault.houseEdgeBps()).to.equal(250);
  });

  it("rejects invalid configuration and unauthorized games", async function () {
    const { game, vault } = await deployFixture();

    await expect(vault.setHouseEdge(501)).to.be.revertedWithCustomError(vault, "InvalidConfiguration");
    await expect(vault.setMaxBet(ethers.parseEther("0.02"))).to.be.revertedWithCustomError(vault, "ExceedsMaxBetCeiling");

    await vault.revokeGame(await game.getAddress());
    await expect(vault.refundBet(ethers.ZeroAddress, BET, BET)).to.be.revertedWithCustomError(vault, "NotApprovedGame");
  });

  it("blocks house edge changes while payouts are reserved", async function () {
    const { game, player, vault } = await deployFixture();
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });

    await expect(vault.setHouseEdge(250)).to.be.revertedWithCustomError(vault, "ActivePayoutsReserved");
  });

  it("pauses new bets and reports liquidity", async function () {
    const { game, player, vault } = await deployFixture();
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    expect(await vault.canAcceptBet(BET)).to.equal(true);
    await vault.pause();
    expect(await vault.canAcceptBet(BET)).to.equal(false);
    await expect(game.connect(player).placeBet(params, { value: BET })).to.be.reverted;
  });

  it("allows emergency withdraw while paused", async function () {
    const { owner, vault } = await deployFixture();

    await vault.pause();
    await expect(vault.emergencyWithdraw()).to.emit(vault, "EmergencyWithdraw").withArgs(owner.address, LIQUIDITY);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0);
  });
});

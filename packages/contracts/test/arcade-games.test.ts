import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.2");
const KEY_HASH = "0x" + "44".repeat(32);

describe("Arcade VRF games", function () {
  async function deployFixture(contractName: "OverUnderGame" | "LimboGame" | "WheelGame" | "PlinkoLiteGame") {
    const [owner, player] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("GameVault");
    const vault = await Vault.deploy();
    await owner.sendTransaction({ to: await vault.getAddress(), value: LIQUIDITY });

    const Coordinator = await ethers.getContractFactory("MockVRFCoordinatorV2Plus");
    const coordinator = await Coordinator.deploy();

    const Game = await ethers.getContractFactory(contractName);
    const game = (await Game.deploy(await vault.getAddress(), await coordinator.getAddress(), KEY_HASH, 1, 300_000, 3)) as any;
    await vault.approveGame(await game.getAddress());

    return { coordinator, game, player, vault };
  }

  it("settles over-under using locked target odds", async function () {
    const { coordinator, game, player, vault } = await deployFixture("OverUnderGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 60]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 98)).to.emit(game, "OverUnderResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("rejects over-under odds that are too extreme", async function () {
    const { game, player } = await deployFixture("OverUnderGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 99]);

    await expect(game.connect(player).placeBet(params, { value: BET })).to.be.revertedWith("Target out of range");
  });

  it("settles limbo against a preselected multiplier", async function () {
    const { coordinator, game, player, vault } = await deployFixture("LimboGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [25_000]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 1000)).to.emit(game, "LimboResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("settles wheel with the selected risk profile", async function () {
    const { coordinator, game, player, vault } = await deployFixture("WheelGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [2]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 15)).to.emit(game, "WheelResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("settles plinko-lite from VRF path bits", async function () {
    const { coordinator, game, player, vault } = await deployFixture("PlinkoLiteGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 0xff)).to.emit(game, "PlinkoLiteResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });
});

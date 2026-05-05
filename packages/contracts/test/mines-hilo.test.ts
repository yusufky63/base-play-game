import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.1");
const KEY_HASH = "0x" + "33".repeat(32);

describe("MinesGame and HiLoGame", function () {
  async function deployFixture(contractName: "MinesGame" | "HiLoGame") {
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

  it("settles a mines round", async function () {
    const { coordinator, game, player, vault } = await deployFixture("MinesGame");
    const revealMask = (1 << 2) | (1 << 7) | (1 << 11);
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint32"], [3, revealMask]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 12345)).to.emit(game, "MinesResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("settles a hi-lo round", async function () {
    const { coordinator, game, player, vault } = await deployFixture("HiLoGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 7]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 12)).to.emit(game, "HiLoResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("rejects impossible hi-lo choices", async function () {
    const { game, player } = await deployFixture("HiLoGame");
    const higherFromKing = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 13]);
    const lowerFromAce = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [0, 1]);

    await expect(game.connect(player).placeBet(higherFromKing, { value: BET })).to.be.revertedWith("Choice has no winning card");
    await expect(game.connect(player).placeBet(lowerFromAce, { value: BET })).to.be.revertedWith("Choice has no winning card");
  });

  it("rejects hi-lo choices that exceed the max payout cap", async function () {
    const { game, player } = await deployFixture("HiLoGame");
    const higherFromQueen = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 12]);
    const lowerFromTwo = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [0, 2]);

    await expect(game.connect(player).placeBet(higherFromQueen, { value: BET })).to.be.revertedWith("Payout exceeds max");
    await expect(game.connect(player).placeBet(lowerFromTwo, { value: BET })).to.be.revertedWith("Payout exceeds max");
  });

  it("rejects mines selections that exceed the max payout cap", async function () {
    const { game, player } = await deployFixture("MinesGame");
    let revealMask = 0;
    for (let index = 0; index < 6; index++) revealMask |= 1 << index;
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint32"], [10, revealMask]);

    await expect(game.connect(player).placeBet(params, { value: BET })).to.be.revertedWith("Payout exceeds max");
  });
});

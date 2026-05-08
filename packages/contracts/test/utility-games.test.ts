import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.2");
const KEY_HASH = "0x" + "66".repeat(32);

describe("Utility VRF games", function () {
  async function deployFixture(contractName: "RouletteLiteGame" | "ScratchCardGame" | "RockPaperScissorsGame") {
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

  it("settles roulette exact number wins and clears locks", async function () {
    const { coordinator, game, player, vault } = await deployFixture("RouletteLiteGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [0, 7]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 7)).to.emit(game, "RouletteLiteResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
    expect(await vault.reservedPayouts(player.address)).to.equal(0);
  });

  it("settles roulette color losses", async function () {
    const { coordinator, game, player, vault } = await deployFixture("RouletteLiteGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 2)).to.emit(game, "RouletteLiteResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("reserves scratch-card max payout before settlement", async function () {
    const { coordinator, game, player, vault } = await deployFixture("ScratchCardGame");
    const expectedReserve = (BET * 30n * 9500n) / 10_000n;

    await game.connect(player).placeBet("0x", { value: BET });
    expect(await vault.reservedPayouts(player.address)).to.equal(expectedReserve);

    await expect(coordinator.fulfill(1, 0)).to.emit(game, "ScratchCardResult");
    expect(await vault.reservedPayouts(player.address)).to.equal(0);
  });

  it("settles scratch-card losing tier", async function () {
    const { coordinator, game, player, vault } = await deployFixture("ScratchCardGame");

    await game.connect(player).placeBet("0x", { value: BET });
    await expect(coordinator.fulfill(1, 999)).to.emit(game, "ScratchCardResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("settles rock-paper-scissors without ties", async function () {
    const { coordinator, game, player, vault } = await deployFixture("RockPaperScissorsGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [0]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 2)).to.emit(game, "RockPaperScissorsResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("rerolls rock-paper-scissors ties into a non-tie result", async function () {
    const { coordinator, game, player } = await deployFixture("RockPaperScissorsGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 1)).to.emit(game, "RockPaperScissorsResult");
    expect(await game.activeRound(player.address)).to.equal(0);
  });

  it("rejects invalid utility game params", async function () {
    const roulette = await deployFixture("RouletteLiteGame");
    const scratch = await deployFixture("ScratchCardGame");
    const rps = await deployFixture("RockPaperScissorsGame");

    await expect(roulette.game.connect(roulette.player).placeBet(ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [0, 12]), { value: BET })).to.be.revertedWith("Invalid number");
    await expect(scratch.game.connect(scratch.player).placeBet("0x1234", { value: BET })).to.be.revertedWith("No params");
    await expect(rps.game.connect(rps.player).placeBet(ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [3]), { value: BET })).to.be.revertedWith("Invalid move");
  });
});

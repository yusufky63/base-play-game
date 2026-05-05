import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.1");
const KEY_HASH = "0x" + "44".repeat(32);

describe("CrashGame and refunds", function () {
  async function deployFixture(contractName: "CrashGame" | "CoinFlipGame") {
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

  it("settles a crash round and releases locked funds", async function () {
    const { coordinator, game, player, vault } = await deployFixture("CrashGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [250]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 123456)).to.emit(game, "CrashPointGenerated");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("uses a fair gross crash curve before the vault edge is applied", async function () {
    const { game } = await deployFixture("CrashGame");
    expect(await game.computeCrashPoint(600000)).to.equal(250n);
  });

  it("settles a losing crash round", async function () {
    const { coordinator, game, player } = await deployFixture("CrashGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1000]);
    await game.connect(player).placeBet(params, { value: BET });

    let randomWord = 1n;
    for (let candidate = 1n; candidate < 100n; candidate++) {
      const hash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [candidate, 1n]));
      const crashPoint = await game.computeCrashPoint(BigInt(hash));
      if (crashPoint < 1000n) {
        randomWord = candidate;
        break;
      }
    }

    await expect(coordinator.fulfill(1, randomWord)).to.emit(game, "RoundSettled").withArgs(player.address, 1, BET, 0, false);
  });

  it("allows the player to claim a refund after VRF timeout blocks", async function () {
    const { game, player, vault } = await deployFixture("CoinFlipGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await ethers.provider.send("hardhat_mine", ["0x3d"]);

    await expect(game.connect(player).claimRefund()).to.emit(game, "BetRefundClaimed").withArgs(player.address, 1, BET);
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("blocks duplicate active rounds and early or foreign refunds", async function () {
    const { game, player } = await deployFixture("CoinFlipGame");
    const [, , attacker] = await ethers.getSigners();
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(game.connect(player).placeBet(params, { value: BET })).to.be.revertedWithCustomError(game, "ActiveRoundExists");
    await expect(game.connect(player).claimRefund()).to.be.revertedWithCustomError(game, "RefundTooEarly");
    await expect(game.connect(attacker).claimRefund()).to.be.revertedWithCustomError(game, "NoActiveRound");
  });
});

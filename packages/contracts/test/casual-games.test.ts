import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.2");
const KEY_HASH = "0x" + "55".repeat(32);

describe("Casual VRF games", function () {
  async function deployFixture(contractName: "ColorPickGame" | "TreasureChestGame" | "LuckySevenGame") {
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

  it("settles color pick", async function () {
    const { coordinator, game, player, vault } = await deployFixture("ColorPickGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [2]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 2)).to.emit(game, "ColorPickResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("settles treasure chest", async function () {
    const { coordinator, game, player, vault } = await deployFixture("TreasureChestGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [4]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 13)).to.emit(game, "TreasureChestResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("settles lucky seven", async function () {
    const { coordinator, game, player, vault } = await deployFixture("LuckySevenGame");
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 24)).to.emit(game, "LuckySevenResult");
    expect(await vault.lockedFunds(player.address)).to.equal(0);
  });

  it("rejects invalid casual game choices", async function () {
    const color = await deployFixture("ColorPickGame");
    const chest = await deployFixture("TreasureChestGame");
    const lucky = await deployFixture("LuckySevenGame");

    await expect(color.game.connect(color.player).placeBet(ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [4]), { value: BET })).to.be.revertedWith("Invalid color");
    await expect(chest.game.connect(chest.player).placeBet(ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [9]), { value: BET })).to.be.revertedWith("Invalid chest");
    await expect(lucky.game.connect(lucky.player).placeBet(ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [3]), { value: BET })).to.be.revertedWith("Invalid choice");
  });
});

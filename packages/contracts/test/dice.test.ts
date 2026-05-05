import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.1");
const KEY_HASH = "0x" + "22".repeat(32);

describe("DiceGame", function () {
  it("settles a correct dice guess", async function () {
    const [owner, player] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("GameVault");
    const vault = await Vault.deploy();
    await owner.sendTransaction({ to: await vault.getAddress(), value: LIQUIDITY });

    const Coordinator = await ethers.getContractFactory("MockVRFCoordinatorV2Plus");
    const coordinator = await Coordinator.deploy();

    const Dice = await ethers.getContractFactory("DiceGame");
    const game = (await Dice.deploy(await vault.getAddress(), await coordinator.getAddress(), KEY_HASH, 1, 200_000, 3)) as any;
    await vault.approveGame(await game.getAddress());

    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [4]);
    await game.connect(player).placeBet(params, { value: BET });

    await expect(coordinator.fulfill(1, 3)).to.emit(game, "DiceResult").withArgs(1, 4, 4, true);
  });
});

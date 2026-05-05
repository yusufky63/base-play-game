import { expect } from "chai";
import { ethers } from "hardhat";

const BET = ethers.parseEther("0.001");
const LIQUIDITY = ethers.parseEther("0.1");
const KEY_HASH = "0x" + "11".repeat(32);

describe("CoinFlipGame", function () {
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

    return { coordinator, game, player, vault };
  }

  it("pays a winning coin flip and clears locked funds", async function () {
    const { coordinator, game, player, vault } = await deployFixture();
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 1)).to.emit(game, "RoundSettled").withArgs(player.address, 1, BET, BET * 2n, true);

    expect(await vault.lockedFunds(player.address)).to.equal(0);
    expect(await vault.reservedPayouts(player.address)).to.equal(0);
    expect(await vault.totalReservedPayout()).to.equal(0);
  });

  it("settles a losing coin flip without leaving funds locked", async function () {
    const { coordinator, game, player, vault } = await deployFixture();
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);

    await game.connect(player).placeBet(params, { value: BET });
    await expect(coordinator.fulfill(1, 0)).to.emit(game, "RoundSettled").withArgs(player.address, 1, BET, 0, false);

    expect(await vault.lockedFunds(player.address)).to.equal(0);
    expect(await vault.reservedPayouts(player.address)).to.equal(0);
    expect(await vault.totalReservedPayout()).to.equal(0);
  });

  it("reserves maximum net payout while a round is active", async function () {
    const { game, player, vault } = await deployFixture();
    const params = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
    const expectedReserved = (BET * 2n * 9700n) / 10_000n;

    await game.connect(player).placeBet(params, { value: BET });

    expect(await vault.lockedFunds(player.address)).to.equal(BET);
    expect(await vault.reservedPayouts(player.address)).to.equal(expectedReserved);
    expect(await vault.totalReservedPayout()).to.equal(expectedReserved);
  });
});

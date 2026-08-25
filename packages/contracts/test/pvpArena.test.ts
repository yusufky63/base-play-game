import { expect } from "chai";
import { ethers } from "hardhat";

const MIN_BET = ethers.parseEther("0.001");
const KEY_HASH = "0x" + "11".repeat(32);

describe("PvPArena", function () {
  async function deployFixture() {
    const [owner, playerA, playerB, playerC, treasury] = await ethers.getSigners();

    const Coordinator = await ethers.getContractFactory("MockVRFCoordinatorV2Plus");
    const coordinator = await Coordinator.deploy();

    const PvPArenaFactory = await ethers.getContractFactory("PvPArena");
    const arena = await PvPArenaFactory.deploy(
      treasury.address,
      await coordinator.getAddress(),
      KEY_HASH,
      1,
      250_000,
      3
    );

    return { arena, coordinator, owner, playerA, playerB, playerC, treasury };
  }

  it("creates a room and locks playerA bet correctly", async function () {
    const { arena, playerA } = await deployFixture();

    const tx = await arena.connect(playerA).createRoom(0, { value: MIN_BET });
    await expect(tx).to.emit(arena, "RoomCreated").withArgs(1, playerA.address, MIN_BET, 0);

    const room = await arena.rooms(1);
    expect(room.playerA).to.equal(playerA.address);
    expect(room.playerB).to.equal(ethers.ZeroAddress);
    expect(room.betAmount).to.equal(MIN_BET);
    expect(room.choiceA).to.equal(0);
    expect(room.status).to.equal(0); // RoomStatus.OPEN
    expect(await arena.playerActiveRoom(playerA.address)).to.equal(1);
  });

  it("cancels an open room and refunds playerA", async function () {
    const { arena, playerA } = await deployFixture();

    await arena.connect(playerA).createRoom(0, { value: MIN_BET });
    const initialBal = await ethers.provider.getBalance(playerA.address);

    const cancelTx = await arena.connect(playerA).cancelRoom(1);
    await expect(cancelTx).to.emit(arena, "RoomCancelled").withArgs(1, playerA.address, MIN_BET);

    const room = await arena.rooms(1);
    expect(room.status).to.equal(3); // RoomStatus.CANCELLED
    expect(await arena.playerActiveRoom(playerA.address)).to.equal(0);
  });

  it("reverts if a non-creator tries to cancel an open room", async function () {
    const { arena, playerA, playerB } = await deployFixture();

    await arena.connect(playerA).createRoom(0, { value: MIN_BET });
    await expect(arena.connect(playerB).cancelRoom(1)).to.be.revertedWithCustomError(
      arena,
      "OnlyCreatorCanCancel"
    );
  });

  it("joins a room, triggers VRF, and pays 98% to winner and 2% rake to treasury", async function () {
    const { arena, coordinator, playerA, playerB, treasury } = await deployFixture();

    // Player A picks 0 (Heads)
    await arena.connect(playerA).createRoom(0, { value: MIN_BET });

    // Player B matches bet
    const joinTx = await arena.connect(playerB).joinRoom(1, { value: MIN_BET });
    await expect(joinTx).to.emit(arena, "RoomJoined").withArgs(1, playerB.address, 1);

    const roomMatched = await arena.rooms(1);
    expect(roomMatched.status).to.equal(1); // MATCHED
    expect(roomMatched.playerB).to.equal(playerB.address);

    const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
    const playerABalBefore = await ethers.provider.getBalance(playerA.address);

    // VRF fulfills with randomWord = 0 (Outcome 0 -> Player A wins!)
    // Total pot = 0.002 ETH, Rake 2% = 0.00004 ETH, Payout 98% = 0.00196 ETH
    const expectedRake = (MIN_BET * 2n * 200n) / 10_000n;
    const expectedPayout = MIN_BET * 2n - expectedRake;

    const fulfillTx = await coordinator.fulfill(1, 0);
    await expect(fulfillTx)
      .to.emit(arena, "RoomSettled")
      .withArgs(1, playerA.address, playerB.address, expectedPayout, expectedRake, 0);

    const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
    const playerABalAfter = await ethers.provider.getBalance(playerA.address);

    expect(treasuryBalAfter - treasuryBalBefore).to.equal(expectedRake);
    expect(playerABalAfter - playerABalBefore).to.equal(expectedPayout);

    const settledRoom = await arena.rooms(1);
    expect(settledRoom.status).to.equal(2); // SETTLED
    expect(settledRoom.winner).to.equal(playerA.address);
    expect(await arena.playerActiveRoom(playerA.address)).to.equal(0);
    expect(await arena.playerActiveRoom(playerB.address)).to.equal(0);
  });

  it("correctly pays playerB when outcome is Tails (1)", async function () {
    const { arena, coordinator, playerA, playerB, treasury } = await deployFixture();

    // Player A picks 0 (Heads), so Player B wins if outcome is 1 (Tails)
    await arena.connect(playerA).createRoom(0, { value: MIN_BET });
    await arena.connect(playerB).joinRoom(1, { value: MIN_BET });

    const playerBBalBefore = await ethers.provider.getBalance(playerB.address);
    const expectedRake = (MIN_BET * 2n * 200n) / 10_000n;
    const expectedPayout = MIN_BET * 2n - expectedRake;

    // VRF fulfills with 1 -> Outcome 1 (Tails) -> Player B wins!
    await coordinator.fulfill(1, 1);

    const playerBBalAfter = await ethers.provider.getBalance(playerB.address);
    expect(playerBBalAfter - playerBBalBefore).to.equal(expectedPayout);
  });

  it("handles timeout refund after 60 blocks if VRF fails to callback", async function () {
    const { arena, playerA, playerB } = await deployFixture();

    await arena.connect(playerA).createRoom(0, { value: MIN_BET });
    await arena.connect(playerB).joinRoom(1, { value: MIN_BET });

    // Try claiming timeout before 60 blocks -> revert
    await expect(arena.connect(playerA).claimTimeout(1)).to.be.revertedWithCustomError(
      arena,
      "TimeoutNotReached"
    );

    // Mine 61 blocks
    for (let i = 0; i < 62; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    const playerABalBefore = await ethers.provider.getBalance(playerA.address);
    const tx = await arena.connect(playerA).claimTimeout(1);
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

    const playerABalAfter = await ethers.provider.getBalance(playerA.address);
    expect(playerABalAfter + gasUsed - playerABalBefore).to.equal(MIN_BET);

    const room = await arena.rooms(1);
    expect(room.status).to.equal(3); // CANCELLED
    expect(await arena.playerActiveRoom(playerA.address)).to.equal(0);
    expect(await arena.playerActiveRoom(playerB.address)).to.equal(0);
  });
});

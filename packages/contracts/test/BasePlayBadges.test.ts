import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { BasePlayBadges } from "../typechain-types";

describe("BasePlayBadges", () => {
  let badges: BasePlayBadges;
  let owner: HardhatEthersSigner;
  let signer: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const baseURI = "https://baseplay.app/api/badges/";

  async function getClaimSignature(
    contractAddress: string,
    playerAddress: string,
    tokenId: number,
    deadline: number,
    signingWallet: HardhatEthersSigner
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
      name: "BasePlay Badges",
      version: "1",
      chainId,
      verifyingContract: contractAddress
    };

    const types = {
      ClaimBadge: [
        { name: "player", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };

    const value = {
      player: playerAddress,
      tokenId,
      deadline
    };

    return signingWallet.signTypedData(domain, types, value);
  }

  async function getBatchClaimSignature(
    contractAddress: string,
    playerAddress: string,
    tokenIds: number[],
    deadline: number,
    signingWallet: HardhatEthersSigner
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
      name: "BasePlay Badges",
      version: "1",
      chainId,
      verifyingContract: contractAddress
    };

    const types = {
      ClaimBadgesBatch: [
        { name: "player", type: "address" },
        { name: "tokenIds", type: "uint256[]" },
        { name: "deadline", type: "uint256" }
      ]
    };

    const value = {
      player: playerAddress,
      tokenIds,
      deadline
    };

    return signingWallet.signTypedData(domain, types, value);
  }

  beforeEach(async () => {
    [owner, signer, player1, player2, attacker] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("BasePlayBadges");
    badges = await factory.deploy(signer.address, baseURI);
    await badges.waitForDeployment();
  });

  describe("Deployment & Configuration", () => {
    it("initializes with correct name, symbol, signer and baseURI", async () => {
      expect(await badges.name()).to.equal("BasePlay Badges");
      expect(await badges.symbol()).to.equal("BPBADGE");
      expect(await badges.trustedSigner()).to.equal(signer.address);
      expect(await badges.soulbound()).to.be.true;
      expect(await badges.uri(1)).to.equal("https://baseplay.app/api/badges/1.json");
    });

    it("allows owner to update baseURI, signer, and soulbound mode", async () => {
      await badges.setURI("https://ipfs.io/ipfs/QmTest/");
      expect(await badges.uri(5)).to.equal("https://ipfs.io/ipfs/QmTest/5.json");

      await badges.setSigner(player2.address);
      expect(await badges.trustedSigner()).to.equal(player2.address);

      await badges.setSoulbound(false);
      expect(await badges.soulbound()).to.be.false;
    });

    it("reverts if non-owner attempts config changes", async () => {
      await expect(
        badges.connect(attacker).setURI("https://attacker.com/")
      ).to.be.revertedWithCustomError(badges, "OwnableUnauthorizedAccount");

      await expect(
        badges.connect(attacker).setSigner(attacker.address)
      ).to.be.revertedWithCustomError(badges, "OwnableUnauthorizedAccount");
    });
  });

  describe("Single Badge Claim", () => {
    it("successfully claims a badge with valid signature", async () => {
      const tokenId = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await getClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenId,
        deadline,
        signer
      );

      await expect(
        badges.connect(player1).claimBadge(tokenId, deadline, signature)
      )
        .to.emit(badges, "BadgeClaimed")
        .withArgs(player1.address, tokenId);

      expect(await badges.balanceOf(player1.address, tokenId)).to.equal(1n);
      expect(await badges.hasClaimed(player1.address, tokenId)).to.be.true;
      expect(await badges.totalMinted(tokenId)).to.equal(1n);
    });

    it("reverts if signature is from unauthorized signer", async () => {
      const tokenId = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const fakeSignature = await getClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenId,
        deadline,
        attacker
      );

      await expect(
        badges.connect(player1).claimBadge(tokenId, deadline, fakeSignature)
      ).to.be.revertedWithCustomError(badges, "InvalidSignature");
    });

    it("reverts on replay attempt (claiming twice)", async () => {
      const tokenId = 2;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await getClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenId,
        deadline,
        signer
      );

      await badges.connect(player1).claimBadge(tokenId, deadline, signature);

      await expect(
        badges.connect(player1).claimBadge(tokenId, deadline, signature)
      ).to.be.revertedWithCustomError(badges, "AlreadyClaimed").withArgs(tokenId);
    });

    it("reverts if signature has expired", async () => {
      const tokenId = 3;
      const expiredDeadline = Math.floor(Date.now() / 1000) - 100;
      const signature = await getClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenId,
        expiredDeadline,
        signer
      );

      await expect(
        badges.connect(player1).claimBadge(tokenId, expiredDeadline, signature)
      ).to.be.revertedWithCustomError(badges, "SignatureExpired");
    });
  });

  describe("Batch Badge Claim", () => {
    it("successfully claims multiple badges in one batch", async () => {
      const tokenIds = [1, 2, 3];
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await getBatchClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenIds,
        deadline,
        signer
      );

      await expect(
        badges.connect(player1).claimBadgesBatch(tokenIds, deadline, signature)
      )
        .to.emit(badges, "BadgesClaimedBatch")
        .withArgs(player1.address, tokenIds);

      for (const tid of tokenIds) {
        expect(await badges.balanceOf(player1.address, tid)).to.equal(1n);
        expect(await badges.hasClaimed(player1.address, tid)).to.be.true;
      }
    });

    it("reverts if empty batch is provided", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await getBatchClaimSignature(
        await badges.getAddress(),
        player1.address,
        [],
        deadline,
        signer
      );

      await expect(
        badges.connect(player1).claimBadgesBatch([], deadline, signature)
      ).to.be.revertedWithCustomError(badges, "EmptyBatch");
    });
  });

  describe("Soulbound Enforcement & Admin Mint", () => {
    it("reverts player-to-player transfer when soulbound is active", async () => {
      const tokenId = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await getClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenId,
        deadline,
        signer
      );

      await badges.connect(player1).claimBadge(tokenId, deadline, signature);

      await expect(
        badges
          .connect(player1)
          .safeTransferFrom(player1.address, player2.address, tokenId, 1, "0x")
      ).to.be.revertedWithCustomError(badges, "SoulboundTransferDisabled");
    });

    it("allows player-to-player transfer when soulbound is disabled", async () => {
      await badges.setSoulbound(false);

      const tokenId = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await getClaimSignature(
        await badges.getAddress(),
        player1.address,
        tokenId,
        deadline,
        signer
      );

      await badges.connect(player1).claimBadge(tokenId, deadline, signature);

      await badges
        .connect(player1)
        .safeTransferFrom(player1.address, player2.address, tokenId, 1, "0x");

      expect(await badges.balanceOf(player2.address, tokenId)).to.equal(1n);
      expect(await badges.balanceOf(player1.address, tokenId)).to.equal(0n);
    });

    it("allows admin direct mint", async () => {
      await badges.adminMint(player2.address, 10);
      expect(await badges.balanceOf(player2.address, 10)).to.equal(1n);
      expect(await badges.hasClaimed(player2.address, 10)).to.be.true;
    });
  });
});

import { ethers } from "hardhat";

const HOUSE_EDGE_BPS = 500;
const BET = 1;
const GRID_SIZE = 25;

interface Result {
  game: string;
  rounds: number;
  wins: number;
  wagered: number;
  paid: number;
}

function net(gross: number) {
  return gross - (gross * HOUSE_EDGE_BPS) / 10_000;
}

function finalize(game: string, grossPayouts: number[]): Result {
  return {
    game,
    rounds: grossPayouts.length,
    wins: grossPayouts.filter((value) => value > 0).length,
    wagered: grossPayouts.length * BET,
    paid: grossPayouts.reduce((sum, gross) => sum + net(gross), 0)
  };
}

function word(index: number, salt: string) {
  return BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "string"], [index, salt])));
}

function crashPoint(seed: bigint) {
  const scale = 1_000_000n;
  const roll = seed % scale;
  const point = (100n * scale) / (scale - roll);
  return Number(point < 100n ? 100n : point);
}

function placeMines(seed: bigint, count: number) {
  const mines = new Set<number>();
  let nonce = 0;
  while (mines.size < count) {
    const position = Number(BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [seed, nonce]))) % BigInt(GRID_SIZE));
    mines.add(position);
    nonce++;
  }
  return mines;
}

function minesMultiplier(mineCount: number, revealedCount: number) {
  const safeCells = GRID_SIZE - mineCount;
  let multiplier = 1;
  for (let i = 0; i < revealedCount; i++) {
    multiplier *= (GRID_SIZE - i) / (safeCells - i);
  }
  return Math.min(multiplier, 20);
}

function simulate(rounds: number) {
  const revealCells = [2, 7, 11];
  const mineCount = 3;
  const hiloCurrentCard = 7;
  const hiloChoiceHigher = true;
  const hiloWinCards = 13 - hiloCurrentCard;
  const hiloMultiplier = Math.min(13 / hiloWinCards, 8);

  const results: Result[] = [];

  results.push(finalize("coin-flip", Array.from({ length: rounds }, (_, index) => (word(index, "coin") % 2n === 0n ? 2 : 0))));
  results.push(finalize("dice", Array.from({ length: rounds }, (_, index) => (Number(word(index, "dice") % 6n) + 1 === 3 ? 6 : 0))));
  results.push(finalize("crash-2.50x", Array.from({ length: rounds }, (_, index) => (crashPoint(word(index, "crash")) >= 250 ? 2.5 : 0))));
  results.push(
    finalize(
      "mines-3x3",
      Array.from({ length: rounds }, (_, index) => {
        const mines = placeMines(word(index, "mines"), mineCount);
        const won = revealCells.every((cell) => !mines.has(cell));
        return won ? minesMultiplier(mineCount, revealCells.length) : 0;
      })
    )
  );
  results.push(
    finalize(
      "hilo-7-higher",
      Array.from({ length: rounds }, (_, index) => {
        const nextCard = Number(word(index, "hilo") % 13n) + 1;
        const won = hiloChoiceHigher ? nextCard > hiloCurrentCard : nextCard < hiloCurrentCard;
        return won ? hiloMultiplier : 0;
      })
    )
  );
  results.push(finalize("over-under-over-60", Array.from({ length: rounds }, (_, index) => {
    const roll = Number(word(index, "over-under") % 100n) + 1;
    return roll > 60 ? 100 / 40 : 0;
  })));
  results.push(finalize("limbo-2.50x", Array.from({ length: rounds }, (_, index) => {
    const roll = Number(word(index, "limbo") % 1_000_000n);
    const threshold = Math.floor((1_000_000 * 10_000) / 25_000);
    return roll < threshold ? 2.5 : 0;
  })));
  results.push(finalize("wheel-high", Array.from({ length: rounds }, (_, index) => {
    const segment = Number(word(index, "wheel") % 16n);
    if (segment < 12) return 0;
    if (segment < 14) return 2;
    if (segment === 14) return 4;
    return 8;
  })));
  results.push(finalize("plinko-lite-medium", Array.from({ length: rounds }, (_, index) => {
    const bits = Number(word(index, "plinko") & 0xffn);
    let slot = 0;
    for (let bit = 0; bit < 8; bit++) {
      if ((bits & (1 << bit)) !== 0) slot++;
    }
    const table = [20, 4, 1.23, 0.63, 0.23, 0.63, 1.23, 4, 20];
    return table[slot] ?? 0;
  })));
  results.push(finalize("color-pick", Array.from({ length: rounds }, (_, index) => (Number(word(index, "color") % 4n) === 2 ? 4 : 0))));
  results.push(finalize("treasure-chest", Array.from({ length: rounds }, (_, index) => (Number(word(index, "chest") % 9n) === 4 ? 9 : 0))));
  results.push(finalize("lucky-seven-exact", Array.from({ length: rounds }, (_, index) => {
    const seed = word(index, "lucky-seven");
    const a = Number(seed % 6n) + 1;
    const b = Number((seed / 6n) % 6n) + 1;
    return a + b === 7 ? 6 : 0;
  })));
  results.push(finalize("roulette-lite-exact-7", Array.from({ length: rounds }, (_, index) => (Number(word(index, "roulette") % 12n) === 7 ? 12 : 0))));
  results.push(finalize("scratch-card", Array.from({ length: rounds }, (_, index) => {
    const roll = Number(word(index, "scratch") % 1000n);
    if (roll < 1) return 30;
    if (roll < 13) return 10;
    if (roll < 113) return 4;
    if (roll < 338) return 2;
    return 0;
  })));
  results.push(finalize("rock-paper-scissors", Array.from({ length: rounds }, (_, index) => {
    const playerMove = 0;
    const seed = word(index, "rps");
    let houseMove = Number(seed % 3n);
    if (houseMove === playerMove) {
      const offset = Number((seed / 3n) % 2n) + 1;
      houseMove = (playerMove + offset) % 3;
    }
    return houseMove === 2 ? 2 : 0;
  })));
  results.push(finalize("slots", Array.from({ length: rounds }, (_, index) => {
    const seed = word(index, "slots");
    const reelA = Number(seed % 6n);
    const reelB = Number((seed / 6n) % 6n);
    const reelC = Number((seed / 36n) % 6n);
    if (reelA === reelB && reelB === reelC) return reelA === 0 ? 25 : 12;
    if (reelA === reelB || reelA === reelC || reelB === reelC) return 1.45;
    return 0;
  })));

  return results.map((result) => ({
    game: result.game,
    rounds: result.rounds,
    winRatePct: Number(((result.wins / result.rounds) * 100).toFixed(2)),
    playerRtpPct: Number(((result.paid / result.wagered) * 100).toFixed(2)),
    vaultProfitPct: Number((((result.wagered - result.paid) / result.wagered) * 100).toFixed(2))
  }));
}

async function main() {
  console.log(JSON.stringify({ smoke100: simulate(100), stable10000: simulate(10_000) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

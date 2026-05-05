export const DEFAULT_HOUSE_EDGE_BPS = 300;

export function netPayoutFromGross(grossPayoutEth: number, houseEdgeBps = DEFAULT_HOUSE_EDGE_BPS) {
  if (!Number.isFinite(grossPayoutEth) || grossPayoutEth <= 0) return 0;
  return grossPayoutEth - (grossPayoutEth * houseEdgeBps) / 10_000;
}

export function vaultProfitFromRound(betAmountEth: number, netPayoutEth: number) {
  const bet = Number.isFinite(betAmountEth) ? betAmountEth : 0;
  const payout = Number.isFinite(netPayoutEth) ? netPayoutEth : 0;
  return bet - payout;
}

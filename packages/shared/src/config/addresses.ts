export const CONTRACT_ADDRESSES: Record<number, Record<string, `0x${string}`>> = {
  "8453": {
    "GameVault": "0x9690226283942203e1580bdf3c3b0e9f26b3820f" as `0x${string}`,
    "GameVaultV2": "0x9690226283942203e1580bdf3c3b0e9f26b3820f" as `0x${string}`,
    "CoinFlipGame": "0x40983083bce51b7d36f17ab8a84a0ad078430f5b" as `0x${string}`,
    "DiceGame": "0x9b7de1b6048d5520ecf83190a356afce3d768d94" as `0x${string}`,
    "CrashGame": "0x9632631d8fb4afeb48bee8c70f9652d1d16cc865" as `0x${string}`,
    "MinesGame": "0x631347ae0178b14e216ed11b9559e334657063b4" as `0x${string}`,
    "HiLoGame": "0x321c981c56a2914027522963c537295df2b24ad8" as `0x${string}`,
    "OverUnderGame": "0x4905dab331607902b2f921d0295a65fe15c47d48" as `0x${string}`,
    "LimboGame": "0x805e6206b52cd33be2992e954d7f9d0e60698588" as `0x${string}`,
    "WheelGame": "0xefb9663863b8ac97ca049782ed83bbe93c1aad25" as `0x${string}`,
    "PlinkoLiteGame": "0x6ad2290f69033e0592b02093f58f271653de88c2" as `0x${string}`,
    "ColorPickGame": "0x522fa3265d077b34572e088748164529641fa5fc" as `0x${string}`,
    "TreasureChestGame": "0x11ec51f2eca6048fb0fd5fdb5ce4d61544cf3845" as `0x${string}`,
    "LuckySevenGame": "0x7117ea3d43d6175ea30deea6206d8aa2ce157216" as `0x${string}`,
    "RouletteLiteGame": "0x6f3f319e2cfe256aacf573d035cdb06c6ff7dd5c" as `0x${string}`,
    "ScratchCardGame": "0x2d1178376eb23053b5474ebad8437fc2018ee469" as `0x${string}`,
    "RockPaperScissorsGame": "0x40cc80d6a4f14d958c692998d9279d8e6aac8eeb" as `0x${string}`,
    "SlotsGame": "0x89290afe9f2b11d482d2684ce1d299da58b05c7a" as `0x${string}`,
    "LuckyDraw": "0x9b4b322302C1EA7E6e9f0d26F7F1a647E5D8185A" as `0x${string}`,
    "BasePlayBadges": "0x1Ca9E82eBA7967295C3D77404af639B592C268eD" as `0x${string}`,
    "PvPArena": "0x0965A9ACc1f300E60179057D7eEA20967731b8F5" as `0x${string}`
  }
};

export function getContractAddress(chainId: number, name: string): `0x${string}` {
  const address = CONTRACT_ADDRESSES[chainId]?.[name];
  if (!address) {
    throw new Error(`Contract "${name}" not found for chainId ${chainId}`);
  }
  return address;
}

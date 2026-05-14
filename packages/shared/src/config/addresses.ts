export const CONTRACT_ADDRESSES: Record<number, Record<string, `0x${string}`>> = {
  8453: {
    GameVault: "0x9690226283942203e1580bdf3c3b0e9f26b3820f",
    GameVaultV2: "0x9690226283942203e1580bdf3c3b0e9f26b3820f",
    CoinFlipGame: "0x40983083bce51b7d36f17ab8a84a0ad078430f5b",
    DiceGame: "0x9b7de1b6048d5520ecf83190a356afce3d768d94",
    CrashGame: "0x9632631d8fb4afeb48bee8c70f9652d1d16cc865",
    MinesGame: "0x631347ae0178b14e216ed11b9559e334657063b4",
    HiLoGame: "0x321c981c56a2914027522963c537295df2b24ad8",
    OverUnderGame: "0x4905dab331607902b2f921d0295a65fe15c47d48",
    LimboGame: "0x805e6206b52cd33be2992e954d7f9d0e60698588",
    WheelGame: "0xefb9663863b8ac97ca049782ed83bbe93c1aad25",
    PlinkoLiteGame: "0x6ad2290f69033e0592b02093f58f271653de88c2",
    ColorPickGame: "0x522fa3265d077b34572e088748164529641fa5fc",
    TreasureChestGame: "0x11ec51f2eca6048fb0fd5fdb5ce4d61544cf3845",
    LuckySevenGame: "0x7117ea3d43d6175ea30deea6206d8aa2ce157216",
    RouletteLiteGame: "0x6f3f319e2cfe256aacf573d035cdb06c6ff7dd5c",
    ScratchCardGame: "0x2d1178376eb23053b5474ebad8437fc2018ee469",
    RockPaperScissorsGame: "0x40cc80d6a4f14d958c692998d9279d8e6aac8eeb",
    SlotsGame: "0x89290afe9f2b11d482d2684ce1d299da58b05c7a",
    LuckyDraw: "0x9b4b322302C1EA7E6e9f0d26F7F1a647E5D8185A"
  }
};

export function getContractAddress(chainId: number, name: string): `0x${string}` {
  const address = CONTRACT_ADDRESSES[chainId]?.[name];
  if (!address) {
    throw new Error(`Contract "${name}" not found for chainId ${chainId}`);
  }
  return address;
}

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
    SlotsGame: "0x89290afe9f2b11d482d2684ce1d299da58b05c7a"
  },
  84532: {
    GameVault: "0x3f82c3435d24dD723C9361517C0818672380ba91",
    CoinFlipGame: "0xdD69B92f6fAE6da3825b7d126Fe058e78E7F8482",
    DiceGame: "0x0DF136b94f99CAfcC010723b51f8D8EC10A0B907",
    CrashGame: "0x631347ae0178B14e216ed11B9559e334657063B4",
    MinesGame: "0x805E6206b52cd33BE2992e954d7f9d0e60698588",
    HiLoGame: "0x522fA3265D077B34572E088748164529641Fa5fc",
    OverUnderGame: "0x4B33c84CdCa6647D75dE93462292edA665c35800",
    LimboGame: "0x5D1e0f56b450cce7133CDb5c67d8ee758c2D6Bb8",
    WheelGame: "0x19BeE74068d18cF357798D36Dc2Ddc3e8D053c62",
    PlinkoLiteGame: "0x403597D06A9c28dbFb895fB160ece110F446F00F",
    ColorPickGame: "0x6a400e38066153964f8CF65CFBD00c4cAb1e752D",
    TreasureChestGame: "0xdCb405C7D581C9E53d19aac89B03c21925550aBf",
    LuckySevenGame: "0x1BCeD69DA32fD1272c0172455217aB87e0FFd394",
    RouletteLiteGame: "0x330695936b9A2ADbB3BaF69C526B03B75E372Be8",
    ScratchCardGame: "0xA9868B0511726522Ddf463489B51B7B7dC9Cd235",
    RockPaperScissorsGame: "0x40983083BcE51b7d36F17Ab8a84A0Ad078430F5b",
    SlotsGame: "0x6f3F319E2cfe256aaCf573D035CDB06c6fF7dd5C"
  }
};

export function getContractAddress(chainId: number, name: string): `0x${string}` {
  const address = CONTRACT_ADDRESSES[chainId]?.[name];
  if (!address) {
    throw new Error(`Contract "${name}" not found for chainId ${chainId}`);
  }
  return address;
}

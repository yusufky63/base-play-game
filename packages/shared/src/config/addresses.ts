export const CONTRACT_ADDRESSES: Record<number, Record<string, `0x${string}`>> = {
  8453: {},
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

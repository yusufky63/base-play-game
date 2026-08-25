import { NextResponse } from "next/server";

const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
const FALLBACK_PRICE = 2400;

export async function GET() {
  try {
    const response = await fetch(PRICE_URL, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      return NextResponse.json({ price: FALLBACK_PRICE }, { status: 200 });
    }

    const data = (await response.json()) as { ethereum?: { usd?: number } };
    const price = data.ethereum?.usd;
    return NextResponse.json({ price: Number.isFinite(price) ? price : FALLBACK_PRICE });
  } catch {
    return NextResponse.json({ price: FALLBACK_PRICE }, { status: 200 });
  }
}

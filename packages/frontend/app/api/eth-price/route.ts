import { NextResponse } from "next/server";

const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

export async function GET() {
  try {
    const response = await fetch(PRICE_URL, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      return NextResponse.json({ price: null }, { status: 200 });
    }

    const data = (await response.json()) as { ethereum?: { usd?: number } };
    const price = data.ethereum?.usd;
    return NextResponse.json({ price: Number.isFinite(price) ? price : null });
  } catch {
    return NextResponse.json({ price: null }, { status: 200 });
  }
}

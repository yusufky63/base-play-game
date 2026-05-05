import { LiveFeedPageClient } from "@/components/game/LiveFeedPageClient";

export default async function LiveFeedPage({ searchParams }: { searchParams?: Promise<{ game?: string }> }) {
  const params = await searchParams;
  return <LiveFeedPageClient initialGame={params?.game ?? "all"} />;
}

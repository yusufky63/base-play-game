import { notFound } from "next/navigation";
import { RoundDetailPageClient } from "@/components/rounds/RoundDetailPageClient";

export default async function RoundDetailPage({
  params
}: {
  params: Promise<{ chainId: string; requestId: string }>;
}) {
  const { chainId, requestId } = await params;
  const parsedChainId = Number(chainId);

  if (!Number.isInteger(parsedChainId) || !requestId) {
    notFound();
  }

  return <RoundDetailPageClient chainId={parsedChainId} requestId={requestId} />;
}

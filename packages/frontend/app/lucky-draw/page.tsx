import type { Metadata } from "next";
import { LuckyDrawPageClient } from "@/components/lucky-draw/LuckyDrawPageClient";

export const metadata: Metadata = {
  title: "Lucky Draw | BasePlay",
  description: "Open BasePlay Lucky Draw rewards and view public on-chain reward history."
};

export default function LuckyDrawPage() {
  return <LuckyDrawPageClient />;
}

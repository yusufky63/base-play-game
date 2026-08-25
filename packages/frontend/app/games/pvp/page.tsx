import { Suspense } from "react";
import { PvPArenaClient } from "@/games/pvp/PvPArenaClient";

export default function PvPArenaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400">Loading PvP Arena...</div>}>
      <PvPArenaClient />
    </Suspense>
  );
}

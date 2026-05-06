import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { AdminGameAnalytics } from "@/components/admin/AdminGameAnalytics";
import { AdminHealthPanel } from "@/components/admin/AdminHealthPanel";
import { AdminMetric, AdminShell } from "@/components/admin/AdminShell";
import { frontendEnvStatus } from "@/lib/env";
import { getDefaultNetworkConfig } from "@/lib/networkConfig";

const defaultNetwork = getDefaultNetworkConfig();
const deployedGameNames = new Set(Object.keys(CONTRACT_ADDRESSES[defaultNetwork.chainId] ?? {}));
const deployedGames = GAMES_REGISTRY.filter((game) => game.active && deployedGameNames.has(game.contractName));

export default function AdminPage() {
  return (
    <AdminShell title="Admin Dashboard" description={`Operational overview for BasePlay ${defaultNetwork.network.name} rounds, vault health, and realtime services.`}>
      <div className="grid gap-3 md:grid-cols-3">
        <AdminMetric label="Active games" value={String(deployedGames.length)} detail={deployedGames.map((game) => game.name).join(", ") || "No deployed games"} />
        <AdminMetric label="Network" value={String(defaultNetwork.chainId)} detail={`${defaultNetwork.network.name} is the configured production target`} />
        <AdminMetric label="Realtime" value={frontendEnvStatus.supabaseReady ? "Ready" : "Not configured"} detail="Requires Supabase anon key in env" />
      </div>
      <AdminHealthPanel />
      <AdminGameAnalytics />
    </AdminShell>
  );
}

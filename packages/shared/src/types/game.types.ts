export interface GameConfig {
  id: string;
  name: string;
  description: string;
  path: string;
  contractName: string;
  minBetEth: string;
  maxBetEth: string;
  houseEdgePercent: number;
  maxMultiplier: number;
  active: boolean;
  chains: string[];
  requiresWebSocket: boolean;
  tags: string[];
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          wallet_address: string;
          username: string | null;
          avatar_seed: string;
          referral_code: string;
          referrer: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["players"]["Row"]> & { wallet_address: string };
        Update: Partial<Database["public"]["Tables"]["players"]["Row"]>;
        Relationships: [];
      };
      game_rounds: {
        Row: {
          id: string;
          tx_hash: string | null;
          vrf_request_id: string | null;
          player: string;
          game_id: string;
          chain_id: number;
          bet_amount: number;
          payout: number;
          multiplier: number | null;
          xp_earned: number;
          won: boolean;
          settled_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["game_rounds"]["Row"]> &
          Pick<Database["public"]["Tables"]["game_rounds"]["Row"], "player" | "game_id" | "chain_id" | "bet_amount" | "won">;
        Update: Partial<Database["public"]["Tables"]["game_rounds"]["Row"]>;
        Relationships: [];
      };
      leaderboard_weekly: {
        Row: {
          id: string;
          player: string;
          week_start: string;
          game_count: number;
          total_wagered: number;
          net_profit: number;
          biggest_win: number;
          xp: number;
          level: number;
          current_streak: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leaderboard_weekly"]["Row"]> &
          Pick<Database["public"]["Tables"]["leaderboard_weekly"]["Row"], "player" | "week_start">;
        Update: Partial<Database["public"]["Tables"]["leaderboard_weekly"]["Row"]>;
        Relationships: [];
      };
      player_stats: {
        Row: {
          player: string;
          lifetime_xp: number;
          level: number;
          current_streak: number;
          longest_streak: number;
          last_played_on: string | null;
          total_rounds: number;
          total_wagered: number;
          net_profit: number;
          biggest_win: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["player_stats"]["Row"]> & { player: string };
        Update: Partial<Database["public"]["Tables"]["player_stats"]["Row"]>;
        Relationships: [];
      };
      platform_stats: {
        Row: {
          id: number;
          total_rounds: number;
          total_players: number;
          total_wagered: number;
          total_payout: number;
          net_profit: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["platform_stats"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["platform_stats"]["Row"]>;
        Relationships: [];
      };
      game_stats: {
        Row: {
          game_id: string;
          chain_id: number;
          total_rounds: number;
          total_players: number;
          total_wagered: number;
          total_payout: number;
          net_profit: number;
          wins: number;
          losses: number;
          biggest_win: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["game_stats"]["Row"]> &
          Pick<Database["public"]["Tables"]["game_stats"]["Row"], "game_id" | "chain_id">;
        Update: Partial<Database["public"]["Tables"]["game_stats"]["Row"]>;
        Relationships: [];
      };
      player_game_stats: {
        Row: {
          player: string;
          game_id: string;
          chain_id: number;
          total_rounds: number;
          wins: number;
          losses: number;
          total_wagered: number;
          total_payout: number;
          net_profit: number;
          biggest_win: number;
          last_played_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["player_game_stats"]["Row"]> &
          Pick<Database["public"]["Tables"]["player_game_stats"]["Row"], "player" | "game_id" | "chain_id">;
        Update: Partial<Database["public"]["Tables"]["player_game_stats"]["Row"]>;
        Relationships: [];
      };
      game_configs: {
        Row: {
          game_id: string;
          chain_id: number;
          contract_address: string;
          is_active: boolean;
          min_bet_eth: number | null;
          max_bet_eth: number | null;
          house_edge_pct: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["game_configs"]["Row"]> &
          Pick<Database["public"]["Tables"]["game_configs"]["Row"], "game_id" | "chain_id" | "contract_address">;
        Update: Partial<Database["public"]["Tables"]["game_configs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      leaderboard_weekly_ranked: {
        Row: Database["public"]["Tables"]["leaderboard_weekly"]["Row"] & {
          xp_rank: number;
          profit_rank: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

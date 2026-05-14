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
      round_events: {
        Row: {
          id: string;
          vrf_request_id: string;
          event_name: string;
          tx_hash: string | null;
          block_number: number | null;
          log_index: number;
          player: string | null;
          game_id: string;
          chain_id: number;
          contract_address: string;
          args: Json;
          observed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["round_events"]["Row"]> &
          Pick<Database["public"]["Tables"]["round_events"]["Row"], "vrf_request_id" | "event_name" | "game_id" | "chain_id" | "contract_address">;
        Update: Partial<Database["public"]["Tables"]["round_events"]["Row"]>;
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
      indexer_state: {
        Row: {
          chain_id: number;
          game_id: string;
          last_indexed_block: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["indexer_state"]["Row"]> &
          Pick<Database["public"]["Tables"]["indexer_state"]["Row"], "chain_id" | "game_id">;
        Update: Partial<Database["public"]["Tables"]["indexer_state"]["Row"]>;
        Relationships: [];
      };
      referral_codes: {
        Row: {
          player: string;
          code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["referral_codes"]["Row"]> & { player: string };
        Update: Partial<Database["public"]["Tables"]["referral_codes"]["Row"]>;
        Relationships: [];
      };
      player_referrals: {
        Row: {
          referred_player: string;
          referrer_player: string;
          referral_code: string | null;
          source: string;
          claimed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["player_referrals"]["Row"]> &
          Pick<Database["public"]["Tables"]["player_referrals"]["Row"], "referred_player" | "referrer_player">;
        Update: Partial<Database["public"]["Tables"]["player_referrals"]["Row"]>;
        Relationships: [];
      };
      referral_rewards: {
        Row: {
          id: string;
          referrer_player: string;
          referred_player: string;
          round_id: string;
          xp_awarded: number;
          reward_day: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["referral_rewards"]["Row"]> &
          Pick<Database["public"]["Tables"]["referral_rewards"]["Row"], "referrer_player" | "referred_player" | "round_id" | "xp_awarded" | "reward_day">;
        Update: Partial<Database["public"]["Tables"]["referral_rewards"]["Row"]>;
        Relationships: [];
      };
      quest_definitions: {
        Row: {
          id: string;
          title: string;
          description: string;
          period: "daily" | "weekly";
          metric: string;
          target: number;
          reward_xp: number;
          badge_id: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["quest_definitions"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["quest_definitions"]["Row"]>;
        Relationships: [];
      };
      player_quest_progress: {
        Row: {
          player: string;
          quest_id: string;
          period_start: string;
          progress: number;
          completed: boolean;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["player_quest_progress"]["Row"]> &
          Pick<Database["public"]["Tables"]["player_quest_progress"]["Row"], "player" | "quest_id" | "period_start">;
        Update: Partial<Database["public"]["Tables"]["player_quest_progress"]["Row"]>;
        Relationships: [];
      };
      badge_definitions: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          token_id: number | null;
          metadata_uri: string | null;
          mint_ready: boolean;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["badge_definitions"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["badge_definitions"]["Row"]>;
        Relationships: [];
      };
      player_badges: {
        Row: {
          player: string;
          badge_id: string;
          source: string;
          awarded_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["player_badges"]["Row"]> &
          Pick<Database["public"]["Tables"]["player_badges"]["Row"], "player" | "badge_id">;
        Update: Partial<Database["public"]["Tables"]["player_badges"]["Row"]>;
        Relationships: [];
      };
      lucky_draw_config: {
        Row: {
          id: number;
          enabled: boolean;
          rounds_required: number;
          min_bet_eth: number;
          eth_usd_reference: number;
          prize_table: Json;
          paused_reason: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lucky_draw_config"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["lucky_draw_config"]["Row"]>;
        Relationships: [];
      };
      lucky_draw_progress: {
        Row: {
          player: string;
          qualified_rounds: number;
          available_draws: number;
          lifetime_draws_earned: number;
          lifetime_draws_claimed: number;
          total_prize_eth: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lucky_draw_progress"]["Row"]> & { player: string };
        Update: Partial<Database["public"]["Tables"]["lucky_draw_progress"]["Row"]>;
        Relationships: [];
      };
      lucky_draw_rounds: {
        Row: {
          round_id: string;
          player: string;
          game_id: string;
          bet_amount: number;
          counted_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lucky_draw_rounds"]["Row"]> &
          Pick<Database["public"]["Tables"]["lucky_draw_rounds"]["Row"], "round_id" | "player" | "game_id" | "bet_amount">;
        Update: Partial<Database["public"]["Tables"]["lucky_draw_rounds"]["Row"]>;
        Relationships: [];
      };
      lucky_draw_results: {
        Row: {
          id: string;
          player: string;
          prize_usd: number;
          prize_eth: number;
          eth_usd_reference: number;
          status: "claimable" | "paid" | "voided";
          entropy_hash: string;
          client_seed: string | null;
          payout_tx_hash: string | null;
          created_at: string;
          paid_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lucky_draw_results"]["Row"]> &
          Pick<Database["public"]["Tables"]["lucky_draw_results"]["Row"], "player" | "prize_usd" | "prize_eth" | "eth_usd_reference" | "entropy_hash">;
        Update: Partial<Database["public"]["Tables"]["lucky_draw_results"]["Row"]>;
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
      player_quest_summary: {
        Row: Database["public"]["Tables"]["player_quest_progress"]["Row"] & {
          title: string;
          description: string;
          period: "daily" | "weekly";
          metric: string;
          target: number;
          reward_xp: number;
          badge_id: string | null;
          sort_order: number;
        };
        Relationships: [];
      };
      player_badge_summary: {
        Row: Database["public"]["Tables"]["player_badges"]["Row"] & {
          title: string;
          description: string;
          category: string;
          token_id: number | null;
          metadata_uri: string | null;
          mint_ready: boolean;
          sort_order: number;
        };
        Relationships: [];
      };
      player_referral_summary: {
        Row: {
          player: string;
          code: string;
          total_referrals: number;
          active_referrals: number;
          total_referral_xp: number;
          last_reward_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      fn_claim_lucky_draw: {
        Args: {
          p_player: string;
          p_client_seed: string | null;
        };
        Returns: Database["public"]["Tables"]["lucky_draw_results"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

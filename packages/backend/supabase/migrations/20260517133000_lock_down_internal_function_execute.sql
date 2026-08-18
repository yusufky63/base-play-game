-- Keep trigger/internal helpers callable by triggers and service-role code, but not directly through public API roles.
revoke execute on function public.fn_add_player_bonus_xp(text, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_apply_quest_progress(text, text, date, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_assign_round_xp() from public, anon, authenticated;
revoke execute on function public.fn_award_badge(text, text, text) from public, anon, authenticated;
revoke execute on function public.fn_calculate_round_xp(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.fn_update_lucky_draw_progress() from public, anon, authenticated;
revoke execute on function public.fn_update_progression_rewards() from public, anon, authenticated;
revoke execute on function public.fn_xp_level(integer) from public, anon, authenticated;

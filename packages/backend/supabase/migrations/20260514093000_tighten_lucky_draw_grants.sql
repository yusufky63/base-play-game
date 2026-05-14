revoke all on table public.lucky_draw_config from anon, authenticated;
revoke all on table public.lucky_draw_progress from anon, authenticated;
revoke all on table public.lucky_draw_rounds from anon, authenticated;
revoke all on table public.lucky_draw_results from anon, authenticated;

grant select on table public.lucky_draw_config to anon, authenticated;
grant select on table public.lucky_draw_progress to anon, authenticated;
grant select on table public.lucky_draw_results to anon, authenticated;

revoke execute on function public.fn_update_lucky_draw_progress() from anon, authenticated;
revoke execute on function public.fn_claim_lucky_draw(text, text) from anon, authenticated;

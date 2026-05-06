-- XP should represent wager volume, not outcome luck. Wins and losses at the
-- same bet size now earn the same XP, while larger wagers progress faster.
create or replace function public.fn_calculate_round_xp(p_bet_amount numeric, p_won boolean)
returns integer
language sql
immutable
set search_path = public
as $$
  select
    case
      when greatest(p_bet_amount, 0) <= 0 then 0
      else 5 + least(floor(greatest(p_bet_amount, 0) / 0.0001)::integer * 3, 60)
    end;
$$;

revoke execute on function public.fn_calculate_round_xp(numeric, boolean) from anon, authenticated;

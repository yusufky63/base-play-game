create or replace function public.fn_claim_lucky_draw(
  p_player text,
  p_client_seed text
)
returns public.lucky_draw_results
language plpgsql
set search_path = public
as $$
declare
  v_config public.lucky_draw_config%rowtype;
  v_progress public.lucky_draw_progress%rowtype;
  v_entropy bytea := extensions.gen_random_bytes(32);
  v_entropy_hash text := encode(extensions.digest(v_entropy || coalesce(p_client_seed, '')::bytea, 'sha256'), 'hex');
  v_total_weight bigint := 0;
  v_roll bigint;
  v_cursor integer := 0;
  v_prize_usd numeric := 0;
  v_prize_eth numeric := 0;
  v_result public.lucky_draw_results%rowtype;
  v_item jsonb;
  v_weight integer;
begin
  select *
    into v_config
  from public.lucky_draw_config
  where id = 1
  for update;

  if not found or not v_config.enabled then
    raise exception 'Lucky Draw is paused';
  end if;

  select *
    into v_progress
  from public.lucky_draw_progress
  where player = lower(p_player)
  for update;

  if not found or v_progress.available_draws <= 0 then
    raise exception 'No Lucky Draw available';
  end if;

  for v_item in select value from jsonb_array_elements(v_config.prize_table)
  loop
    v_weight := greatest(0, coalesce((v_item->>'weight')::integer, 0));
    v_total_weight := v_total_weight + v_weight;
  end loop;

  if v_total_weight <= 0 then
    raise exception 'Lucky Draw prize table is invalid';
  end if;

  v_roll := mod(
    (
      (get_byte(v_entropy, 0)::bigint << 24) +
      (get_byte(v_entropy, 1)::bigint << 16) +
      (get_byte(v_entropy, 2)::bigint << 8) +
      get_byte(v_entropy, 3)::bigint
    ),
    v_total_weight
  );

  for v_item in select value from jsonb_array_elements(v_config.prize_table)
  loop
    v_weight := greatest(0, coalesce((v_item->>'weight')::integer, 0));
    v_cursor := v_cursor + v_weight;
    if v_roll < v_cursor then
      v_prize_usd := (v_item->>'usd')::numeric;
      exit;
    end if;
  end loop;

  if v_prize_usd <= 0 then
    raise exception 'Lucky Draw prize table did not resolve';
  end if;

  v_prize_eth := round(v_prize_usd / v_config.eth_usd_reference, 12);

  insert into public.lucky_draw_results
    (player, prize_usd, prize_eth, eth_usd_reference, entropy_hash, client_seed)
  values
    (lower(p_player), v_prize_usd, v_prize_eth, v_config.eth_usd_reference, v_entropy_hash, left(coalesce(p_client_seed, ''), 96))
  returning * into v_result;

  update public.lucky_draw_progress
  set
    available_draws = available_draws - 1,
    lifetime_draws_claimed = lifetime_draws_claimed + 1,
    total_prize_eth = total_prize_eth + v_prize_eth,
    updated_at = now()
  where player = lower(p_player);

  return v_result;
end;
$$;

revoke execute on function public.fn_claim_lucky_draw(text, text) from anon, authenticated;

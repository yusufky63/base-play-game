drop function if exists public.fn_claim_lucky_draw(text, text);

comment on table public.lucky_draw_results is
  'Historical off-chain Lucky Draw payout rows. New Lucky Draw claims are resolved by the on-chain LuckyDraw contract with Chainlink VRF.';

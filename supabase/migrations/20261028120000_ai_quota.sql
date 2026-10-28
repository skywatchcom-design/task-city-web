-- SkyTasks AI: usage limits.
-- Every AI request first takes one unit of quota here. Three independent caps:
--   * per user per day   (so one user can't drain the free tier for everyone)
--   * per IP per day     (so a bot opening many accounts is still capped)
--   * global per day     (hard ceiling, kept below the provider's free tier)
-- The day resets at midnight Israel time.
-- The tables have RLS enabled and no policies: only the Edge Function
-- (service role) can read or write them. Users can't touch their counters.

create table if not exists public.ai_usage_user (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

create table if not exists public.ai_usage_ip (
  ip    text not null,
  day   date not null,
  count int  not null default 0,
  primary key (ip, day)
);

create table if not exists public.ai_usage_global (
  day   date primary key,
  count int  not null default 0
);

alter table public.ai_usage_user   enable row level security;
alter table public.ai_usage_ip     enable row level security;
alter table public.ai_usage_global enable row level security;

create or replace function public.ai_take_quota(
  p_user uuid,
  p_ip text,
  p_user_limit int,
  p_ip_limit int,
  p_global_limit int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Jerusalem')::date;
  u int;
  i int;
  g int;
begin
  insert into ai_usage_user (user_id, day, count) values (p_user, d, 1)
  on conflict (user_id, day) do update set count = ai_usage_user.count + 1
  returning count into u;
  if u > p_user_limit then
    return jsonb_build_object('ok', false, 'reason', 'user_limit', 'remaining', 0);
  end if;

  insert into ai_usage_ip (ip, day, count) values (coalesce(p_ip, 'unknown'), d, 1)
  on conflict (ip, day) do update set count = ai_usage_ip.count + 1
  returning count into i;
  if i > p_ip_limit then
    return jsonb_build_object('ok', false, 'reason', 'ip_limit', 'remaining', 0);
  end if;

  insert into ai_usage_global (day, count) values (d, 1)
  on conflict (day) do update set count = ai_usage_global.count + 1
  returning count into g;
  if g > p_global_limit then
    return jsonb_build_object('ok', false, 'reason', 'global_limit', 'remaining', 0);
  end if;

  return jsonb_build_object('ok', true, 'remaining', greatest(p_user_limit - u, 0));
end;
$$;

-- Give the unit back when every provider failed, so users don't lose
-- quota for an answer they never got.
create or replace function public.ai_refund_quota(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update ai_usage_user
     set count = greatest(count - 1, 0)
   where user_id = p_user
     and day = (now() at time zone 'Asia/Jerusalem')::date;
$$;

revoke all on function public.ai_take_quota(uuid, text, int, int, int) from public, anon, authenticated;
revoke all on function public.ai_refund_quota(uuid) from public, anon, authenticated;
grant execute on function public.ai_take_quota(uuid, text, int, int, int) to service_role;
grant execute on function public.ai_refund_quota(uuid) to service_role;

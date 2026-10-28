create table if not exists public.guided_ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.guided_ai_usage enable row level security;

revoke all on public.guided_ai_usage from anon, authenticated;

create or replace function public.claim_guided_ai_request()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_window timestamptz := now();
  next_count integer;
begin
  if current_user_id is null then
    return false;
  end if;

  insert into public.guided_ai_usage (
    user_id,
    window_started_at,
    request_count
  )
  values (current_user_id, current_window, 1)
  on conflict (user_id) do update
  set
    window_started_at = case
      when public.guided_ai_usage.window_started_at < current_window - interval '10 minutes'
        then current_window
      else public.guided_ai_usage.window_started_at
    end,
    request_count = case
      when public.guided_ai_usage.window_started_at < current_window - interval '10 minutes'
        then 1
      else public.guided_ai_usage.request_count + 1
    end
  returning request_count into next_count;

  return next_count <= 20;
end;
$$;

revoke all on function public.claim_guided_ai_request() from public;
grant execute on function public.claim_guided_ai_request() to authenticated;

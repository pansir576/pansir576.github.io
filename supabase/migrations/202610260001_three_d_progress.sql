create table if not exists public.simulating_cook_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_runs integer not null default 0 check (completed_runs >= 0),
  perfect_count integer not null default 0 check (perfect_count >= 0),
  good_count integer not null default 0 check (good_count >= 0),
  ordinary_count integer not null default 0 check (ordinary_count >= 0),
  burnt_count integer not null default 0 check (burnt_count >= 0),
  total_training_seconds integer not null default 0 check (total_training_seconds >= 0),
  last_ingredient_id text,
  last_dish_name text,
  last_grade text check (last_grade in ('perfect', 'good', 'ordinary', 'burnt')),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulating_cook_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_key uuid not null,
  ingredient_id text not null,
  dish_name text not null,
  grade text not null check (grade in ('perfect', 'good', 'ordinary', 'burnt')),
  cookedness numeric not null,
  duration_seconds integer not null check (duration_seconds > 0),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, run_key)
);

create index if not exists simulating_cook_runs_user_created_idx
  on public.simulating_cook_runs (user_id, created_at desc);

alter table public.simulating_cook_progress enable row level security;
alter table public.simulating_cook_runs enable row level security;

drop policy if exists "read own 3d progress" on public.simulating_cook_progress;
create policy "read own 3d progress"
  on public.simulating_cook_progress
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "read own 3d runs" on public.simulating_cook_runs;
create policy "read own 3d runs"
  on public.simulating_cook_runs
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.record_simulating_cook_training(p_run jsonb)
returns table (
  completed_runs integer,
  perfect_count integer,
  good_count integer,
  ordinary_count integer,
  burnt_count integer,
  total_training_seconds integer,
  last_ingredient_id text,
  last_dish_name text,
  last_grade text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_run_id uuid;
  run_grade text := coalesce(p_run->>'grade', '');
  run_ingredient text := coalesce(p_run->>'ingredient_id', '');
  run_dish text := coalesce(p_run->>'dish_name', '');
  run_seconds integer := greatest(
    1,
    least(coalesce((p_run->>'duration_seconds')::integer, 1), 86400)
  );
  run_created_at timestamptz := coalesce(
    (p_run->>'created_at')::timestamptz,
    now()
  );
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if run_grade not in ('perfect', 'good', 'ordinary', 'burnt') then
    raise exception 'INVALID_GRADE';
  end if;
  if run_ingredient = '' or run_dish = '' then
    raise exception 'INVALID_TRAINING_RESULT';
  end if;

  insert into public.simulating_cook_runs (
    user_id,
    run_key,
    ingredient_id,
    dish_name,
    grade,
    cookedness,
    duration_seconds,
    summary,
    created_at
  )
  values (
    current_user_id,
    (p_run->>'run_key')::uuid,
    run_ingredient,
    run_dish,
    run_grade,
    coalesce((p_run->>'cookedness')::numeric, 0),
    run_seconds,
    coalesce(p_run->'summary', '{}'::jsonb),
    run_created_at
  )
  on conflict (user_id, run_key) do nothing
  returning id into inserted_run_id;

  if inserted_run_id is not null then
    insert into public.simulating_cook_progress (
      user_id,
      completed_runs,
      perfect_count,
      good_count,
      ordinary_count,
      burnt_count,
      total_training_seconds,
      last_ingredient_id,
      last_dish_name,
      last_grade,
      updated_at
    )
    values (
      current_user_id,
      1,
      case when run_grade = 'perfect' then 1 else 0 end,
      case when run_grade = 'good' then 1 else 0 end,
      case when run_grade = 'ordinary' then 1 else 0 end,
      case when run_grade = 'burnt' then 1 else 0 end,
      run_seconds,
      run_ingredient,
      run_dish,
      run_grade,
      now()
    )
    on conflict (user_id) do update
    set
      completed_runs = public.simulating_cook_progress.completed_runs + 1,
      perfect_count = public.simulating_cook_progress.perfect_count
        + case when run_grade = 'perfect' then 1 else 0 end,
      good_count = public.simulating_cook_progress.good_count
        + case when run_grade = 'good' then 1 else 0 end,
      ordinary_count = public.simulating_cook_progress.ordinary_count
        + case when run_grade = 'ordinary' then 1 else 0 end,
      burnt_count = public.simulating_cook_progress.burnt_count
        + case when run_grade = 'burnt' then 1 else 0 end,
      total_training_seconds =
        public.simulating_cook_progress.total_training_seconds + run_seconds,
      last_ingredient_id = run_ingredient,
      last_dish_name = run_dish,
      last_grade = run_grade,
      updated_at = now();
  end if;

  return query
  select
    p.completed_runs,
    p.perfect_count,
    p.good_count,
    p.ordinary_count,
    p.burnt_count,
    p.total_training_seconds,
    p.last_ingredient_id,
    p.last_dish_name,
    p.last_grade,
    p.updated_at
  from public.simulating_cook_progress p
  where p.user_id = current_user_id;
end;
$$;

create or replace function public.get_simulating_cook_progress()
returns table (
  completed_runs integer,
  perfect_count integer,
  good_count integer,
  ordinary_count integer,
  burnt_count integer,
  total_training_seconds integer,
  last_ingredient_id text,
  last_dish_name text,
  last_grade text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.completed_runs,
    p.perfect_count,
    p.good_count,
    p.ordinary_count,
    p.burnt_count,
    p.total_training_seconds,
    p.last_ingredient_id,
    p.last_dish_name,
    p.last_grade,
    p.updated_at
  from public.simulating_cook_progress p
  where p.user_id = auth.uid();
$$;

revoke all on public.simulating_cook_progress from anon, authenticated;
revoke all on public.simulating_cook_runs from anon, authenticated;
grant select on public.simulating_cook_progress to authenticated;
grant select on public.simulating_cook_runs to authenticated;

revoke all on function public.record_simulating_cook_training(jsonb) from public;
revoke all on function public.get_simulating_cook_progress() from public;
grant execute on function public.record_simulating_cook_training(jsonb) to authenticated;
grant execute on function public.get_simulating_cook_progress() to authenticated;

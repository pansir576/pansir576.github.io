-- 知味 LAB 厨友交流中心
-- Supabase: Anonymous Auth + Postgres + Realtime + Storage + RLS

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create table if not exists public.community_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 16),
  avatar_color text not null default '#39724b',
  is_admin boolean not null default false,
  banned_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_profiles(id) on delete cascade,
  category text not null check (category in ('question','experience','experiment','chat')),
  title text not null check (char_length(title) between 4 and 80),
  body text not null check (char_length(body) between 10 and 2000),
  tags text[] not null default '{}',
  image_paths text[] not null default '{}',
  experiment_summary jsonb,
  like_count integer not null default 0,
  reply_count integer not null default 0,
  is_hidden boolean not null default false,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.community_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.community_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.community_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','reply','chat')),
  target_id uuid not null,
  target_preview text not null default '',
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  handled_by uuid references public.community_profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table if not exists public.community_rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.community_profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_blocked_terms (
  id bigint generated always as identity primary key,
  term text not null unique
);

insert into public.community_blocked_terms (term) values
  ('代开发票'), ('博彩'), ('赌博'), ('色情'), ('约炮'),
  ('加微信返利'), ('刷单'), ('诈骗')
on conflict do nothing;

create index if not exists community_posts_created_idx
  on public.community_posts (is_hidden, is_pinned desc, created_at desc);
create index if not exists community_replies_post_idx
  on public.community_replies (post_id, created_at);
create index if not exists community_chat_created_idx
  on public.community_chat_messages (created_at desc);
create index if not exists community_reports_status_idx
  on public.community_reports (status, created_at desc);
create index if not exists community_rate_user_idx
  on public.community_rate_events (user_id, action, created_at desc);

create or replace function public.community_is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_profiles
    where id = p_user_id and is_admin = true
  );
$$;

create or replace function public.community_assert_active()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  blocked_until timestamptz;
begin
  if uid is null then
    raise exception '需要登录匿名身份';
  end if;
  select banned_until into blocked_until
  from public.community_profiles where id = uid;
  if blocked_until is not null and blocked_until > now() then
    raise exception '当前身份已被禁言，截止 %', blocked_until;
  end if;
  return uid;
end;
$$;

create or replace function public.community_has_blocked_term(p_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_blocked_terms
    where lower(p_text) like '%' || lower(term) || '%'
  );
$$;

create or replace function public.community_check_rate(
  p_user_id uuid,
  p_action text,
  p_seconds integer,
  p_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.community_rate_events
  where user_id = p_user_id
    and action = p_action
    and created_at > now() - make_interval(secs => p_seconds);
  if recent_count >= p_limit then
    raise exception '操作太频繁，请稍后再试';
  end if;
  insert into public.community_rate_events (user_id, action)
  values (p_user_id, p_action);
end;
$$;

create or replace function public.community_save_profile(
  p_nickname text,
  p_avatar_color text
)
returns public.community_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.community_profiles;
begin
  if uid is null then raise exception '需要匿名身份'; end if;
  if char_length(trim(p_nickname)) not between 2 and 16 then
    raise exception '昵称需要 2–16 个字符';
  end if;
  insert into public.community_profiles (id, nickname, avatar_color)
  values (uid, trim(p_nickname), p_avatar_color)
  on conflict (id) do update
    set nickname = excluded.nickname,
        avatar_color = excluded.avatar_color
    where not community_profiles.is_admin;
  select * into result from public.community_profiles where id = uid;
  return result;
end;
$$;

create or replace function public.community_create_post(
  p_category text,
  p_title text,
  p_body text,
  p_tags text[] default '{}',
  p_image_paths text[] default '{}',
  p_experiment_summary jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.community_assert_active();
  new_id uuid;
begin
  perform public.community_check_rate(uid, 'post', 60, 1);
  if p_category not in ('question','experience','experiment','chat') then
    raise exception '无效分类';
  end if;
  if char_length(trim(p_title)) not between 4 and 80 then
    raise exception '标题需要 4–80 个字符';
  end if;
  if char_length(trim(p_body)) not between 10 and 2000 then
    raise exception '正文需要 10–2000 个字符';
  end if;
  if coalesce(array_length(p_tags, 1), 0) > 5 then
    raise exception '最多 5 个标签';
  end if;
  if coalesce(array_length(p_image_paths, 1), 0) > 3 then
    raise exception '最多 3 张图片';
  end if;
  if public.community_has_blocked_term(coalesce(p_title,'') || ' ' || coalesce(p_body,'')) then
    raise exception '内容包含社区规则禁止的词语';
  end if;
  insert into public.community_posts (
    user_id, category, title, body, tags, image_paths, experiment_summary
  ) values (
    uid, p_category, trim(p_title), trim(p_body), p_tags, p_image_paths, p_experiment_summary
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.community_create_reply(
  p_post_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.community_assert_active();
  new_id uuid;
begin
  perform public.community_check_rate(uid, 'reply', 20, 1);
  if char_length(trim(p_body)) not between 1 and 1000 then
    raise exception '回复不能为空且不能超过 1000 字';
  end if;
  if public.community_has_blocked_term(p_body) then
    raise exception '回复包含社区规则禁止的词语';
  end if;
  if not exists (select 1 from public.community_posts where id = p_post_id and not is_hidden) then
    raise exception '帖子不存在或已隐藏';
  end if;
  insert into public.community_replies (post_id, user_id, body)
  values (p_post_id, uid, trim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.community_send_chat(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.community_assert_active();
  new_id uuid;
begin
  perform public.community_check_rate(uid, 'chat', 10, 5);
  if char_length(trim(p_body)) not between 1 and 300 then
    raise exception '消息不能为空且不能超过 300 字';
  end if;
  if public.community_has_blocked_term(p_body) then
    raise exception '消息包含社区规则禁止的词语';
  end if;
  insert into public.community_chat_messages (user_id, body)
  values (uid, trim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.community_report_content(
  p_target_type text,
  p_target_id uuid,
  p_target_preview text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.community_assert_active();
  new_id uuid;
begin
  if p_target_type not in ('post','reply','chat') then raise exception '无效举报类型'; end if;
  insert into public.community_reports (
    reporter_id, target_type, target_id, target_preview, reason
  ) values (uid, p_target_type, p_target_id, left(p_target_preview,160), left(p_reason,200))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.community_refresh_post_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.post_id, old.post_id);
  update public.community_posts
  set like_count = (select count(*) from public.community_post_likes where post_id = target),
      reply_count = (select count(*) from public.community_replies where post_id = target and not is_hidden)
  where id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_like_count_trigger on public.community_post_likes;
create trigger community_like_count_trigger
after insert or delete on public.community_post_likes
for each row execute function public.community_refresh_post_counts();

drop trigger if exists community_reply_count_trigger on public.community_replies;
create trigger community_reply_count_trigger
after insert or update of is_hidden or delete on public.community_replies
for each row execute function public.community_refresh_post_counts();

create or replace function public.community_admin_resolve_report(
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.community_is_admin() then raise exception '无管理员权限'; end if;
  if p_status not in ('resolved','dismissed') then raise exception '无效状态'; end if;
  update public.community_reports
  set status = p_status, handled_by = auth.uid(), handled_at = now()
  where id = p_report_id;
end;
$$;

create or replace function public.community_admin_moderate_content(
  p_target_type text,
  p_target_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.community_is_admin() then raise exception '无管理员权限'; end if;
  if p_target_type = 'post' then
    if p_action = 'delete' then delete from public.community_posts where id = p_target_id;
    else update public.community_posts set is_hidden = (p_action = 'hide') where id = p_target_id;
    end if;
  elsif p_target_type = 'reply' then
    if p_action = 'delete' then delete from public.community_replies where id = p_target_id;
    else update public.community_replies set is_hidden = (p_action = 'hide') where id = p_target_id;
    end if;
  elsif p_target_type = 'chat' then
    if p_action = 'delete' then delete from public.community_chat_messages where id = p_target_id;
    else update public.community_chat_messages set is_hidden = (p_action = 'hide') where id = p_target_id;
    end if;
  else
    raise exception '无效目标类型';
  end if;
end;
$$;

create or replace function public.community_admin_ban_content_author(
  p_target_type text,
  p_target_id uuid,
  p_hours integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  if not public.community_is_admin() then raise exception '无管理员权限'; end if;
  if p_target_type = 'post' then
    select user_id into author_id from public.community_posts where id = p_target_id;
  elsif p_target_type = 'reply' then
    select user_id into author_id from public.community_replies where id = p_target_id;
  elsif p_target_type = 'chat' then
    select user_id into author_id from public.community_chat_messages where id = p_target_id;
  end if;
  if author_id is null then raise exception '找不到内容作者'; end if;
  update public.community_profiles
  set banned_until = greatest(coalesce(banned_until, now()), now()) + make_interval(hours => p_hours)
  where id = author_id and not is_admin;
end;
$$;

create or replace function public.community_prune_lobby()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.community_chat_messages
  where created_at < now() - interval '24 hours';
  delete from public.community_chat_messages
  where id in (
    select id from public.community_chat_messages
    order by created_at desc offset 500
  );
  delete from public.community_rate_events where created_at < now() - interval '1 day';
$$;

alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_chat_messages enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_rate_events enable row level security;
alter table public.community_blocked_terms enable row level security;

drop policy if exists community_profiles_read on public.community_profiles;
create policy community_profiles_read on public.community_profiles for select using (true);

drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts
for select using (not is_hidden or public.community_is_admin());

drop policy if exists community_posts_delete_own on public.community_posts;
create policy community_posts_delete_own on public.community_posts
for delete using (user_id = auth.uid());

drop policy if exists community_replies_read on public.community_replies;
create policy community_replies_read on public.community_replies
for select using (not is_hidden or public.community_is_admin());

drop policy if exists community_replies_delete_own on public.community_replies;
create policy community_replies_delete_own on public.community_replies
for delete using (user_id = auth.uid());

drop policy if exists community_likes_read on public.community_post_likes;
create policy community_likes_read on public.community_post_likes for select using (true);

drop policy if exists community_likes_insert_own on public.community_post_likes;
create policy community_likes_insert_own on public.community_post_likes
for insert with check (user_id = auth.uid());

drop policy if exists community_likes_delete_own on public.community_post_likes;
create policy community_likes_delete_own on public.community_post_likes
for delete using (user_id = auth.uid());

drop policy if exists community_chat_read on public.community_chat_messages;
create policy community_chat_read on public.community_chat_messages
for select using (not is_hidden or public.community_is_admin());

drop policy if exists community_chat_delete_own on public.community_chat_messages;
create policy community_chat_delete_own on public.community_chat_messages
for delete using (user_id = auth.uid());

drop policy if exists community_reports_admin_read on public.community_reports;
create policy community_reports_admin_read on public.community_reports
for select using (public.community_is_admin() or reporter_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists community_images_read on storage.objects;
create policy community_images_read on storage.objects
for select using (bucket_id = 'community-images');

drop policy if exists community_images_insert_own on storage.objects;
create policy community_images_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists community_images_delete_own on storage.objects;
create policy community_images_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.community_chat_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.community_posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.community_replies;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.community_post_likes;
  exception when duplicate_object then null;
  end;
end $$;

-- 清理任务。若托管项目不允许 pg_cron，请在 Supabase Cron 中每小时调用
-- select public.community_prune_lobby();
select cron.schedule(
  'prune-community-lobby',
  '0 * * * *',
  $$select public.community_prune_lobby();$$
);

-- 솥뚜껑 저녁 모임 참여 후기
-- Supabase SQL Editor에 붙여넣고 Run
-- (여러 번 실행해도 괜찮아요. 이미 있는 후기는 지워지지 않아요.)

create extension if not exists pgcrypto with schema extensions;

-- 후기
create table if not exists public.dinner_reviews (
  id uuid primary key default gen_random_uuid(),
  round_no integer not null check (round_no >= 1),
  author text not null check (char_length(author) between 1 and 20),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists dinner_reviews_round_idx on public.dinner_reviews (round_no, created_at);

-- 참여자 코드 (모든 회차 공통, 암호화해서 보관, 아무도 읽을 수 없음)
create table if not exists public.dinner_review_code (
  id boolean primary key default true check (id),
  code_hash text not null
);
drop table if exists public.dinner_codes; -- 예전 회차별 코드 표 (쓰지 않음)

-- 보안 규칙: 후기는 누구나 읽기, 쓰기는 참여자 코드가 맞을 때만
alter table public.dinner_reviews enable row level security;
alter table public.dinner_review_code enable row level security;
drop policy if exists "누구나 후기 읽기" on public.dinner_reviews;
create policy "누구나 후기 읽기" on public.dinner_reviews for select using (true);

revoke insert, update, delete on public.dinner_reviews from anon, authenticated;
revoke all on public.dinner_review_code from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.dinner_reviews to anon, authenticated;

-- 후기 남기기 (참여자 코드가 맞을 때만)
drop function if exists public.add_dinner_review(integer, text, text, text);
create function public.add_dinner_review(
  p_round integer, p_author text, p_body text, p_code text
) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from dinner_review_code
    where code_hash = crypt(coalesce(p_code, ''), code_hash)
  ) then
    return false;
  end if;
  insert into dinner_reviews (round_no, author, body)
  values (p_round, trim(p_author), trim(p_body));
  return true;
end $$;

revoke execute on function public.add_dinner_review(integer, text, text, text) from public;
grant execute on function public.add_dinner_review(integer, text, text, text) to anon, authenticated;

-- ▼ 참여자 코드 정하기 ▼
-- 이 파일은 누구나 볼 수 있어서 실제 코드는 적지 않았어요.
-- '여기에코드'를 실제 코드로 바꿔서 실행하세요. 코드를 바꾸고 싶을 때도 이 줄만 다시 실행하면 돼요.
insert into public.dinner_review_code (id, code_hash)
values (true, extensions.crypt('여기에코드', extensions.gen_salt('bf')))
on conflict (id) do update set code_hash = excluded.code_hash;

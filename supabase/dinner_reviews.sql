-- 솥뚜껑 저녁 모임 회차별 후기
-- Supabase SQL Editor에 붙여넣고 Run (처음 한 번만)

create table public.dinner_reviews (
  id uuid primary key default gen_random_uuid(),
  round_no integer not null check (round_no >= 1),
  author text not null check (char_length(author) between 1 and 20),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index dinner_reviews_round_idx on public.dinner_reviews (round_no, created_at);

-- 회차별 참여자 코드 (암호화해서 보관, 아무도 읽을 수 없음)
create table public.dinner_codes (
  round_no integer primary key,
  code_hash text not null
);

alter table public.dinner_reviews enable row level security;
alter table public.dinner_codes enable row level security;
create policy "누구나 후기 읽기" on public.dinner_reviews for select using (true);

revoke insert, update, delete on public.dinner_reviews from anon, authenticated;
revoke all on public.dinner_codes from anon, authenticated;
grant select on public.dinner_reviews to anon, authenticated;

-- 후기 남기기 (참여자 코드가 맞을 때만)
create function public.add_dinner_review(
  p_round integer, p_author text, p_body text, p_code text
) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from dinner_codes
    where round_no = p_round and code_hash = crypt(p_code, code_hash)
  ) then
    return false;
  end if;
  insert into dinner_reviews (round_no, author, body)
  values (p_round, trim(p_author), trim(p_body));
  return true;
end $$;

grant execute on function public.add_dinner_review(integer, text, text, text) to anon, authenticated;

-- ▼ 회차별 참여자 코드 정하기 ▼
-- '여기에코드' 부분을 원하는 코드로 바꿔서 실행하세요. (6자 이상 추천)
-- 다음 회차가 끝나면 숫자(회차)와 코드를 바꿔서 이 줄만 다시 실행하면 돼요.
insert into public.dinner_codes (round_no, code_hash)
values (1, extensions.crypt('여기에코드', extensions.gen_salt('bf')))
on conflict (round_no) do update set code_hash = excluded.code_hash;

-- 솥뚜껑 포럼 데이터베이스 설정
-- Supabase SQL Editor에 붙여넣고 Run (처음 한 번만)

-- 글
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('잡담', '질문', '정보', '자랑')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  author text not null check (char_length(author) between 1 and 20),
  likes integer not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

-- 댓글
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author text not null check (char_length(author) between 1 and 20),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_id_idx on public.comments (post_id, created_at);

-- 글 삭제 비밀번호 (암호화해서 보관, 아무도 읽을 수 없음)
create table public.post_secrets (
  post_id uuid primary key references public.posts(id) on delete cascade,
  password_hash text not null
);

-- 보안 규칙: 누구나 읽기 가능, 쓰기는 정해진 방법으로만
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_secrets enable row level security;

create policy "누구나 글 읽기" on public.posts for select using (true);
create policy "누구나 댓글 읽기" on public.comments for select using (true);
create policy "누구나 댓글 쓰기" on public.comments for insert with check (true);

revoke insert, update, delete on public.posts from anon, authenticated;
revoke all on public.post_secrets from anon, authenticated;
revoke insert, update, delete on public.comments from anon, authenticated;
grant insert (post_id, author, body) on public.comments to anon, authenticated;

-- 글쓰기 (삭제용 비밀번호 함께 저장)
create function public.create_post(
  p_category text, p_title text, p_body text, p_author text, p_password text
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if char_length(coalesce(p_password, '')) < 4 then
    raise exception '비밀번호는 4자 이상이어야 해요';
  end if;
  insert into posts (category, title, body, author)
  values (p_category, trim(p_title), trim(p_body),
          coalesce(nullif(trim(p_author), ''), '익명의 솥뚜껑'))
  returning id into new_id;
  insert into post_secrets (post_id, password_hash)
  values (new_id, crypt(p_password, gen_salt('bf')));
  return new_id;
end $$;

-- 글 삭제 (비밀번호가 맞을 때만)
create function public.delete_post(p_id uuid, p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
begin
  delete from posts p using post_secrets s
  where p.id = p_id and s.post_id = p.id
    and s.password_hash = crypt(p_password, s.password_hash);
  return found;
end $$;

-- 좋아요 +1 / -1
create function public.like_post(p_id uuid, p_delta integer) returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  update posts
  set likes = greatest(0, likes + case when p_delta > 0 then 1 else -1 end)
  where id = p_id
  returning likes into n;
  return n;
end $$;

-- 첫 환영 글
insert into public.posts (category, title, body, author) values (
  '잡담', '솥뚜껑 포럼 오픈했습니다 🎉',
  E'어서 오세요! 여기는 솥뚜껑 포럼입니다.\n\n뜨거운 이야기도, 소소한 이야기도 다 환영해요.\n서로 존중하면서 즐겁게 이야기 나눠요.',
  '운영자'
);

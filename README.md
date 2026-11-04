# 솥뚜껑 포럼

뜨겁게 끓고, 든든하게 덮어주는 이야기 마당.

빌드 과정 없이 HTML/CSS/JavaScript만으로 만든 간단한 포럼 웹사이트입니다.

## 기능

- 글 목록: 카테고리 탭(잡담·질문·정보·자랑), 검색, 정렬(최신·인기·댓글순)
- 글쓰기, 글 보기, 글 삭제
- 좋아요, 댓글
- 라이트/다크 테마 전환
- 모바일 화면 지원

> 글·댓글·좋아요는 [Supabase](https://supabase.com) 데이터베이스에 저장되어 모든 사람이 함께 봐요.
> 글을 쓸 때 정한 **삭제 비밀번호**가 있어야 글을 지울 수 있어요. 운영자는 Supabase 화면(Table Editor → `posts`)에서 어떤 글이든 지울 수 있어요.

## Supabase 설정

1. Supabase 프로젝트의 **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql) 내용을 붙여넣고 **Run** (처음 한 번만)
2. `app.js` 맨 위의 `SUPABASE_URL`, `SUPABASE_KEY`(publishable 키)를 내 프로젝트 값으로 설정
   - ⚠️ `secret` / `service_role` 키는 절대 코드에 넣지 마세요.
3. 무료 플랜은 일주일 동안 사용이 없으면 일시정지돼요. Supabase 화면에서 **Restore**를 누르면 다시 켜져요.

## 실행

`index.html`을 브라우저로 열면 바로 동작합니다. 로컬 서버로 띄우려면:

```bash
python3 -m http.server 8000
```

그다음 http://localhost:8000 에 접속하세요.

## 배포 (GitHub Pages)

1. 저장소의 **Settings → Pages**로 이동
2. **Source**를 `Deploy from a branch`, 브랜치를 `main` / `/ (root)`로 설정
3. 잠시 뒤 `https://<사용자명>.github.io/<저장소명>/` 에서 확인

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 페이지 뼈대와 화면 템플릿 |
| `style.css` | 디자인 (라이트/다크 테마) |
| `app.js` | 글·댓글·좋아요 기능(Supabase 연결)과 화면 전환 |
| `logo.svg` | 로고 (브라우저 탭 아이콘) |
| `supabase/schema.sql` | 데이터베이스 표·보안 규칙 설정 |

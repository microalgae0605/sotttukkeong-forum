# 솥뚜껑 포럼

뜨겁게 끓고, 든든하게 덮어주는 이야기 마당.

빌드 과정 없이 HTML/CSS/JavaScript만으로 만든 솥뚜껑 포럼 프로젝트 소개 웹사이트입니다.

## 기능

- 첫 화면 모션 그래픽(솥뚜껑 위로 숲이 자라는 인트로)
- 솥뚜껑 저녁 모임: 초대장 애니메이션, 취지, 고정 멤버, 회차별 기록·사진·참여 후기
- 준비 중인 프로젝트(Coming soon) 안내
- 라이트/다크 테마 전환
- 모바일 화면 지원

> 저녁 모임 후기는 [Supabase](https://supabase.com) 데이터베이스에 저장되어 모든 사람이 함께 봐요.
> 회차별 **참여자 코드**가 있어야 후기를 쓸 수 있어요. 운영자는 Supabase 화면(Table Editor → `dinner_reviews`)에서 후기를 지울 수 있어요.
>
> 이야기 마당(게시판)은 지금은 꺼 두었어요. 예전 코드는 Git 기록에 남아 있어요.

## Supabase 설정

1. Supabase 프로젝트의 **SQL Editor**에서 [`supabase/dinner_reviews.sql`](supabase/dinner_reviews.sql) 내용을 붙여넣고 **Run** (처음 한 번만)
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

## 새 회차 기록 추가하기

`app.js` 위쪽 `DINNER.rounds`에 회차 번호로 날짜·초대 손님·사진을 추가하고, 사진은 `images/` 폴더에 넣으면 돼요.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 페이지 뼈대와 화면 템플릿 |
| `style.css` | 디자인 (라이트/다크 테마) |
| `app.js` | 저녁 모임 데이터, 후기(Supabase 연결), 애니메이션, 화면 전환 |
| `logo.svg` | 로고 (브라우저 탭 아이콘) |
| `supabase/schema.sql` | (꺼 둔) 이야기 마당 게시판용 설정 |
| `supabase/dinner_reviews.sql` | 저녁 모임 후기·참여자 코드 설정 |
| `images/` | 모임 사진 |

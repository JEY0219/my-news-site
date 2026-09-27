-- ---------------------------------------------------------
-- 지역신문 아카이브 - 스키마 추가
--
-- 실행 순서: schema.sql -> news_archive.sql 을 먼저 실행한 뒤, 이 파일
-- 전체를 Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.
--
-- 왜 필요한가
--   지역신문 코너는 그동안 저장소가 프로세스 메모리(Map) 하나뿐이었고
--   TTL도 15분이었다. 서버가 재시작하면 통째로 날아가므로, Render 무료
--   플랜처럼 자주 잠들었다 깨는 환경에서는 방문자가 지역을 고를 때마다
--   네이버를 새로 호출하게 된다. 느리고, 호출 쿼터도 계속 깎인다.
--
--   최신기사(news_pairs)와 같은 이유로 과거 기사도 남지 않는다. 네이버
--   뉴스 검색은 최신순이라 지나간 날짜를 소급해 받을 수 없어서, 한 번
--   놓친 날의 지역 기사는 복구되지 않는다.
--
-- 이 파일이 하는 일
-- 1) news_local_articles 테이블 신설 - 기사 한 건이 한 행이다. 최신기사
--    아카이브처럼 계속 누적하고 지우지 않는다.
-- 2) news_local_fetch_state 테이블 신설 - 시/도별로 "마지막으로 네이버를
--    긁은 시각"을 담는다. 기존 메모리 캐시의 fetchedAt을 대신한다.
--
-- 접근 권한
--   news_archive.sql과 같다. RLS를 켜되 정책을 만들지 않아,
--   SUPABASE_SERVICE_ROLE_KEY(RLS 우회)를 쓰는 서버만 접근할 수 있다.
--   브라우저는 /api/local-news 를 통해서만 읽는다.
-- ---------------------------------------------------------

-- 1) news_local_articles
create table if not exists public.news_local_articles (
  id uuid primary key default gen_random_uuid(),

  -- 어느 시/도의 지역신문으로 수집했는지. LOCAL_NEWSPAPER_DOMAINS의 키다.
  sido text not null,

  url text not null,
  outlet text not null,
  title text not null,
  summary text not null default '',

  -- 보수/진보 추정값(OUTLET_ORIENTATION). 지역신문은 분류표에 없는 곳이
  -- 많아 null이 흔하다.
  orientation text,

  -- 보도 날짜. 화면은 이 값 기준 최신순으로 보여준다.
  article_date date not null,

  added_at timestamptz not null default now(),

  -- 같은 기사를 두 번 담지 않는다. url만으로 잡지 않고 (sido, url)로
  -- 묶는 이유는, 한 신문사가 둘 이상의 시/도 목록에 들어갈 수 있기
  -- 때문이다(예: 경인일보는 인천 목록에 있다). 그 경우 같은 기사가
  -- 지역별로 각각 한 행씩 남는 것이 맞다.
  constraint news_local_articles_sido_url_key unique (sido, url)
);

-- 화면 조회는 항상 "특정 시/도의 최신순"이다.
create index if not exists news_local_articles_sido_date_idx
  on public.news_local_articles (sido, article_date desc, added_at desc);

alter table public.news_local_articles enable row level security;

-- 2) news_local_fetch_state
--
-- news_fetch_state와 같은 이유로 기사 테이블과 분리한다. 긁었는데 전부
-- 이미 담긴 기사라 새로 저장된 행이 0건인 날에도 "긁은 시각"은 갱신돼야
-- 한다. 그래야 TTL이 만료 상태로 남아 방문자마다 네이버를 다시 긁는 일이
-- 없다.
create table if not exists public.news_local_fetch_state (
  sido text primary key,
  last_fetched_at timestamptz
);

alter table public.news_local_fetch_state enable row level security;

-- PostgREST(REST API)가 새 테이블을 바로 인식하도록 스키마 캐시를 갱신한다.
notify pgrst, 'reload schema';

-- 확인용: 아래가 두 줄을 돌려주면 성공이다.
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('news_local_articles', 'news_local_fetch_state');

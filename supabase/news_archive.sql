-- ---------------------------------------------------------
-- 최신기사 아카이브 - 스키마 추가
--
-- 실행 순서: schema.sql을 먼저 실행한 뒤, 이 파일 전체를 Supabase
-- 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.
--
-- 왜 필요한가
--   최신기사 페이지가 쌓는 "보수·진보 페어"는 그동안 서버 파일
--   data/news-cache.json 에만 있었다. 이 파일은 .gitignore에 있어
--   커밋되지 않고, Render 무료 플랜처럼 디스크가 휘발성인 환경에서는
--   재배포·잠자기 후 재시작 때마다 통째로 사라진다. 그러면 매일
--   갱신해서 쌓아온 과거 기사가 남지 않는다.
--
--   네이버 뉴스 검색은 최신순(sort=date)이라 지나간 날짜를 소급해
--   다시 받아올 방법이 없다. 한 번 놓친 날은 영영 복구되지 않으므로,
--   아카이브는 반드시 영구 저장소에 있어야 한다.
--
-- 이 파일이 하는 일
-- 1) news_pairs 테이블 신설 - 페어 한 건이 한 행이다.
-- 2) news_fetch_state 테이블 신설 - "마지막으로 네이버를 긁은 시각"
--    한 줄만 담는다. 24시간 TTL 판정에 쓴다.
--
-- 접근 권한
--   두 테이블 모두 RLS를 켜되 정책을 하나도 만들지 않는다. 즉 anon /
--   로그인 사용자 키로는 아무것도 읽거나 쓸 수 없고, 서버가 쓰는
--   SUPABASE_SERVICE_ROLE_KEY(RLS 우회)만 접근할 수 있다. 브라우저는
--   이 테이블을 직접 조회하지 않고 /api/latest-news 를 통해서만
--   읽으므로 공개 정책이 필요 없다.
-- ---------------------------------------------------------

-- 1) news_pairs
create table if not exists public.news_pairs (
  id uuid primary key default gen_random_uuid(),

  -- 같은 페어가 두 번 저장되는 것을 DB가 직접 막는다. 서버가 계산해
  -- 넣는 값으로, 페어를 이루는 두 기사 URL을 정렬해 이어붙인 문자열이다
  -- (정렬하므로 좌/우 순서가 바뀌어도 같은 키가 나온다).
  url_key text not null unique,

  -- 지금은 'pair'만 저장한다. 짝을 못 찾은 단일 기사는 화면에 보여줄
  -- 것이 없어 저장하지 않는다(server.js의 fetchDailyGroups 참고).
  group_type text not null default 'pair',

  -- 정렬 기준. 페어를 이루는 첫 기사의 보도 날짜다.
  group_date date not null,

  -- 제목 유사도(0~1). 페어링이 얼마나 확신 있는지 참고용으로만 쓴다.
  score numeric,

  -- 기사 2건의 배열. { title, summary, url, outlet, orientation, date }
  articles jsonb not null,

  -- 이 페어를 아카이브에 담은 시각. 보도 날짜(group_date)와 다르다.
  added_at timestamptz not null default now()
);

-- 최신기사 페이지는 항상 최신순으로 훑는다.
create index if not exists news_pairs_group_date_idx
  on public.news_pairs (group_date desc, added_at desc);

alter table public.news_pairs enable row level security;

-- 2) news_fetch_state
--
-- 마지막 갱신 시각을 news_pairs의 max(added_at)으로 대신하지 않는 이유:
-- 네이버를 긁었는데 전부 이미 담긴 기사라 새로 저장된 행이 0건인 날이
-- 있다. 그때 max(added_at)은 그대로라 24시간 TTL이 영원히 "만료" 상태가
-- 되고, 방문자가 올 때마다 네이버를 다시 긁게 된다. 그래서 "긁은 시각"은
-- "저장된 행"과 분리해 따로 기록한다.
create table if not exists public.news_fetch_state (
  id text primary key default 'latest-news',
  last_fetched_at timestamptz,
  constraint news_fetch_state_single_row check (id = 'latest-news')
);

alter table public.news_fetch_state enable row level security;

insert into public.news_fetch_state (id, last_fetched_at)
values ('latest-news', null)
on conflict (id) do nothing;

-- PostgREST(REST API)가 새 테이블을 바로 인식하도록 스키마 캐시를 갱신한다.
-- 보통은 자동으로 되지만, 늦어지면 서버가 "Could not find the table
-- 'public.news_pairs' in the schema cache" 오류를 낸다.
notify pgrst, 'reload schema';

-- 확인용: 아래가 두 줄(news_pairs, news_fetch_state)을 돌려주면 성공이다.
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('news_pairs', 'news_fetch_state');

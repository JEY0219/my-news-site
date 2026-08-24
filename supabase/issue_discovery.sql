-- ---------------------------------------------------------
-- 지역 이슈 자동 발견 - 스키마 추가
--
-- 실행 순서: schema.sql을 먼저 실행한 뒤, 이 파일 전체를 Supabase
-- 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.
--
-- 이 파일이 하는 일
-- 1) issues 테이블 신설 - 기존에 issues.html/article-compare.js 등
--    여러 파일에 하드코딩되어 있던 3개 이슈(5·18/대구경북/수도권비수도권)를
--    이 테이블로 옮겨와 단일 소스로 만든다.
-- 2) issue_candidates 테이블 신설 - 자동 탐색이 찾아낸, 아직 승인되지
--    않은 이슈 후보를 담는 승인 대기 큐. 관리자만 조회/쓰기 가능하다
--    (승인 전 공개 노출 금지가 이 기능의 핵심 요구사항이다).
-- 3) articles.issue_id의 "3개 값 중 하나여야 한다"는 고정 CHECK 제약을
--    issues 테이블을 참조하는 외래키로 교체 - 그래야 승인된 새 이슈에도
--    기사를 연결할 수 있다.
-- ---------------------------------------------------------

-- 1) issues
create table if not exists public.issues (
  id text primary key,
  title text not null,
  question text not null,
  region text,
  description text,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  created_at timestamptz not null default now()
);

alter table public.issues enable row level security;

-- 기존 3개 이슈를 그대로 시드한다 (issues.html/article-compare.js에 있던
-- 실제 텍스트). 이미 있으면 region 등 아래 값으로 맞춰 갱신한다(예전에는
-- `on conflict do nothing`이라 한 번 잘못된 값이 들어가면 재실행해도
-- 고쳐지지 않는 문제가 있었다 - 2026-08-25 수정).
--
-- region 컬럼 표기 규칙 (assets/js/issues-api.js의 fetchIssues가 이 형식을
-- 그대로 파싱해서 방문자가 선택한 시/도로 필터링한다):
--   - 시/도 하나: region-data.js의 REGIONS 키와 정확히 같은 문자열
--     (예: "광주광역시")
--   - 시/도 여러 개: " · "로 구분 (예: "대구광역시 · 경상북도")
--   - 어느 지역을 선택해도 항상 보여줄 전국 공통 이슈: 정확히 "전국"
--
-- 아래 3개(5·18/대구경북/수도권비수도권)는 특정 시/군/구 이슈가 아니라
-- "전국" 이슈로 취급한다 - 광주나 대구·경북을 선택한 사용자에게만
-- 보이는 게 아니라 어떤 지역을 선택해도 항상 이슈 목록에 나와야 한다.
-- (한때 gwangju-518/daegu-gyeongbuk의 region이 각각 "광주광역시",
-- "대구광역시 · 경상북도"로 좁게 들어가 있었던 적이 있는데, 그건 이
-- 규칙과 어긋난 실수다 - 그 상태에서 지역 필터를 적용하면 두 이슈가
-- 다른 지역을 선택한 사용자에게는 안 보이게 된다.)
insert into public.issues (id, title, question, region, description, source) values
  ('gwangju-518', '광주 5·18과 역사 기억',
   '5·18의 책임과 역사적 기억은 언론사마다 어떻게 다르게 구성되고 있을까요',
   '전국',
   '5·18 관련 보도에서는 역사 왜곡과 피해자 보호 및 책임 규명 문제가 함께 나타납니다. 기사마다 피해자와 책임 주체 및 해결책이 어떻게 구성되는지 비교합니다.',
   'manual'),
  ('daegu-gyeongbuk', '대구·경북 정치 정체성',
   '대구·경북의 지역 정체성은 언론사마다 어떤 언어로 다르게 설명되고 있을까요',
   '전국',
   '대구·경북 관련 보도에서는 산업화의 기억과 지역의 정치적 정체성 및 경제적 소외 인식이 함께 나타납니다. 특정 지역을 평가하는 것이 아니라 언론이 지역 정체성을 어떤 언어로 구성하는지 비교합니다.',
   'manual'),
  ('capital-imbalance', '수도권·비수도권 불균형',
   '청년 유출의 책임은 누구에게 있으며 어떤 해결책이 제시되고 있을까요',
   '전국',
   '수도권·비수도권 불균형 보도에서는 청년 유출과 지방소멸 및 교육과 산업 기반의 격차가 주요 쟁점으로 제시됩니다. 문제의 책임과 해결 주체가 기사마다 어떻게 달라지는지 비교합니다.',
   'manual')
on conflict (id) do update set
  title = excluded.title,
  question = excluded.question,
  region = excluded.region,
  description = excluded.description;

-- 2) issue_candidates
create table if not exists public.issue_candidates (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  keyword text not null,
  title text not null,
  question text not null,
  description text,
  matched_count integer not null default 0,
  matched_articles jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id)
);

alter table public.issue_candidates enable row level security;

-- 3) articles.issue_id: 고정 3값 CHECK -> issues 참조 FK로 교체
--
-- schema.sql에서 이 제약은 컬럼에 인라인으로 걸려 있어(named constraint가
-- 아님) Postgres가 자동으로 이름을 붙인다. 보통은 "articles_issue_id_check"
-- 이지만, 혹시 다르면 아래 조회로 실제 이름을 먼저 확인한 뒤 그 이름으로
-- drop 하세요:
--   select conname from pg_constraint
--     where conrelid = 'public.articles'::regclass and contype = 'c';
alter table public.articles drop constraint if exists articles_issue_id_check;

alter table public.articles
  add constraint articles_issue_id_fkey
  foreign key (issue_id) references public.issues (id);

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------

-- issues: articles와 동일한 패턴 - 누구나 조회, 쓰기는 관리자만.
drop policy if exists "issues_select_all" on public.issues;
create policy "issues_select_all"
  on public.issues for select
  using (true);

drop policy if exists "issues_write_admin" on public.issues;
create policy "issues_write_admin"
  on public.issues for insert
  with check (public.is_admin());

drop policy if exists "issues_update_admin" on public.issues;
create policy "issues_update_admin"
  on public.issues for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "issues_delete_admin" on public.issues;
create policy "issues_delete_admin"
  on public.issues for delete
  using (public.is_admin());

-- issue_candidates: 조회/쓰기 전부 관리자만. 이 정책이 "승인 전에는
-- 아무도 볼 수 없다"는 요구사항의 실제 방어선이다. 서버(server.js)는
-- 탐색 결과를 쓸 때 이 RLS를 우회하는 service role 키를 쓰므로, 이
-- insert 정책은 "그 외에는 관리자가 아니면 절대 못 쓴다"는 방어 역할만
-- 한다.
drop policy if exists "issue_candidates_select_admin" on public.issue_candidates;
create policy "issue_candidates_select_admin"
  on public.issue_candidates for select
  using (public.is_admin());

drop policy if exists "issue_candidates_insert_admin" on public.issue_candidates;
create policy "issue_candidates_insert_admin"
  on public.issue_candidates for insert
  with check (public.is_admin());

drop policy if exists "issue_candidates_update_admin" on public.issue_candidates;
create policy "issue_candidates_update_admin"
  on public.issue_candidates for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "issue_candidates_delete_admin" on public.issue_candidates;
create policy "issue_candidates_delete_admin"
  on public.issue_candidates for delete
  using (public.is_admin());

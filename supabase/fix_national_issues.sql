-- ---------------------------------------------------------
-- 전국 이슈 3개(5·18 / 대구·경북 / 수도권·비수도권) 복구 + region 정정
--
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고
-- 실행하세요. 여러 번 실행해도 안전합니다(idempotent).
--
-- 이 파일이 고치는 문제
-- 1) issues 테이블이 아직 없다면(= supabase/issue_discovery.sql이 이
--    프로젝트에 한 번도 실행되지 않았다면) 새로 만든다. 이미 있으면
--    손대지 않는다.
-- 2) 5·18(gwangju-518)과 대구·경북(daegu-gyeongbuk) 이슈가:
--    - 아예 없으면: 새로 추가한다.
--    - 있지만 region이 '광주광역시' / '대구광역시 · 경상북도'처럼
--      특정 지역으로 좁게 저장되어 있으면: 세 이슈 모두 region을
--      정확히 '전국'으로 통일한다. 이 3개는 특정 시/군/구 이슈가
--      아니라 전국 이슈이기 때문이다 - 방문자가 어떤 지역을 선택하든
--      항상 이슈 목록에 나와야 한다 (assets/js/issues-api.js의
--      fetchIssues가 region === '전국'인 이슈는 지역 필터에서 절대
--      거르지 않는다).
--    예전 supabase/issue_discovery.sql의 seed는 `on conflict do
--    nothing`이라 이미 잘못된 값으로 들어간 행은 재실행해도 고쳐지지
--    않았다 - 그래서 이 파일은 `on conflict do update`를 쓴다.
-- ---------------------------------------------------------

-- 1) issues 테이블이 없으면 생성 (supabase/issue_discovery.sql과 동일)
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

-- 2) 전국 이슈 3개를 upsert (region은 셋 다 정확히 '전국')
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

-- 3) articles.issue_id FK가 아직 없다면 연결 (issue_discovery.sql과 동일,
--    이미 되어 있으면 두 번째 alter table에서 에러 없이 무시됨)
alter table public.articles drop constraint if exists articles_issue_id_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_issue_id_fkey' and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_issue_id_fkey
      foreign key (issue_id) references public.issues (id);
  end if;
end $$;

-- 4) 이슈당 실제 기사(9건)가 없다면 함께 채워 넣는다 (articles_real_data.json
--    기준, supabase/seed_articles.sql과 동일 - 이미 있으면 upsert로 덮어씀)
insert into public.articles
  (no, issue_id, title, outlet, region, article_date, date_estimated, summary, url, victim, responsible, solver, emotion, policy)
values
  ('NEWS001', 'gwangju-518', '끝나지 않는 5·18 왜곡…상처는 다시 반복된다', '오마이뉴스 (계열)', '전국', DATE '2026-05-28', false, '5·18기념재단의 AI 기반 모니터링 결과 2025년 2~11월 왜곡·폄훼 게시물이 전년 대비 약 200% 증가했고, 유튜브 왜곡 콘텐츠도 크게 늘었다는 내용. 북한군 개입설, 폭동 주장 등 왜곡 유형과 게임·영상·AI합성 이미지로 확장되는 양상을 다룸.', 'https://v.daum.net/v/20260528165112594?f=p', '5·18 희생자와 유가족, 광주 시민', '왜곡 세력, 온라인 재생산 주체', '5·18기념재단, 시민사회', '분노, 불신', 'AI 기반 모니터링 강화, 법적 대응'),
  ('NEWS002', 'gwangju-518', '학교 도서관에 5.18 역사 왜곡 도서 (뉴스데스크)', '광주MBC', '광주', DATE '2025-03-24', false, '전국 초중고 학교 도서관에 5·18을 왜곡·폄훼하는 도서가 소장되어 있는 사실이 확인됐고, 광주 지역 일부 학교도 포함되어 학생들에게 잘못된 역사 인식을 심어줄 우려가 제기된다는 보도.', 'https://www.youtube.com/watch?v=H2vY--J2j1Y', '학생, 5·18 희생자', '왜곡 도서 유통·비치 주체', '교육당국, 학교', '불안, 분노', '역사교육 강화, 도서 검수 제도 개선'),
  ('NEWS003', 'gwangju-518', '5월 단체 "5·18 광주사태 표현은 역사왜곡"', '무등일보', '광주', DATE '2026-05-20', false, '46주년 5·18민주화운동을 맞아 진행된 기념 행사 소식과 함께, 5월 단체가 ''5·18 광주사태''라는 표현 자체가 역사왜곡이라고 지적한 내용을 다룸.', 'https://www.mdilbo.com/detail/NezemK/742259', '5·18 관련자, 유가족', '왜곡된 용어 사용 주체', '5월 단체, 지역사회', '연대, 자부심', '정확한 용어 사용 확산, 역사교육'),
  ('NEWS004', 'daegu-gyeongbuk', '"경쟁 없는 정치에선 지역의 미래도 없다"', '경북매일', '대구·경북', DATE '2025-10-26', false, '지방자치 30년을 평가하며 대구·경북의 낮은 재정자립도(경북 24.56%, 전국 최하위권)와 정권 교체 부재로 인한 정책 혁신 동력 약화를 지적한 기획 기사.', 'https://www.kbmaeil.com/article/20251026500105', '대구·경북 지역 주민', '중앙정부 의존 구조, 정치적 다양성 부재', '지방자치단체, 지역 정치권', '소외, 자부심', '재정분권 강화, 지방자치 제도 개선'),
  ('NEWS005', 'daegu-gyeongbuk', '보수 장벽 여전한 대구경북...정치 지형 변화 조짐도 보였다', '연합뉴스 (계열)', '대구·경북', DATE '2026-06-06', false, '지방선거에서 대구·경북의 전통적 ''보수 장벽''은 여전했지만, 접전 양상이 나타나며 정치 지형 변화 가능성을 보여줬다는 평가를 다룸.', 'https://v.daum.net/v/20260606104509375', '대구·경북 유권자', '지역주의 정치 구도', '유권자, 정치 신진 세력', '자부심, 연대', '정치 다양성 확대'),
  ('NEWS006', 'daegu-gyeongbuk', '대구·경북 교육감 선거 ''깜깜이'' 우려 확산⋯정책 검증 실종', '경북매일', '대구·경북', DATE '2026-05-08', false, '정당 추천 없이 치러지는 교육감 선거의 특성상 후보 간 정책 비교가 어렵고, 이념 공방과 인지도 중심으로 선거가 흐르고 있다는 문제 제기.', 'https://www.kbmaeil.com/article/20260507500537', '학생, 학부모, 유권자', '정당 배제 선거 제도, 언론의 낮은 관심', '선거관리위원회, 언론', '소외, 불안', '교육감 선거 정당 추천제 도입 논의'),
  ('NEWS007', 'capital-imbalance', '생활 안정 높아도 일자리 없어 떠난다…청년 1인 가구 수도권 집중 지속', '1코노미뉴스', '전국', DATE '2026-07-15', true, '2024년 기준 청년층의 수도권 순유입이 계속되고 있으며, 일자리가 청년들이 수도권을 선택하는 핵심 요인이라는 분석. 비수도권이 주거·출산 측면에서는 강점이 있으나 유출은 지속된다는 내용.', 'https://www.1conomynews.co.kr/news/articleView.html?idxno=49595', '지방 청년', '수도권 집중 일자리 구조', '중앙정부, 지자체', '불안, 소외', '비수도권 일자리 지원, 소득 보조금·세제 혜택'),
  ('NEWS008', 'capital-imbalance', '심화하는 지역 양극화, 사라지는 지역 청년들', '삼육대학교 신문사', '전북 등 비수도권', DATE '2025-03-14', false, '전북의 20대 순유출률이 전국 1위를 기록했다는 통계를 바탕으로, 일자리 부족이 청년 유출의 핵심 원인이며 지역 인구 불균형이 심화되고 있다는 내용.', 'https://www.sunews.kr/2025/03/14/%EC%A7%80%EC%97%AD%EC%96%91%EA%B7%B9%ED%99%94/', '비수도권 청년, 지방 중소기업', '일자리 부족, 수도권 집중 산업구조', '정부 부처 간 협력, 지자체', '불안, 위기감', '장기적 균형발전 정책, 지방기업 지원'),
  ('NEWS009', 'capital-imbalance', '청년은 수도권으로, 아이는 지방에서…혼인 후 이동이 던지는 지역소멸의 경고', '경남뉴스', '경남', DATE '2026-07-20', true, '혼인 후 비수도권에 계속 거주한 청년의 출산 비중이 수도권보다 높다는 통계를 근거로, 지방소멸 대응은 청년 유입보다 ''정착 중심 정책''으로 전환해야 한다는 제안.', 'https://www.gnnews24.kr/news/articleView.html?idxno=33374', '비수도권 신혼부부, 지역사회', '유입 중심 지방정책의 한계', '지자체, 중앙정부', '소외, 희망', '정착 중심 정책(주거·보육·일자리 통합 지원)')
on conflict (no) do update set
  issue_id = excluded.issue_id,
  title = excluded.title,
  outlet = excluded.outlet,
  region = excluded.region,
  article_date = excluded.article_date,
  date_estimated = excluded.date_estimated,
  summary = excluded.summary,
  url = excluded.url,
  victim = excluded.victim,
  responsible = excluded.responsible,
  solver = excluded.solver,
  emotion = excluded.emotion,
  policy = excluded.policy,
  updated_at = now();

-- 5) 확인용 조회 (실행 후 결과 탭에서 region이 셋 다 '전국'인지 확인하세요)
select id, title, region, source from public.issues
where id in ('gwangju-518', 'daegu-gyeongbuk', 'capital-imbalance');

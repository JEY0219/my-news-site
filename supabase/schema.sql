-- ---------------------------------------------------------
-- 청소년 지역 이슈 균형정보 플랫폼 - Supabase 스키마 + RLS
--
-- 사용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고
-- 실행하세요. 한 번만 실행하면 됩니다.
--
-- 설계 요약
-- - 비회원: auth.users 계정을 만들지 않는다. 숫자 4자리 등 "익명 코드"를
--   survey_responses / emotion_check_responses 테이블의 anon_code 컬럼에
--   직접 저장한다. 개인정보(이름, 이메일 등)와 연결되지 않는다.
-- - 회원: Supabase Auth(이메일+비밀번호)로 가입한다. 비밀번호는
--   Supabase Auth가 자동으로 해시(bcrypt)해서 저장하며, 이 스키마에는
--   평문 비밀번호가 전혀 들어오지 않는다.
-- - 관리자: 회원과 동일한 로그인 방식을 쓰되, profiles.role = 'admin'
--   인 계정만 기사 CRUD와 전체 설문 결과 조회가 가능하다. 신규 가입은
--   항상 role = 'member'로 시작하며, 최초 관리자는 이 파일 맨 아래
--   안내에 따라 SQL로 직접 지정해야 한다.
-- ---------------------------------------------------------

-- 1) profiles: auth.users 1:1 확장 테이블 (역할 저장용)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 회원가입 시 profiles 행을 자동 생성하는 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'member');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- role 컬럼은 관리자만 바꿀 수 있도록 방어 (본인이 스스로 admin으로
-- 올리는 것을 막는다). auth.uid()가 없는 경우(= SQL Editor나 서비스
-- 롤처럼 로그인 세션 없이 직접 실행하는 경우)는 검사하지 않는다 —
-- 그래야 최초 관리자를 SQL Editor에서 수동으로 지정할 수 있다.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.role <> old.role and not public.is_admin() then
    raise exception '권한을 변경할 수 없습니다.';
  end if;
  return new;
end;
$$;

-- is_admin()이 아래에 정의되므로 트리거는 스키마 끝부분에서 생성한다.

-- 2) articles: 기사 비교 화면에 쓰이는 실제 기사 데이터 (관리자 CRUD 대상)
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  no text unique not null,
  issue_id text not null check (issue_id in ('gwangju-518', 'daegu-gyeongbuk', 'capital-imbalance')),
  title text not null,
  outlet text,
  region text,
  article_date date,
  date_estimated boolean not null default false,
  summary text,
  url text,
  victim text,
  responsible text,
  solver text,
  emotion text,
  policy text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- 3) survey_responses: 사전/사후 설문 응답
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_type text not null check (survey_type in ('pre', 'post')),
  participant_kind text not null check (participant_kind in ('guest', 'member')),
  anon_code text,
  user_id uuid references auth.users (id),
  answers jsonb not null,
  created_at timestamptz not null default now(),
  constraint survey_participant_shape check (
    (participant_kind = 'member' and user_id is not null and anon_code is null)
    or
    (participant_kind = 'guest' and user_id is null and anon_code is not null)
  )
);

alter table public.survey_responses enable row level security;

-- 4) emotion_check_responses: 감정 자가 점검 응답
create table if not exists public.emotion_check_responses (
  id uuid primary key default gen_random_uuid(),
  issue_id text,
  participant_kind text not null check (participant_kind in ('guest', 'member')),
  anon_code text,
  user_id uuid references auth.users (id),
  answers jsonb not null,
  created_at timestamptz not null default now(),
  constraint emotion_participant_shape check (
    (participant_kind = 'member' and user_id is not null and anon_code is null)
    or
    (participant_kind = 'guest' and user_id is null and anon_code is not null)
  )
);

alter table public.emotion_check_responses enable row level security;

-- ---------------------------------------------------------
-- 권한 판별 함수 (RLS 정책에서 재사용)
-- ---------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ---------------------------------------------------------
-- RLS 정책
-- ---------------------------------------------------------

-- profiles: 본인 행은 본인이, 전체는 관리자만 조회
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- articles: 누구나 조회 가능, 쓰기는 관리자만
drop policy if exists "articles_select_all" on public.articles;
create policy "articles_select_all"
  on public.articles for select
  using (true);

drop policy if exists "articles_write_admin" on public.articles;
create policy "articles_write_admin"
  on public.articles for insert
  with check (public.is_admin());

drop policy if exists "articles_update_admin" on public.articles;
create policy "articles_update_admin"
  on public.articles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "articles_delete_admin" on public.articles;
create policy "articles_delete_admin"
  on public.articles for delete
  using (public.is_admin());

-- survey_responses: 누구나 본인 조건에 맞게 삽입, 조회는 본인/게스트/관리자
drop policy if exists "survey_insert_any" on public.survey_responses;
create policy "survey_insert_any"
  on public.survey_responses for insert
  with check (
    (participant_kind = 'member' and user_id = auth.uid())
    or
    (participant_kind = 'guest' and user_id is null)
  );

-- 주의: 익명 코드는 숫자 4자리라 추측 가능하다(원래 설계상 보안 목적이
-- 아니라 "본인이 기억하는 연결용 번호"이다). 게스트 응답은 조회 시
-- anon_code로 필터링하는 것을 클라이언트 쿼리에 맡긴다.
drop policy if exists "survey_select_own_or_guest_or_admin" on public.survey_responses;
create policy "survey_select_own_or_guest_or_admin"
  on public.survey_responses for select
  using (
    (participant_kind = 'member' and user_id = auth.uid())
    or participant_kind = 'guest'
    or public.is_admin()
  );

-- emotion_check_responses: survey_responses와 동일한 규칙
drop policy if exists "emotion_insert_any" on public.emotion_check_responses;
create policy "emotion_insert_any"
  on public.emotion_check_responses for insert
  with check (
    (participant_kind = 'member' and user_id = auth.uid())
    or
    (participant_kind = 'guest' and user_id is null)
  );

drop policy if exists "emotion_select_own_or_guest_or_admin" on public.emotion_check_responses;
create policy "emotion_select_own_or_guest_or_admin"
  on public.emotion_check_responses for select
  using (
    (participant_kind = 'member' and user_id = auth.uid())
    or participant_kind = 'guest'
    or public.is_admin()
  );

-- ---------------------------------------------------------
-- 최초 관리자 지정 (수동, 1회)
-- 아래 이메일을 실제 관리자로 쓸 계정으로 바꾼 뒤, 그 계정으로
-- 웹사이트에서 "회원가입"을 먼저 완료하고 나서 이 UPDATE문을 실행하세요.
-- ---------------------------------------------------------
-- update public.profiles set role = 'admin' where email = '관리자이메일@example.com';

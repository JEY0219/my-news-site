/* ---------------------------------------------------------
   Supabase 클라이언트 초기화
   - URL과 anon key는 브라우저에 노출되도록 설계된 공개 값이다(비밀 키
     아님). 실제 값은 Supabase 대시보드 > Project Settings > API에서
     확인할 수 있다.
   - 권한 제어는 이 키를 숨기는 방식이 아니라 Postgres RLS 정책
     (supabase/schema.sql)으로 이루어진다.
--------------------------------------------------------- */

const SUPABASE_URL = "https://ahgspgxwbbjwiyosevzm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZ3NwZ3h3YmJqd2l5b3NldnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjAyMjQsImV4cCI6MjEwMDg5NjIyNH0.e_HGUypvkPkprDcycQOfSKRoyzkWMJo4xnG3t2JKaPs";

const supabaseClient =
  SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY")
    ? null
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });

if (!supabaseClient) {
  console.warn(
    "Supabase가 아직 설정되지 않았습니다. assets/js/supabase-client.js의 " +
      "SUPABASE_URL / SUPABASE_ANON_KEY를 실제 값으로 바꿔주세요."
  );
}

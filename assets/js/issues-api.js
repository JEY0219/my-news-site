/* ---------------------------------------------------------
   Supabase issues 테이블 조회 헬퍼
   - 예전에는 이슈 3개(5·18/대구경북/수도권비수도권)가 issues.html,
     article-compare.js, admin.html에 각각 하드코딩되어 있었다. 이제는
     이 테이블이 단일 소스이며, 관리자가 "이슈 후보"를 승인하면 새 행이
     추가되어 아래 함수들을 통해 바로 반영된다.

   지역 필터 규칙 (issue.region 값 기준, supabase/issue_discovery.sql
   시드 코멘트와 동일한 규칙):
   - region이 없거나 정확히 "전국"이면 어떤 지역을 선택했든 항상 보여준다.
     5·18/대구·경북/수도권·비수도권 이 3개 전국 이슈가 여기 해당한다.
   - region이 시/도 하나("광주광역시") 또는 " · "로 구분된 여러
     시/도("대구광역시 · 경상북도")이면, 방문자가 선택한 시/도가 그
     목록에 포함될 때만 보여준다(자동 발견으로 승인된 지역 이슈용).
--------------------------------------------------------- */

function mapIssueRow(row) {
  return {
    id: row.id,
    title: row.title,
    question: row.question,
    region: row.region,
    description: row.description,
    source: row.source,
  };
}

function isIssueVisibleForSido(issue, sido) {
  if (!sido) return true; // 지역을 아직 모르면(=필터 불가) 걸러내지 않는다
  if (!issue.region || issue.region.trim() === "전국") return true;
  const targets = issue.region.split("·").map((s) => s.trim());
  return targets.includes(sido);
}

/**
 * @param {{sido:string}=} regionFilter 넘기면 전국 이슈는 항상 포함하고,
 *   특정 지역 이슈는 그 시/도를 선택한 경우에만 포함한다. 생략하면
 *   필터 없이 전체를 반환한다(관리자 화면 등 지역 무관 목적용).
 */
async function fetchIssues(regionFilter) {
  if (!supabaseClient) throw new Error("Supabase 설정이 필요합니다 (assets/js/supabase-client.js).");
  const { data, error } = await supabaseClient.from("issues").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  const issues = (data || []).map(mapIssueRow);
  if (!regionFilter) return issues;
  return issues.filter((issue) => isIssueVisibleForSido(issue, regionFilter.sido));
}

async function fetchIssueById(issueId) {
  if (!supabaseClient) throw new Error("Supabase 설정이 필요합니다 (assets/js/supabase-client.js).");
  const { data, error } = await supabaseClient.from("issues").select("*").eq("id", issueId).maybeSingle();
  if (error) throw error;
  return data ? mapIssueRow(data) : null;
}

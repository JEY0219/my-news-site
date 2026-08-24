/* ---------------------------------------------------------
   Supabase articles 테이블 조회 헬퍼
   - 관리자 화면에서 기사를 추가/수정하면 이 함수들을 통해 즉시 반영된다.
--------------------------------------------------------- */

function mapArticleRow(row) {
  return {
    id: row.id,
    no: row.no,
    issueId: row.issue_id,
    title: row.title,
    outlet: row.outlet,
    region: row.region,
    date: row.article_date,
    dateEstimated: row.date_estimated,
    summary: row.summary,
    url: row.url,
    victim: row.victim,
    responsible: row.responsible,
    solver: row.solver,
    emotion: row.emotion,
    policy: row.policy,
  };
}

async function fetchArticlesByIssue(issueId) {
  if (!supabaseClient) throw new Error("Supabase 설정이 필요합니다 (assets/js/supabase-client.js).");
  const { data, error } = await supabaseClient
    .from("articles")
    .select("*")
    .eq("issue_id", issueId)
    .order("article_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapArticleRow);
}

async function fetchArticleCounts() {
  if (!supabaseClient) throw new Error("Supabase 설정이 필요합니다 (assets/js/supabase-client.js).");
  const { data, error } = await supabaseClient.from("articles").select("issue_id");
  if (error) throw error;
  const counts = {};
  (data || []).forEach((r) => {
    counts[r.issue_id] = (counts[r.issue_id] || 0) + 1;
  });
  return counts;
}

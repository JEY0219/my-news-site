/* ---------------------------------------------------------
   data/news-cache.json -> Supabase(news_pairs) 1회 이관 스크립트

   실행 순서
     1. Supabase 대시보드 > SQL Editor 에서 supabase/news_archive.sql 실행
     2. node scripts/migrate-news-cache.js

   여러 번 실행해도 안전하다. news_pairs.url_key의 unique 제약과
   ignoreDuplicates 옵션 덕분에 이미 옮겨진 페어는 건너뛴다.

   이관이 끝나도 data/news-cache.json은 지우지 않는다. 혹시 잘못되면
   다시 돌릴 수 있는 원본이고, Supabase 키 없이 로컬에서 서버를 돌릴 때는
   server.js가 여전히 이 파일을 쓴다.
--------------------------------------------------------- */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  process.exit(1);
}

const CACHE_PATH = path.join(__dirname, "..", "data", "news-cache.json");

/* server.js의 newsGroupUrlKey()와 같은 규칙이어야 한다. 다르면 이미 옮긴
   페어를 서버가 새 페어로 착각해 중복 저장한다. */
function newsGroupUrlKey(group) {
  return group.articles
    .map((a) => a.url)
    .sort()
    .join("\n");
}

async function main() {
  let store;
  try {
    store = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch (err) {
    console.error(`${CACHE_PATH}를 읽지 못했습니다: ${err.message}`);
    process.exit(1);
  }

  const archive = Array.isArray(store.archive) ? store.archive : [];
  if (archive.length === 0) {
    console.log("옮길 그룹이 없습니다.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { count: beforeCount, error: countError } = await supabase
    .from("news_pairs")
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.error(`news_pairs 조회 실패: ${countError.message}`);
    console.error("supabase/news_archive.sql을 먼저 실행했는지 확인하세요.");
    process.exit(1);
  }

  const rows = archive.map((group) => ({
    url_key: newsGroupUrlKey(group),
    group_type: group.type || "pair",
    group_date: group.articles[0]?.date || null,
    score: typeof group.score === "number" ? group.score : null,
    articles: group.articles,
    added_at: group.addedAt || null,
  }));

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("news_pairs")
      .upsert(chunk, { onConflict: "url_key", ignoreDuplicates: true });
    if (error) {
      console.error(`저장 실패(${i + 1}~${i + chunk.length}번째): ${error.message}`);
      console.error("supabase/news_archive.sql을 먼저 실행했는지 확인하세요.");
      process.exit(1);
    }
  }

  /* 마지막 갱신 시각도 함께 옮긴다. 이걸 빼먹으면 DB의 last_fetched_at이
     null이라, 이관 직후 첫 요청이 24시간 TTL을 만료로 보고 네이버를 한 번
     더 긁는다(중복 저장은 안 되지만 불필요한 호출이다). */
  if (store.lastFetchedAt) {
    const { error } = await supabase
      .from("news_fetch_state")
      .upsert({ id: "latest-news", last_fetched_at: store.lastFetchedAt });
    if (error) {
      console.error(`news_fetch_state 저장 실패: ${error.message}`);
      process.exit(1);
    }
  }

  const { count: afterCount } = await supabase
    .from("news_pairs")
    .select("id", { count: "exact", head: true });

  console.log(`파일 그룹 ${archive.length}개 처리`);
  console.log(`news_pairs: ${beforeCount}개 -> ${afterCount}개 (신규 ${afterCount - beforeCount}개)`);
  console.log(`마지막 갱신 시각: ${store.lastFetchedAt || "(없음)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

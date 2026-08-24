/* ---------------------------------------------------------
   청소년 지역 이슈 균형정보 플랫폼 - 정적 파일 서버 + 공공데이터 API 프록시

   - 기존 `python -m http.server`를 대체한다: `npm install` 후
     `npm start`로 실행하면 정적 페이지와 API 프록시를 함께 제공한다.
   - 공공데이터 API 인증키는 절대 브라우저로 내려보내지 않는다. 이
     서버가 .env의 키로 대신 호출한 뒤, 필요한 필드만 추려 프론트엔드에
     전달한다.

   신뢰도 안내
   - 전국청소년수련시설표준데이터: 요청 URL/파라미터(ctpvNm, sggNm)를
     data.go.kr 데이터셋 상세 페이지에서 확인했다.
   - 도서관정보나루(libSrch): authKey/region 파라미터를 확인했다. 시군구
     코드표는 신뢰성 있게 확보하지 못해, 시도 코드로만 조회한 뒤 주소
     문자열에 시군구명이 포함되는 항목만 서버에서 걸러낸다.
   - 청소년상담복지센터 현황: 정확한 API 주소를 확인하지 못했다. 데이터
     포털에서 이 데이터셋을 활용신청하면 상세기능정보 페이지에 실제
     요청 URL 예시가 표시되는데, 그 값을 .env의
     COUNSELING_CENTER_API_URL에 붙여넣어야 동작한다. 비어 있으면 이
     항목만 "설정 필요" 상태로 응답한다.
   - 주민등록 인구통계: 이 역시 정확한 서비스 URL을 확정하지 못했다.
     COUNSELING_CENTER_API_URL과 같은 방식으로 .env의
     POPULATION_API_URL에 활용신청 후 확인한 실제 요청 URL을 붙여넣어야
     한다. 응답 필드명도 기관마다 달라 흔히 쓰이는 후보 필드명을 여러
     개 시도하도록 만들었다.
   - 네이버 뉴스 검색 API: 요청 헤더(X-Naver-Client-Id/Secret)와 응답
     형식은 네이버 개발자센터 문서 기준으로 확실하다. "같은 사건, 보수·
     진보 관점 비교" 페어링은 네이버가 제공하는 기능이 아니라, 이 서버가
     언론사를 보수/진보로 미리 분류(OUTLET_ORIENTATION)한 뒤 제목 단어
     겹침 비율로 같은 사건 여부를 추정하는 휴리스틱이다(정교한 사건
     클러스터링 모델이 아니므로 완벽하지 않을 수 있다).
   - 지역 이슈 자동 발견(/api/issue-discovery/run): 관리자가 버튼을
     누르면 시/도별 빈출 키워드를 뽑아 네이버 뉴스로 검증하고, NPF(피해자/
     책임주체/해결자/감정/정책대안) 태그를 키워드 사전으로 자동으로 붙여
     Supabase의 issue_candidates 테이블(승인 대기 큐)에 저장한다. 이
     라우트는 RLS를 우회하는 SUPABASE_SERVICE_ROLE_KEY가 있어야 동작하며,
     요청자가 관리자인지도 이 키로 직접 검증한다(자세한 내용은 아래
     "6) 지역 이슈 자동 발견" 섹션 참고).
--------------------------------------------------------- */

require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

const YOUTH_FACILITY_API_KEY = process.env.YOUTH_FACILITY_API_KEY || "";
const YOUTH_FACILITY_API_URL =
  process.env.YOUTH_FACILITY_API_URL ||
  "https://api.data.go.kr/openapi/tn_pubr_public_teen_training_fclt_api";

const COUNSELING_CENTER_API_KEY = process.env.COUNSELING_CENTER_API_KEY || "";
const COUNSELING_CENTER_API_URL = process.env.COUNSELING_CENTER_API_URL || "";

const LIBRARY_API_KEY = process.env.LIBRARY_API_KEY || "";

const POPULATION_API_KEY = process.env.POPULATION_API_KEY || "";
const POPULATION_API_URL = process.env.POPULATION_API_URL || "";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
/* RLS를 우회하는 관리자 전용 클라이언트. 지역 이슈 자동 발견 기능에서만
   쓴다 - 승인 대기 큐(issue_candidates)에 쓰려면 RLS가 관리자 세션을
   요구하는데, 이 라우트를 호출하는 건 서버 자신이라 사용자 세션이 없기
   때문이다. 이 클라이언트는 절대 브라우저로 내려보내면 안 된다. */
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

/* 공공정보 접근성 등급 기준: 인구 1만 명당 시설 수(도서관+청소년수련시설+
   청소년상담복지센터 합계) 기준. 임계값은 절대적인 공식 기준이 아니라
   이 프로토타입에서 합리적으로 정한 값이며, 화면에도 그대로 표시한다. */
const GRADE_THRESHOLDS = [
  { grade: "A", min: 3.0, label: "매우 높음", desc: "인구 1만 명당 시설이 3개 이상으로 접근성이 우수합니다." },
  { grade: "B", min: 2.0, label: "높음", desc: "인구 1만 명당 시설이 2개 이상 3개 미만으로 접근성이 양호합니다." },
  { grade: "C", min: 1.0, label: "보통", desc: "인구 1만 명당 시설이 1개 이상 2개 미만으로 접근성이 보통 수준입니다." },
  { grade: "D", min: 0.5, label: "낮음", desc: "인구 1만 명당 시설이 0.5개 이상 1개 미만으로 접근성이 낮은 편입니다." },
  { grade: "E", min: 0, label: "매우 낮음", desc: "인구 1만 명당 시설이 0.5개 미만으로 접근성이 매우 낮습니다." },
];

function computeGrade(ratePer10k) {
  for (const t of GRADE_THRESHOLDS) {
    if (ratePer10k >= t.min) return t;
  }
  return GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];
}

/* 도서관정보나루 시도 코드 (시군구 코드는 신뢰성 있게 확보하지 못해 미사용) */
const SIDO_TO_LIBRARY_CODE = {
  "서울특별시": "11",
  "부산광역시": "21",
  "대구광역시": "22",
  "인천광역시": "23",
  "광주광역시": "24",
  "대전광역시": "25",
  "울산광역시": "26",
  "세종특별자치시": "29",
  "경기도": "31",
  "강원특별자치도": "32",
  "충청북도": "33",
  "충청남도": "34",
  "전북특별자치도": "35",
  "전라남도": "36",
  "경상북도": "37",
  "경상남도": "38",
  "제주특별자치도": "39",
};

/* express.static(__dirname)은 프로젝트 폴더 전체를 그대로 웹에 내려주기
   때문에, 서버 소스코드/설정/DB 스키마처럼 외부에 노출되면 안 되는
   파일은 정적 서빙에 도달하기 전에 먼저 막는다. (.env는 express가
   기본적으로 dotfile을 무시해 이미 보호되지만, server.js나
   supabase/*.sql처럼 점(.)으로 시작하지 않는 파일은 별도로 막아야
   한다.) */
const BLOCKED_STATIC_FILES = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
]);
const BLOCKED_STATIC_PREFIXES = ["/supabase/", "/node_modules/", "/.git/"];

app.use((req, res, next) => {
  if (
    BLOCKED_STATIC_FILES.has(req.path) ||
    BLOCKED_STATIC_PREFIXES.some((prefix) => req.path.startsWith(prefix))
  ) {
    return res.status(404).send("Not found");
  }
  next();
});

app.use(express.static(path.join(__dirname)));

async function fetchWithTimeout(url, timeoutMs = 8000, fetchOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error("응답을 JSON으로 해석하지 못했습니다.");
    }
  } finally {
    clearTimeout(timer);
  }
}

function extractItems(dataGoKrResponse) {
  const items = dataGoKrResponse?.response?.body?.items;
  if (!items) return [];
  const item = items.item !== undefined ? items.item : items;
  if (Array.isArray(item)) return item;
  if (item && typeof item === "object") return [item];
  return [];
}

/* ---------------- 1) 전국청소년수련시설표준데이터 ---------------- */

async function fetchYouthFacilities(sido, sigungu) {
  if (!YOUTH_FACILITY_API_KEY) {
    return { status: "not_configured", items: [] };
  }
  const url = new URL(YOUTH_FACILITY_API_URL);
  url.searchParams.set("serviceKey", YOUTH_FACILITY_API_KEY);
  url.searchParams.set("type", "json");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  if (sido) url.searchParams.set("ctpvNm", sido);
  if (sigungu) url.searchParams.set("sggNm", sigungu);

  const data = await fetchWithTimeout(url.toString());
  const items = extractItems(data);

  return {
    status: "ok",
    items: items.map((it) => ({
      type: "청소년수련시설",
      name: it.fcltNm || it.fclty_nm || "이름 미상",
      address: it.lctnRoadNm || it.rdnmadr || it.lctnAddr || it.lnmadr || "",
      tel: it.telNo || it.telno || "",
    })),
  };
}

/* ---------------- 2) 청소년상담복지센터 현황 ---------------- */

async function fetchCounselingCenters(sido, sigungu) {
  if (!COUNSELING_CENTER_API_KEY || !COUNSELING_CENTER_API_URL) {
    return { status: "not_configured", items: [] };
  }
  const url = new URL(COUNSELING_CENTER_API_URL);
  url.searchParams.set("serviceKey", COUNSELING_CENTER_API_KEY);
  url.searchParams.set("type", "json");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  if (sido) url.searchParams.set("ctpvNm", sido);
  if (sigungu) url.searchParams.set("sggNm", sigungu);

  const data = await fetchWithTimeout(url.toString());
  const items = extractItems(data);

  const filtered = sigungu
    ? items.filter((it) => JSON.stringify(it).includes(sigungu))
    : items;

  return {
    status: "ok",
    items: filtered.map((it) => ({
      type: "청소년상담복지센터",
      name: it.fcltNm || it.centerNm || it.instNm || "이름 미상",
      address: it.lctnRoadNm || it.addr1 || it.addr || "",
      tel: it.telNo || it.telNumber || it.tel || "",
    })),
  };
}

/* ---------------- 3) 도서관정보나루 ---------------- */

async function fetchLibraries(sido, sigungu) {
  if (!LIBRARY_API_KEY) {
    return { status: "not_configured", items: [] };
  }
  const regionCode = SIDO_TO_LIBRARY_CODE[sido];
  if (!regionCode) {
    return { status: "ok", items: [] };
  }

  const url = new URL("http://data4library.kr/api/libSrch");
  url.searchParams.set("authKey", LIBRARY_API_KEY);
  url.searchParams.set("region", regionCode);
  url.searchParams.set("pageSize", "300");
  url.searchParams.set("format", "json");

  const data = await fetchWithTimeout(url.toString());
  const rawList = data?.response?.libs || [];
  const list = Array.isArray(rawList) ? rawList : [];

  const items = list
    .map((wrap) => wrap.lib || wrap)
    .filter((lib) => !sigungu || (lib.address || "").includes(sigungu));

  return {
    status: "ok",
    items: items.map((lib) => ({
      type: "도서관",
      name: lib.libName || "이름 미상",
      address: lib.address || "",
      tel: lib.tel || "",
    })),
  };
}

/* ---------------- 4) 주민등록 인구통계 ---------------- */

/* 행정안전부_주민등록 인구 및 세대현황 (data.go.kr 1741000
   RegistrationPopulationByRegion). 다른 3개 공공데이터 API와 응답
   구조가 전혀 달라서 extractItems()를 못 쓴다 - response.body.items가
   아니라 { RegistrationPopulationByRegion: [ {head:[...]}, {row:[...]} ] }
   형태이고, ctpvNm/sggNm 같은 지역 필터 파라미터도 받지 않는다(호출할
   때마다 연도 x 시/도 전체를 통째로 돌려준다. 2026-08 기준 2008~2024년,
   302행 확인). 그래서 매번 전체를 받아와 "있는 연도 중 가장 최근 연도 +
   선택한 시/도"에 해당하는 행만 서버에서 골라 쓴다.

   이 데이터셋은 시/도 단위까지만 있고 시군구 인구는 없다. 그래서
   사용자가 고른 시군구가 아니라 그 시군구가 속한 시/도 전체 인구로
   "인구 1만 명당 시설 수" 등급을 계산하게 된다 - 분모(인구)가 시군구
   단위 시설 수(분자)보다 훨씬 커서, 실제보다 등급이 낮게(시설이 부족해
   보이게) 나올 수 있다는 한계가 있다. */
async function fetchPopulation(sido, sigungu) {
  if (!POPULATION_API_KEY || !POPULATION_API_URL) {
    return { status: "not_configured", population: null };
  }
  if (!sido) {
    return { status: "error", population: null, error: "시/도 정보가 없습니다." };
  }

  const url = new URL(POPULATION_API_URL);
  url.searchParams.set("serviceKey", POPULATION_API_KEY);
  url.searchParams.set("type", "json");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("pageNo", "1");

  const data = await fetchWithTimeout(url.toString());
  const parts = data?.RegistrationPopulationByRegion;
  const rowsPart = Array.isArray(parts) ? parts.find((p) => Array.isArray(p?.row)) : null;
  const rows = rowsPart ? rowsPart.row : [];

  if (rows.length === 0) {
    return { status: "error", population: null, error: "응답에서 인구 데이터를 찾지 못했습니다." };
  }

  const latestYear = rows.reduce((max, r) => Math.max(max, Number(r.wrttimeid) || 0), 0);
  const match = rows.find((r) => Number(r.wrttimeid) === latestYear && r.regi === sido);

  if (!match) {
    return { status: "error", population: null, error: `${latestYear}년 ${sido} 인구 데이터를 찾지 못했습니다.` };
  }

  const population = Number(String(match.population_tot).replace(/,/g, ""));
  if (Number.isNaN(population)) {
    return { status: "error", population: null, error: "인구 수치를 해석하지 못했습니다." };
  }

  return { status: "ok", population };
}

/* ---------------- 5) 최신기사 (네이버 뉴스 검색 API) ---------------- */

/* 지역 이슈와 무관한 일반 기사를 모으기 위한 고정 주제 키워드.
   Naver 뉴스 검색은 검색어 기반이라 "최신기사 홈"처럼 무작위로 아무 뉴스나
   보여줄 수는 없어서, 이 키워드들로 매번 검색해 최신순으로 모은다.
   보수/진보 페어링이 목적이므로 정치·정부 관련 키워드를 앞에 둔다 —
   실측 결과 "경제/사회/생활문화" 같은 범주어만으로는 진보 성향 언론사
   (한겨레·경향신문·오마이뉴스·프레시안) 기사가 거의 섞이지 않아 페어를
   만들 상대가 없었지만, "정치/국회/대통령실"류 키워드는 개헌·법안처럼
   보수·진보 매체가 같은 사안을 동시에 다루는 경우가 많아 실제 페어가
   나온다. */
const NEWS_TOPICS = [
  "정치", "국회", "대통령실", "정부", "경제", "사회", "국제", "생활문화", "IT 과학", "스포츠",
];

const NEWS_CACHE_PATH = path.join(__dirname, "data", "news-cache.json");
const NEWS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

/* 잘 알려진 언론사 도메인 -> 표시명 매핑. 목록에 없는 도메인은 호스트명을
   그대로 보여준다. */
const OUTLET_DOMAIN_MAP = {
  "yna.co.kr": "연합뉴스",
  "yonhapnews.co.kr": "연합뉴스",
  "hani.co.kr": "한겨레",
  "chosun.com": "조선일보",
  "joongang.co.kr": "중앙일보",
  "joins.com": "중앙일보",
  "donga.com": "동아일보",
  "khan.co.kr": "경향신문",
  "hankookilbo.com": "한국일보",
  "mk.co.kr": "매일경제",
  "hankyung.com": "한국경제",
  "sedaily.com": "서울경제",
  "news.kbs.co.kr": "KBS",
  "imnews.imbc.com": "MBC",
  "news.sbs.co.kr": "SBS",
  "ytn.co.kr": "YTN",
  "newsis.com": "뉴시스",
  "news1.kr": "뉴스1",
  "ohmynews.com": "오마이뉴스",
  "pressian.com": "프레시안",
  "mt.co.kr": "머니투데이",
  "edaily.co.kr": "이데일리",
  "asiae.co.kr": "아시아경제",
  "seoul.co.kr": "서울신문",
  "kmib.co.kr": "국민일보",
  "munhwa.com": "문화일보",
  "segye.com": "세계일보",
};

/* 언론사 정치 성향(보수/진보) 분류. "같은 사건, 다른 언론사"였던 예전
   페어링을 "같은 사건, 보수 1곳 + 진보 1곳"으로 바꾸기 위해 쓴다.
   언론사 성향 분류는 그 자체로 논쟁적인 주제라, 국내 미디어 리터러시
   교육 자료에서 비교적 이견 없이 보수/진보로 분류되는 신문만 등록했다.
   방송사(KBS/MBC/SBS/YTN), 통신사(연합뉴스/뉴시스/뉴스1), 경제지 등은
   정권에 따라 논조 평가가 갈리거나 분류 근거가 약해 의도적으로
   미분류로 남긴다 — 미분류 언론사의 기사는 페어링 후보에서 제외되고
   단일 기사로 표시된다. */
const OUTLET_ORIENTATION = {
  "조선일보": "conservative",
  "동아일보": "conservative",
  "중앙일보": "conservative",
  "문화일보": "conservative",
  "세계일보": "conservative",
  "국민일보": "conservative",
  "한겨레": "progressive",
  "경향신문": "progressive",
  "오마이뉴스": "progressive",
  "프레시안": "progressive",
};

function outletOrientation(outlet) {
  return OUTLET_ORIENTATION[outlet] || null;
}

function cleanText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .trim();
}

function deriveOutlet(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    for (const [domain, name] of Object.entries(OUTLET_DOMAIN_MAP)) {
      if (host === domain || host.endsWith(`.${domain}`)) return name;
    }
    return host;
  } catch (e) {
    return "언론사 미상";
  }
}

async function fetchNaverNews(query, start = 1) {
  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "100");
  url.searchParams.set("start", String(start));
  url.searchParams.set("sort", "date");

  const data = await fetchWithTimeout(url.toString(), 8000, {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
  });

  const items = data.items || [];
  return items.map((it) => {
    const link = it.originallink || it.link;
    const outlet = deriveOutlet(link);
    return {
      title: cleanText(it.title),
      summary: cleanText(it.description),
      url: link,
      outlet,
      orientation: outletOrientation(outlet),
      date: new Date(it.pubDate).toISOString().slice(0, 10),
    };
  });
}

/* 제목을 음절 2-그램(bigram) 집합으로 쪼갠다. 한국어는 조사·어미가 붙어
   단어 단위로 쪼개면("경제적으로" vs "경제") 같은 사건 기사도 겹치는
   단어가 적게 나오는 문제가 있어, 형태소 분석 없이도 비교적 잘 맞는
   음절 2-그램 방식을 쓴다. 페어를 5쌍 채울 때까지 주제를 늘려가며 같은
   기사 풀에 대해 pairArticles를 반복 호출하므로, 같은 제목의 2-그램을
   매번 다시 계산하지 않도록 캐시해 둔다. */
const bigramCache = new Map();
function bigrams(title) {
  const key = String(title || "");
  const cached = bigramCache.get(key);
  if (cached) return cached;
  const clean = key.replace(/[^\p{L}\p{N}]/gu, "");
  const result = new Set();
  for (let i = 0; i < clean.length - 1; i++) {
    result.add(clean.slice(i, i + 2));
  }
  bigramCache.set(key, result);
  return result;
}

/* 두 제목의 유사도: 겹치는 2-그램 수 / 더 짧은 제목의 2-그램 수. */
function titleSimilarity(a, b) {
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  setA.forEach((t) => {
    if (setB.has(t)) overlap += 1;
  });
  return overlap / Math.min(setA.size, setB.size);
}

/* 같은 주제 검색 결과 안에서 "같은 사건, 보수·진보 관점 비교"로 보여줄
   기사 2건을 짝짓는다. 예전에는 언론사만 다르면 후보로 봤지만, 이제는
   OUTLET_ORIENTATION에 등록된 보수 언론사 1곳과 진보 언론사 1곳인
   조합만 후보로 삼고, 그중 제목 유사도가 임계값 이상인 가장 비슷한
   조합만 짝짓는다. 상대 진영 기사가 없거나(예: 한쪽 진영만 다뤘거나
   둘 다 미분류 매체인 경우) 유사도가 낮으면 단일 기사로 남긴다. 임계값은
   이 프로토타입에서 합리적으로 정한 값이며 정교한 사건 클러스터링을
   보장하지 않는다 — 서로 다른 사건을 잘못 묶는 것보다는 페어링을
   놓치는 쪽(단일 기사로 표시)이 낫다고 보고 다소 보수적으로 잡았다.
   "오늘의 운세", "오늘의 지표" 같이 매일 반복되는 정형화된 제목은
   내용이 달라도 서식이 비슷해 오탐이 나올 수 있다는 한계도 있다. */
const PAIR_SIMILARITY_THRESHOLD = 0.4;

function pairArticles(items) {
  const used = new Array(items.length).fill(false);
  const groups = [];

  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    let bestJ = -1;
    let bestScore = 0;
    if (items[i].orientation) {
      for (let j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        if (!items[j].orientation || items[j].orientation === items[i].orientation) continue;
        const score = titleSimilarity(items[i].title, items[j].title);
        if (score > bestScore) {
          bestScore = score;
          bestJ = j;
        }
      }
    }
    if (bestJ !== -1 && bestScore >= PAIR_SIMILARITY_THRESHOLD) {
      groups.push({ type: "pair", articles: [items[i], items[bestJ]], score: Math.round(bestScore * 100) / 100 });
      used[i] = true;
      used[bestJ] = true;
    } else {
      groups.push({ type: "single", articles: [items[i]] });
      used[i] = true;
    }
  }
  return groups;
}

/* 하루에 새로 쌓는 페어 수. 과거 기사는 절대 지우지 않고 이 아카이브
   파일에 계속 누적된다. 짝을 못 찾은 단일 기사는 화면에 보여줄 게
   아니므로 아카이브에도 저장하지 않는다. */
const TARGET_PAIR_COUNT = 5;

/* 주제 하나당 Naver 뉴스 검색을 몇 페이지까지 더 가져갈지의 상한.
   display=100이 API 최대치라 페이지네이션(start)으로 늘린다. 목표
   페어 수를 채우면 그 즉시 멈추므로, 대부분은 앞쪽 주제(정치/국회/
   대통령실) 한두 페이지에서 끝난다 — 이 상한은 그마저도 부족한 날의
   안전장치일 뿐이다. */
const MAX_PAGES_PER_TOPIC = 5;

function readNewsArchive() {
  try {
    const raw = fs.readFileSync(NEWS_CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return {
      archive: Array.isArray(data.archive) ? data.archive : [],
      lastFetchedAt: data.lastFetchedAt || null,
    };
  } catch (e) {
    return { archive: [], lastFetchedAt: null };
  }
}

function writeNewsArchive(store) {
  try {
    fs.mkdirSync(path.dirname(NEWS_CACHE_PATH), { recursive: true });
    fs.writeFileSync(NEWS_CACHE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("뉴스 아카이브 저장 실패:", e.message);
  }
}

function collectExistingUrls(archive) {
  const urls = new Set();
  archive.forEach((g) => g.articles.forEach((a) => urls.add(a.url)));
  return urls;
}

function sortGroupsByDateDesc(groups) {
  return [...groups].sort((a, b) => {
    const dateA = a.articles[0]?.date || "";
    const dateB = b.articles[0]?.date || "";
    return dateB.localeCompare(dateA);
  });
}

/* 오늘 새로 올라온(=아카이브에 아직 없는) 기사를 모아 페어링한 뒤,
   보수·진보가 짝지어진 페어만 상위 TARGET_PAIR_COUNT개 가져온다. 단일
   기사(짝을 못 찾은 기사)는 그대로 버린다 — 다음 24시간 주기에 그
   기사가 다시 검색되면 그때 새로 올라온 반대 진영 기사와 짝지어질 수도
   있으니 완전히 사라지는 것은 아니다.

   주제 하나·페이지 하나를 검색할 때마다 지금까지 모은 기사 풀 전체로
   다시 페어링을 시도해, 목표 페어 수를 채우면 그 자리에서 멈춘다.
   여러 주제에 걸쳐 같은 기사가 중복 검색될 수 있어 URL 기준으로
   중복을 제거한 뒤 풀에 넣는다. */
async function fetchDailyGroups(existingUrls) {
  const pool = [];
  const poolUrls = new Set();
  let pairs = [];

  function addFreshItems(items) {
    for (const it of items) {
      if (existingUrls.has(it.url) || poolUrls.has(it.url)) continue;
      poolUrls.add(it.url);
      pool.push(it);
    }
  }

  outer: for (const topic of NEWS_TOPICS) {
    for (let page = 0; page < MAX_PAGES_PER_TOPIC; page++) {
      const items = await fetchNaverNews(topic, page * 100 + 1);
      addFreshItems(items);
      pairs = pairArticles(pool).filter((g) => g.type === "pair");
      if (pairs.length >= TARGET_PAIR_COUNT) break outer;
      if (items.length < 100) break; // 이 주제는 결과가 소진됨
    }
  }

  const addedAt = new Date().toISOString();
  return sortGroupsByDateDesc(pairs)
    .slice(0, TARGET_PAIR_COUNT)
    .map((g) => ({ ...g, addedAt }));
}

/* 24시간이 지나지 않았으면 저장된 아카이브를 그대로 쓰고, 지났으면
   오늘자 신규 그룹만 가져와 아카이브 앞에 이어붙인다. 기존 항목은
   절대 삭제하거나 덮어쓰지 않는다. */
async function getLatestNewsArchive(forceRefresh) {
  const store = readNewsArchive();
  const isFresh =
    store.lastFetchedAt && Date.now() - new Date(store.lastFetchedAt).getTime() < NEWS_CACHE_TTL_MS;

  if (isFresh && !forceRefresh) {
    return { status: "ok", archive: store.archive, lastFetchedAt: store.lastFetchedAt, error: null };
  }

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return {
      status: store.archive.length > 0 ? "ok" : "not_configured",
      archive: store.archive,
      lastFetchedAt: store.lastFetchedAt,
      error: null,
    };
  }

  try {
    const existingUrls = collectExistingUrls(store.archive);
    const newGroups = await fetchDailyGroups(existingUrls);
    const mergedArchive = [...newGroups, ...store.archive];
    const lastFetchedAt = new Date().toISOString();
    writeNewsArchive({ archive: mergedArchive, lastFetchedAt });
    return { status: "ok", archive: mergedArchive, lastFetchedAt, error: null };
  } catch (err) {
    // 새로 못 가져왔어도 기존에 쌓아둔 아카이브는 그대로 보여준다.
    return {
      status: store.archive.length > 0 ? "ok" : "error",
      archive: store.archive,
      lastFetchedAt: store.lastFetchedAt,
      error: err.message,
    };
  }
}

/* ---------------- 6) 지역 이슈 자동 발견 ---------------- */

/* region-data.js의 REGIONS와 완전히 같은 17개 시/도 이름 목록이다 -
   서버는 브라우저 전용 스크립트를 require할 수 없어 새로 만드는 대신,
   이미 있는 SIDO_TO_LIBRARY_CODE(도서관 API용)의 키를 그대로 재사용한다. */
const REGION_NAMES = Object.keys(SIDO_TO_LIBRARY_CODE);

/* 제목 토큰화용 불용어. 기사 제목에 자주 나오지만 "그 지역에서 반복되는
   화제"와는 무관한 단어들이다. */
const KEYWORD_STOPWORDS = new Set([
  "기자", "뉴스", "단독", "속보", "영상", "사진", "오늘", "이번", "지난",
  "관련", "종합", "전문", "현장", "공식", "발표", "오전", "오후", "이후",
  "위해", "통해", "대한", "등의", "등을", "등이", "경우", "때문", "모든",
  "우리", "그리고", "하지만", "이날", "운세", "날씨",
]);

/* 자주 붙는 조사/어미를 대략적으로 잘라낸다. 형태소 분석이 아니라
   문자열 접미사 매칭이라 완벽하지 않다 - 긴 접미사부터 먼저 검사해야
   "~에서"를 "~서"로 잘못 잘라내는 실수를 줄일 수 있다. */
const PARTICLE_SUFFIXES = [
  "으로부터", "에서부터", "이라며", "이라고", "하다며", "한다며", "했다며",
  "에서", "으로", "이라", "까지", "부터", "에게", "한테", "보다", "처럼",
  "마저", "조차", "마다", "라며", "라고",
  "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "만", "로", "라",
];

function stripParticle(token) {
  for (const suf of PARTICLE_SUFFIXES) {
    if (token.length > suf.length + 1 && token.endsWith(suf)) {
      return token.slice(0, -suf.length);
    }
  }
  return token;
}

function tokenizeTitle(title, region) {
  const words = String(title || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens = [];
  for (const word of words) {
    const stripped = stripParticle(word);
    if (stripped.length < 2) continue;
    if (stripped === region) continue;
    if (KEYWORD_STOPWORDS.has(stripped)) continue;
    if (/^\d+$/.test(stripped)) continue;
    if (/^\d+(월|일|년|시|분)$/.test(stripped)) continue; // "8월", "24일"처럼 반복되는 날짜 조각 제외
    tokens.push(stripped);
  }
  return tokens;
}

/* 그 지역 기사 제목들에서 자주 등장하는 단어 상위 N개를 뽑는다. 형태소
   분석 없이 하는 빈도 집계라 정교한 토픽 추출이 아니라 근사치다. 같은
   기사 안에서 단어가 여러 번 나와도 1번으로만 센다(한 기사가 통계를
   과도하게 좌우하지 않도록). */
function extractTopKeywords(items, region, maxKeywords) {
  const freq = new Map();
  for (const it of items) {
    const uniqueTokens = new Set(tokenizeTitle(it.title, region));
    uniqueTokens.forEach((tok) => freq.set(tok, (freq.get(tok) || 0) + 1));
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([keyword]) => keyword);
}

function isWithinRecentDays(dateStr, days) {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 24 * 60 * 60 * 1000;
}

/* 최소한의 안전장치용 욕설/자극적 표현 목록 (요구사항: "최소한의
   안전장치"). 본격적인 콘텐츠 모더레이션 시스템이 아니라, 후보 화면에
   명백히 부적절한 기사가 올라가는 것만 막는 작은 하드코딩 목록이다. */
const PROFANITY_TERMS = [
  "씨발", "시발", "개새끼", "병신", "지랄", "좆같", "미친놈", "미친년", "썅",
];

function containsProfanity(text) {
  const t = String(text || "");
  return PROFANITY_TERMS.some((term) => t.includes(term));
}

/* NPF(정책서사분석기준) 자동 태깅 사전. about.html이 방문자에게 이미
   보여주는 카테고리별 예시 단어를 시드로 썼다. 형태소 분석/개체명
   인식이 아니라 단순 키워드 등장 횟수 기반 근사 분류이며, 네이버 검색
   API가 주는 제목+요약(스니펫)만 보고 판단한다 - 기사 본문 전체는
   가져오지 않는다. 매칭되는 단어가 하나도 없으면 값을 추정해서 채우지
   않고 빈 문자열로 남긴다. 자동 태깅은 최종 판단이 아니라 초안이며,
   관리자가 기존 "기사 관리" 수정 폼(assets/js/admin.js의 fillForm)으로
   언제든 값을 고칠 수 있다. */
const NPF_DICTIONARIES = {
  victim: ["희생자", "유가족", "시민", "청년", "지역 주민", "주민", "지역 대학", "유권자", "학생", "청소년", "소상공인", "노동자", "농민"],
  responsible: ["국가폭력", "군부", "왜곡", "중앙정부", "수도권 집중", "정권", "정치권", "산업 구조", "정부", "지자체", "시청", "구청", "교육청", "경찰", "기업", "국회"],
  solver: ["정부", "지자체", "국회", "사법부", "시민사회", "지역 대학", "교육청", "경찰"],
  policy: ["처벌", "교육", "진상규명", "균형발전", "인프라", "분산", "일자리", "공공기관 이전", "예산", "지원금", "제도 개선"],
};

/* 감정은 자유 텍스트가 아니라 EMOTION_CHECK_SCHEMA(assets/js/admin.js)의
   감정 자가점검 설문과 같은 어휘를 쓴다 - 앱 전체에서 "감정" 라벨을
   통일하기 위함. "특별한 감정 없음"/"기타"는 설문 응답 전용 선택지라
   자동분류 결과로는 절대 나오지 않게 제외했다(모르면 빈 문자열). */
const EMOTION_KEYWORDS = {
  "분노": ["분노", "공분", "격분", "규탄"],
  "불안": ["불안", "우려", "걱정", "위기"],
  "안타까움": ["안타깝", "눈물", "비극", "참사"],
  "자부심": ["자부심", "성과", "우수", "모범"],
  "불신": ["불신", "의혹", "논란", "비판"],
};

function countOccurrences(text, term) {
  if (!term) return 0;
  let count = 0;
  let idx = text.indexOf(term);
  while (idx !== -1) {
    count += 1;
    idx = text.indexOf(term, idx + term.length);
  }
  return count;
}

function pickBestTerm(text, terms) {
  let bestTerm = "";
  let bestCount = 0;
  for (const term of terms) {
    const count = countOccurrences(text, term);
    if (count > bestCount) {
      bestCount = count;
      bestTerm = term;
    }
  }
  return bestTerm;
}

function pickBestLabel(text, labelToTerms) {
  let bestLabel = "";
  let bestCount = 0;
  for (const [label, terms] of Object.entries(labelToTerms)) {
    const count = terms.reduce((sum, term) => sum + countOccurrences(text, term), 0);
    if (count > bestCount) {
      bestCount = count;
      bestLabel = label;
    }
  }
  return bestLabel;
}

function classifyArticleNpf(article) {
  const text = `${article.title} ${article.summary || ""}`;
  return {
    victim: pickBestTerm(text, NPF_DICTIONARIES.victim),
    responsible: pickBestTerm(text, NPF_DICTIONARIES.responsible),
    solver: pickBestTerm(text, NPF_DICTIONARIES.solver),
    policy: pickBestTerm(text, NPF_DICTIONARIES.policy),
    emotion: pickBestLabel(text, EMOTION_KEYWORDS),
  };
}

const MAX_KEYWORDS_PER_REGION = 4;
const MIN_MATCHED_ARTICLES = 5;
const RECENT_DAYS = 7;
const CANDIDATE_DEDUP_THRESHOLD = 0.5; // 기사 페어링(0.4)보다 다소 느슨하게 - 후보 스팸보다 중복 접기를 우선한다
const NAVER_CALL_PACING_MS = 250; // 네이버 API에 짧은 시간에 몰아치지 않기 위한 페이싱

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchExistingIssueTitles() {
  const { data, error } = await supabaseAdmin.from("issues").select("title");
  if (error) {
    console.error("이슈 목록 조회 실패:", error.message);
    return [];
  }
  return (data || []).map((row) => row.title);
}

async function fetchPendingCandidateTitles() {
  const { data, error } = await supabaseAdmin
    .from("issue_candidates")
    .select("title")
    .eq("status", "pending");
  if (error) {
    console.error("이슈 후보 목록 조회 실패:", error.message);
    return [];
  }
  return (data || []).map((row) => row.title);
}

function isDuplicateTopic(candidateTitle, existingTitles) {
  return existingTitles.some((title) => titleSimilarity(candidateTitle, title) >= CANDIDATE_DEDUP_THRESHOLD);
}

/* 시/도마다: (A) 지역명 자체로 검색해 빈출 키워드를 뽑고, (B) 키워드별로
   "{지역명} {키워드}"를 재검색해 최근 7일 이내 기사가 5건 이상이면 원시
   후보로 삼고, (C) 기존 이슈·대기 중 후보와 제목 유사도로 중복을
   거르고, (D) 욕설이 섞인 기사를 빼고도 5건 이상 남는 것만, (E) NPF
   태그를 붙여 issue_candidates에 저장한다. 17개 지역 × (추출 1회 +
   검증 최대 MAX_KEYWORDS_PER_REGION회) 만큼 네이버를 순차 호출하므로
   수십 초~수 분이 걸릴 수 있다 - 관리자가 버튼을 눌렀을 때만 실행하는
   것도 이 때문이다. */
async function runIssueDiscovery(regions) {
  const startedAt = Date.now();
  const existingTitles = [
    ...(await fetchExistingIssueTitles()),
    ...(await fetchPendingCandidateTitles()),
  ];
  const seenThisRun = [];

  const candidatesToInsert = [];
  let skippedDuplicate = 0;
  let skippedProfanity = 0;
  const errors = [];

  for (const region of regions) {
    try {
      await sleep(NAVER_CALL_PACING_MS);
      const seedItems = await fetchNaverNews(region, 1);
      const keywords = extractTopKeywords(seedItems, region, MAX_KEYWORDS_PER_REGION);

      for (const keyword of keywords) {
        await sleep(NAVER_CALL_PACING_MS);
        const topicItems = await fetchNaverNews(`${region} ${keyword}`, 1);
        const recentItems = topicItems.filter((it) => isWithinRecentDays(it.date, RECENT_DAYS));
        if (recentItems.length < MIN_MATCHED_ARTICLES) continue;

        const candidateTitle = `${region} ${keyword}`;
        if (isDuplicateTopic(candidateTitle, [...existingTitles, ...seenThisRun])) {
          skippedDuplicate += 1;
          continue;
        }

        const cleanItems = recentItems.filter(
          (it) => !containsProfanity(it.title) && !containsProfanity(it.summary)
        );
        if (cleanItems.length < MIN_MATCHED_ARTICLES) {
          skippedProfanity += 1;
          continue;
        }

        candidatesToInsert.push({
          region,
          keyword,
          title: candidateTitle,
          question: `${region} ${keyword} 문제의 책임과 해결책은 언론사마다 어떻게 다르게 제시되고 있을까요`,
          description: `최근 ${RECENT_DAYS}일간 ${region}에서 "${keyword}" 키워드로 ${cleanItems.length}건의 관련 기사가 확인되었습니다. (자동 발견 후보)`,
          matched_count: cleanItems.length,
          matched_articles: cleanItems.map((it) => ({ ...it, npf: classifyArticleNpf(it) })),
        });
        seenThisRun.push(candidateTitle);
      }
    } catch (err) {
      console.error(`이슈 후보 탐색 실패 (${region}):`, err.message);
      errors.push({ region, message: err.message });
    }
  }

  let inserted = 0;
  if (candidatesToInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("issue_candidates")
      .insert(candidatesToInsert)
      .select("id");
    if (error) throw new Error(`이슈 후보 저장 실패: ${error.message}`);
    inserted = data?.length || 0;
  }

  return {
    inserted,
    skippedDuplicate,
    skippedProfanity,
    regionsProcessed: regions.length,
    durationMs: Date.now() - startedAt,
    errors,
  };
}

/* Authorization: Bearer <supabase access token> 헤더를 확인해 관리자인
   경우에만 사용자 객체를 반환한다(아니면 null). server.js는 원래 어떤
   요청도 인증하지 않는 완전 공개 서버였는데, 이 라우트는 실제로 네이버
   API를 여러 번 호출하고 DB에 쓰기 때문에 익명 요청을 막을 필요가 있다.
   RLS를 우회하는 supabaseAdmin으로 토큰 검증과 profiles.role 조회를
   모두 수행한다. */
async function requireAdmin(req) {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || profile?.role !== "admin") return null;

  return userData.user;
}

/* ---------------- 7) 지역신문 코너 ---------------- */

/* 전국 이슈 3개(5·18/대구경북/수도권비수도권)와는 완전히 별개인 코너다.
   방문자가 고른 시/도의 지역신문 기사만 시간순으로 나열해서 보여주며,
   NPF 서사분석이나 보수/진보 비교는 적용하지 않는다("2) 지역신문
   코너" 요구사항).

   시/도 -> 지역신문(이름, 기사 링크 도메인) 매핑. 지역신문은 대체로
   광역시/도 단위로 발행되어(시/군/구 전담지는 흔치 않음) region-data.js
   REGIONS의 키(시/도)와 동일한 키를 쓴다. 시/도마다 대표 지역신문
   1~2곳을 골라 실제 홈페이지 도메인을 웹 검색으로 확인해 넣었다(2026-08
   기준). 서울특별시는 "서울신문"처럼 전국적으로 읽히는 종합지는 있지만
   다른 시/도의 oo일보처럼 그 지역 밀착 보도를 전문으로 하는 지역신문이
   뚜렷하지 않아, 억지로 끼워 맞추는 대신 빈 배열로 두고
   "지역신문 준비 중"으로 안내한다. 신문사가 개편되거나 도메인이
   바뀌면 이 표만 고치면 된다. */
const LOCAL_NEWSPAPER_DOMAINS = {
  "서울특별시": [],
  "부산광역시": [
    { name: "부산일보", domain: "busan.com" },
    { name: "국제신문", domain: "kookje.co.kr" },
  ],
  "대구광역시": [
    { name: "매일신문", domain: "imaeil.com" },
    { name: "영남일보", domain: "yeongnam.com" },
  ],
  "인천광역시": [
    { name: "인천일보", domain: "incheonilbo.com" },
    { name: "경인일보", domain: "kyeongin.com" },
  ],
  "광주광역시": [
    { name: "광주일보", domain: "kwangju.co.kr" },
    { name: "무등일보", domain: "mdilbo.com" },
    { name: "광주매일신문", domain: "kjdaily.com" },
  ],
  "대전광역시": [
    { name: "대전일보", domain: "daejonilbo.com" },
    { name: "중도일보", domain: "joongdo.co.kr" },
  ],
  "울산광역시": [
    { name: "경상일보", domain: "ksilbo.co.kr" },
    { name: "울산신문", domain: "ulsanpress.net" },
  ],
  "세종특별자치시": [{ name: "세종의소리", domain: "sjsori.com" }],
  "경기도": [
    { name: "경기일보", domain: "kyeonggi.com" },
    { name: "경인일보", domain: "kyeongin.com" },
  ],
  "강원특별자치도": [
    { name: "강원일보", domain: "kwnews.co.kr" },
    { name: "강원도민일보", domain: "kado.net" },
  ],
  "충청북도": [
    { name: "충북일보", domain: "inews365.com" },
    { name: "중부매일", domain: "jbnews.com" },
  ],
  "충청남도": [
    { name: "충청투데이", domain: "cctoday.co.kr" },
    { name: "금강일보", domain: "ggilbo.com" },
  ],
  "전북특별자치도": [
    { name: "전북일보", domain: "jjan.kr" },
    { name: "새전북신문", domain: "sjbnews.com" },
  ],
  "전라남도": [
    { name: "전남일보", domain: "jnilbo.com" },
    { name: "무등일보", domain: "mdilbo.com" },
  ],
  "경상북도": [
    { name: "경북일보", domain: "kyongbuk.co.kr" },
    { name: "경북매일", domain: "kbmaeil.com" },
    { name: "영남일보", domain: "yeongnam.com" },
  ],
  "경상남도": [
    { name: "경남신문", domain: "knnews.co.kr" },
    { name: "경남도민일보", domain: "idomin.com" },
  ],
  "제주특별자치도": [
    { name: "제주일보", domain: "jejunews.com" },
    { name: "한라일보", domain: "ihalla.com" },
  ],
};

function linkMatchesDomain(link, domain) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  } catch (e) {
    return false;
  }
}

/* 서울특별시는 LOCAL_NEWSPAPER_DOMAINS에 등록된 자체 지역신문이 없다
   (위 주석 참고). 그렇다고 방문자에게 아무 기사도 안 보여주는 대신,
   서울이 선택됐을 때만 수도권(경기·인천) 지역신문으로 대신 채운다.
   fetchLocalNews가 이 대체가 일어났는지를 fallbackOf로 알려주면,
   화면에서 "서울 지역신문이 준비 중이라 수도권 뉴스를 보여드립니다"
   같은 안내를 붙일 수 있다. */
const SEOUL_FALLBACK_SIDOS = ["경기도", "인천광역시"];

/* 시/도 하나를 다시 조회하는 빈도가 잦을 수 있어(지역 현황 화면을
   새로고침할 때마다) 짧게 메모리 캐시한다 - "최신기사"처럼 영구
   아카이브가 필요한 기능은 아니라서 서버 재시작 시 사라져도 무방하다. */
const LOCAL_NEWS_CACHE_TTL_MS = 15 * 60 * 1000; // 15분
const localNewsCache = new Map(); // 캐시 키(시/도 또는 "fallback:서울특별시") -> { items, fetchedAt }

/* 시/도별로 등록된 지역신문 이름을 그대로 네이버 뉴스 검색어로 써서
   기사를 모은 뒤, 실제로 그 신문사 도메인에서 나온 기사만 남긴다(검색어
   매칭만으로는 그 신문사를 인용/언급한 다른 매체 기사도 섞이기 때문에
   도메인 확인이 필수). 여러 신문사 결과를 합쳐 최신순으로 정렬한다. */
async function fetchLocalNews(sido) {
  let papers = LOCAL_NEWSPAPER_DOMAINS[sido] || [];
  let fallbackOf = null;

  if (sido === "서울특별시" && papers.length === 0) {
    fallbackOf = sido;
    const seenDomains = new Set();
    papers = SEOUL_FALLBACK_SIDOS.flatMap((s) => LOCAL_NEWSPAPER_DOMAINS[s] || []).filter((p) => {
      if (seenDomains.has(p.domain)) return false; // 경인일보처럼 경기·인천에 중복 등록된 신문사 제외
      seenDomains.add(p.domain);
      return true;
    });
  }

  const outlets = papers.map((p) => p.name);

  if (papers.length === 0) {
    return { status: "not_configured", outlets, items: [], fallbackOf, topKeywords: [] };
  }
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return { status: "not_configured", outlets, items: [], fallbackOf, topKeywords: [] };
  }

  const cacheKey = fallbackOf ? `fallback:${fallbackOf}` : sido;
  const cached = localNewsCache.get(cacheKey);
  let items;

  if (cached && Date.now() - cached.fetchedAt < LOCAL_NEWS_CACHE_TTL_MS) {
    items = cached.items;
  } else {
    const seenUrls = new Set();
    const fetched = [];
    for (const paper of papers) {
      try {
        const results = await fetchNaverNews(paper.name, 1);
        results
          .filter((it) => linkMatchesDomain(it.url, paper.domain))
          .forEach((it) => {
            if (seenUrls.has(it.url)) return;
            seenUrls.add(it.url);
            fetched.push({ ...it, outlet: paper.name });
          });
      } catch (err) {
        console.error(`지역신문(${paper.name}) 조회 실패:`, err.message);
      }
    }
    fetched.sort((a, b) => b.date.localeCompare(a.date));
    items = fetched.slice(0, 30);
    localNewsCache.set(cacheKey, { items, fetchedAt: Date.now() });
  }

  /* "주요 지역 이슈" 카드용 - 지역신문 기사 제목에서 자주 등장하는
     단어를 뽑는다. 지역 이슈 자동 발견(위 extractTopKeywords)과 완전히
     같은 로직을 재사용한다. 기사 수가 너무 적으면(1~2건) 단어 하나가
     통계를 과도하게 좌우해서 억지스러운 키워드가 나올 수 있어, 최소
     기사 수를 넘을 때만 계산한다 - 그 미만이면 topKeywords를 빈 배열로
     둬서 화면이 "확인 가능한 지역 이슈가 부족합니다"로 안내하게 한다. */
  const MIN_ARTICLES_FOR_LOCAL_ISSUE_KEYWORDS = 3;
  let topKeywords = [];
  if (items.length >= MIN_ARTICLES_FOR_LOCAL_ISSUE_KEYWORDS) {
    // "부산일보"처럼 신문사 이름 자체가 제목에 자주 등장해 키워드로
    // 뽑히는 경우가 많아(예: "<부산일보> 취재 결과..."), 후보를 넉넉히
    // 뽑은 뒤 신문사 이름을 걸러내고 상위 3개만 남긴다.
    const candidates = extractTopKeywords(items, sido, 8);
    topKeywords = candidates.filter((kw) => !outlets.some((name) => name.includes(kw) || kw.includes(name))).slice(0, 3);
  }

  return { status: "ok", outlets, items, fallbackOf, topKeywords };
}

/* ---------------- 라우트 ---------------- */

function wrapRoute(fn) {
  return async (req, res) => {
    const { sido = "", sigungu = "" } = req.query;
    try {
      const result = await fn(sido, sigungu);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(502).json({ status: "error", items: [], error: err.message });
    }
  };
}

app.get("/api/youth-facilities", wrapRoute(fetchYouthFacilities));
app.get("/api/counseling-centers", wrapRoute(fetchCounselingCenters));
app.get("/api/libraries", wrapRoute(fetchLibraries));
app.get("/api/population", wrapRoute(fetchPopulation));

app.get("/api/local-news", async (req, res) => {
  try {
    const sido = req.query.sido || "";
    const result = await fetchLocalNews(sido);
    res.json(result);
  } catch (err) {
    console.error("지역신문 조회 실패:", err);
    res.status(502).json({ status: "error", outlets: [], items: [], error: err.message });
  }
});

app.get("/api/latest-news", async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "1";
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await getLatestNewsArchive(forceRefresh);
    const sorted = sortGroupsByDateDesc(result.archive);
    /* 전국 이슈 3개(issue_discovery.sql/admin.js)에 쓰던 것과 같은
       classifyArticleNpf()를 그대로 재사용해 기사마다 NPF(피해자/책임
       주체/해결자/감정/정책대안) 태그를 붙인다. 사람이 확인한 값이
       아니라 매번 요청 시점에 제목+요약만 보고 자동으로 추정한
       값이라, 클라이언트에서 "실시간 자동 분류" 안내를 함께 보여준다. */
    const page = sorted.slice(offset, offset + limit).map((group) => ({
      ...group,
      articles: group.articles.map((article) => ({ ...article, npf: classifyArticleNpf(article) })),
    }));

    res.json({
      status: result.status,
      error: result.error,
      groups: page,
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + limit < sorted.length,
      lastFetchedAt: result.lastFetchedAt,
    });
  } catch (err) {
    console.error("최신기사 조회 실패:", err);
    res.status(502).json({ status: "error", groups: [], total: 0, hasMore: false, error: err.message });
  }
});

app.post("/api/issue-discovery/run", async (req, res) => {
  if (!supabaseAdmin) {
    return res
      .status(501)
      .json({ status: "not_configured", error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." });
  }

  const user = await requireAdmin(req);
  if (!user) {
    return res.status(403).json({ status: "error", error: "관리자만 사용할 수 있습니다." });
  }

  try {
    const regions =
      Array.isArray(req.body?.regions) && req.body.regions.length ? req.body.regions : REGION_NAMES;
    const result = await runIssueDiscovery(regions);
    res.json({ status: "ok", ...result });
  } catch (err) {
    console.error("이슈 후보 탐색 실패:", err);
    res.status(502).json({ status: "error", error: err.message });
  }
});

app.get("/api/facilities", async (req, res) => {
  const { sido = "", sigungu = "" } = req.query;

  const [youthFacilities, counselingCenters, libraries, population] = await Promise.allSettled([
    fetchYouthFacilities(sido, sigungu),
    fetchCounselingCenters(sido, sigungu),
    fetchLibraries(sido, sigungu),
    fetchPopulation(sido, sigungu),
  ]);

  function unwrap(settled, label, fallback) {
    if (settled.status === "fulfilled") return settled.value;
    console.error(`${label} 조회 실패:`, settled.reason);
    return { status: "error", error: settled.reason?.message || "알 수 없는 오류", ...fallback };
  }

  const youthFacilitiesResult = unwrap(youthFacilities, "청소년수련시설", { items: [] });
  const counselingCentersResult = unwrap(counselingCenters, "청소년상담복지센터", { items: [] });
  const librariesResult = unwrap(libraries, "도서관", { items: [] });
  const populationResult = unwrap(population, "인구통계", { population: null });

  const facilityCategories = [youthFacilitiesResult, counselingCentersResult, librariesResult];
  const completeFacilityData = facilityCategories.every((c) => c.status === "ok");
  const facilityCount = facilityCategories
    .filter((c) => c.status === "ok")
    .reduce((sum, c) => sum + c.items.length, 0);

  const stats = {
    population: populationResult.population,
    populationStatus: populationResult.status,
    populationError: populationResult.error || null,
    facilityCount,
    completeFacilityData,
    ratePer10k: null,
    grade: null,
    gradeLabel: null,
    gradeDesc: null,
    thresholds: GRADE_THRESHOLDS,
  };

  if (populationResult.status === "ok" && populationResult.population > 0) {
    const rate = (facilityCount / populationResult.population) * 10000;
    const g = computeGrade(rate);
    stats.ratePer10k = Math.round(rate * 100) / 100;
    stats.grade = g.grade;
    stats.gradeLabel = g.label;
    stats.gradeDesc = g.desc;
  }

  res.json({
    youthFacilities: youthFacilitiesResult,
    counselingCenters: counselingCentersResult,
    libraries: librariesResult,
    stats,
  });
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  if (!YOUTH_FACILITY_API_KEY) console.warn("- YOUTH_FACILITY_API_KEY가 비어 있습니다. .env를 확인하세요.");
  if (!COUNSELING_CENTER_API_URL) console.warn("- COUNSELING_CENTER_API_URL이 비어 있습니다. 데이터포털 활용신청 페이지의 요청 URL을 붙여넣어야 합니다.");
  if (!LIBRARY_API_KEY) console.warn("- LIBRARY_API_KEY가 비어 있습니다. .env를 확인하세요.");
  if (!POPULATION_API_URL) console.warn("- POPULATION_API_URL이 비어 있습니다. 데이터포털 활용신청 페이지의 요청 URL을 붙여넣어야 합니다.");
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) console.warn("- NAVER_CLIENT_ID/SECRET이 비어 있습니다. .env를 확인하세요.");
  if (!supabaseAdmin) console.warn("- SUPABASE_SERVICE_ROLE_KEY가 비어 있습니다. 지역 이슈 자동 발견 기능을 쓰려면 .env에 설정하세요.");
});

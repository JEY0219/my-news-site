/* ---------------------------------------------------------
   언론사 정치 성향(보수/진보) 매핑 - 클라이언트 공용
   - server.js의 OUTLET_ORIENTATION(최신기사 페어링용)과 동일한 기준을
     쓴다. "보수/진보 비교" 코너(article-compare.js)에서 같은 이슈를
     다룬 보수 언론사 기사와 진보 언론사 기사를 나란히 보여주기 위해
     articles 테이블의 outlet 문자열을 이 맵으로 분류한다.
   - 국내 미디어 리터러시 교육 자료에서 비교적 이견 없이 보수/진보로
     분류되는 신문만 등록했다(서버 쪽과 동일한 이유). 방송사·통신사·
     경제지 등은 미분류로 남기며, 미분류 언론사의 기사는 어느 쪽에도
     들어가지 않는다.
   - articles.outlet에는 "오마이뉴스 (계열)"처럼 뒤에 부가 설명이 붙은
     값도 있어, 정확히 일치가 아니라 이 맵의 언론사명을 부분 문자열로
     포함하는지로 판단한다.
--------------------------------------------------------- */

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

const ORIENTATION_LABEL = {
  conservative: "보수",
  progressive: "진보",
};

function classifyOutletOrientation(outletName) {
  const name = String(outletName || "");
  for (const [outlet, orientation] of Object.entries(OUTLET_ORIENTATION)) {
    if (name.includes(outlet)) return orientation;
  }
  return null;
}

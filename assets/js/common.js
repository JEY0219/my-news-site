/* ---------------------------------------------------------
   공통 상단 메뉴 / 하단 안내 렌더링
   각 페이지는 <body data-page="..."> 값과
   <div id="app-header"></div>, <div id="app-footer"></div> 를 두고
   이 스크립트를 로드하면 된다.
--------------------------------------------------------- */

const REGION_STORAGE_KEY = "youthNews.selectedRegion";

function getSelectedRegion() {
  try {
    const raw = localStorage.getItem(REGION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSelectedRegion(sido, sigungu, opts) {
  const value = { sido, sigungu, viaGps: !!(opts && opts.viaGps) };
  localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(value));
  return value;
}

function clearSelectedRegion() {
  localStorage.removeItem(REGION_STORAGE_KEY);
}

const NAV_ITEMS = [
  { id: "home", label: "홈", href: "index.html" },
  { id: "my-region", label: "내지역", href: null }, // 동적 결정
  { id: "local-news", label: "지역신문", href: "local-news.html" },
  // "지역 이슈"(issues.html) 메뉴는 상단 공통 메뉴에서 뺐다 - issues.html
  // 자체와 전국 이슈 3개 콘텐츠는 그대로 있고, region-status.html의
  // "전국 이슈 확인하기" 버튼을 통해서만 들어가도록 진입 경로를 좁혔다
  // (2026-08-25).
  { id: "articles", label: "서사분석", href: "article-compare.html" },
  // "지역 비교"(region-compare.html) 메뉴는 뺐다 - 페이지 파일 자체는
  // 그대로 남아 있다(2026-08-25).
  { id: "latest", label: "기사비교", href: "latest-news.html" },
  { id: "survey", label: "설문참여", href: "survey.html" },
  { id: "about", label: "연구소개", href: "about.html" },
  { id: "login", label: "로그인", href: "login.html" }, // 동적 라벨
];

/* ---------------------------------------------------------
   로그인 상태 (비회원 익명코드 / 회원·관리자 세션)
--------------------------------------------------------- */

const GUEST_CODE_KEY = "youthNews.guestCode";

function getGuestCode() {
  return localStorage.getItem(GUEST_CODE_KEY) || "";
}

function setGuestCode(code) {
  localStorage.setItem(GUEST_CODE_KEY, code);
}

function clearGuestCode() {
  localStorage.removeItem(GUEST_CODE_KEY);
}

/**
 * 현재 로그인 상태를 판별한다.
 * 반환값: { kind: "admin"|"member" } + { userId, email }
 *        | { kind: "guest", code }
 *        | { kind: "none" }
 */
async function getIdentity() {
  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    const session = data && data.session;
    if (session && session.user) {
      let role = "member";
      try {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile && profile.role) role = profile.role;
      } catch (e) {
        // profiles 조회 실패 시 기본값(member) 유지
      }
      return {
        kind: role === "admin" ? "admin" : "member",
        userId: session.user.id,
        email: session.user.email,
      };
    }
  }
  const code = getGuestCode();
  if (code) return { kind: "guest", code };
  return { kind: "none" };
}

/**
 * survey_responses / emotion_check_responses 삽입·조회에 쓰는 참여자
 * 식별 정보를 만든다. 로그인도, 식별번호도 없으면 null을 반환한다.
 */
async function getParticipantDescriptor() {
  const identity = await getIdentity();
  if (identity.kind === "member" || identity.kind === "admin") {
    return { participant_kind: "member", user_id: identity.userId, anon_code: null };
  }
  if (identity.kind === "guest") {
    return { participant_kind: "guest", user_id: null, anon_code: identity.code };
  }
  return null;
}

async function signOutCurrentUser() {
  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  clearGuestCode();
}

function renderHeader() {
  const mount = document.getElementById("app-header");
  if (!mount) return;

  const currentPage = document.body.dataset.page || "";
  const region = getSelectedRegion();

  function buildLinks(loginLabel, showAdmin) {
    const items = showAdmin
      ? [...NAV_ITEMS.slice(0, -1), { id: "admin", label: "관리자", href: "admin.html" }, NAV_ITEMS[NAV_ITEMS.length - 1]]
      : NAV_ITEMS;
    return items.map((item) => {
      let href = item.href;
      let label = item.label;
      if (item.id === "my-region") {
        href = region ? "region-status.html" : "region-select.html";
      }
      if (item.id === "login" && loginLabel) {
        label = loginLabel;
      }
      const current = currentPage === item.id ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${label}</a>`;
    }).join("");
  }

  /* region-select.html은 ?mode= 없이 들어오면(아래 region-select.js
     참고) 현재 선택된 지역을 보여주면서 "지역이 다른가요? 다시
     선택하기" 버튼이 있는 확인 화면을 바로 띄운다 - 지역을 바꾸는
     로직은 이미 거기 다 있어서, 상단 지역 배지도 새로 만들지 않고
     그 화면으로 그대로 연결한다. */
  const regionBadge = region
    ? `<a class="site-header__region" href="region-select.html">📍 ${region.sido} ${region.sigungu}</a>`
    : "";

  mount.innerHTML = `
    <header class="site-header">
      <div class="site-header__bar">
        <a class="site-header__brand" href="index.html">
          <span class="site-header__brand-mark" aria-hidden="true"></span>
          <span>지역 이슈 균형정보</span>
        </a>
        <nav class="site-nav" aria-label="주요 메뉴">${buildLinks()}</nav>
        ${regionBadge}
      </div>
    </header>
  `;

  getIdentity().then((identity) => {
    let label = "로그인";
    if (identity.kind === "admin") label = `🛠 ${identity.email}`;
    else if (identity.kind === "member") label = `👤 ${identity.email}`;
    else if (identity.kind === "guest") label = `🔢 게스트 ${identity.code}`;

    const nav = mount.querySelector(".site-nav");
    if (nav) nav.innerHTML = buildLinks(label, identity.kind === "admin");
  });
}

function renderFooter() {
  const mount = document.getElementById("app-footer");
  if (!mount) return;

  mount.innerHTML = `
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__notice">
          <strong>이 웹페이지는 사용자의 정치 성향을 분석하거나 저장하지 않습니다.</strong>
          기사는 인기순이나 추천순이 아니라 작성 시간순으로 제공합니다. GPS 정보는
          시군구 확인에만 사용하며 정확한 위치는 저장하지 않습니다.
        </div>
        <span>청소년 지역 이슈 균형정보 플랫폼 · 연구용 프로토타입 (1단계)</span>
      </div>
    </footer>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});

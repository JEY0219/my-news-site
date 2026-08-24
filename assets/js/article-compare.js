(async function () {
  const params = new URLSearchParams(window.location.search);
  const issueId = params.get("issue");

  if (!issueId) {
    window.location.href = "issues.html";
    return;
  }

  let meta = null;
  try {
    meta = await fetchIssueById(issueId);
  } catch (err) {
    console.error("이슈 정보를 불러오지 못했습니다:", err);
  }
  if (!meta) {
    window.location.href = "issues.html";
    return;
  }

  document.getElementById("issue-title").textContent = meta.title;
  document.getElementById("issue-question").textContent = meta.question;
  document.getElementById("btn-to-region-compare").href =
    `region-compare.html?issue=${encodeURIComponent(issueId)}`;

  /* ---------------- 코너 탭 전환 (서사분석 카드 / 보수·진보 비교) ---------------- */

  const tabButtons = document.querySelectorAll(".issue-tab");
  const tabPanels = {
    npf: document.getElementById("panel-npf"),
    orientation: document.getElementById("panel-orientation"),
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
      Object.entries(tabPanels).forEach(([key, panel]) => {
        panel.classList.toggle("is-active", key === target);
      });
    });
  });

  /* ---------------- 코너 A: 서사분석 카드 ---------------- */

  let articles = [];

  const listEl = document.getElementById("article-list");
  const sortButtons = document.querySelectorAll(".sort-btn");
  const selectionCountEl = document.getElementById("selection-count");
  const compareBtn = document.getElementById("btn-compare");
  const resetBtn = document.getElementById("btn-reset");
  const compareSection = document.getElementById("compare-section");
  const compareGrid = document.getElementById("compare-grid");

  let sortOrder = "asc"; // "asc" = 오래된 기사부터, "desc" = 최신 기사부터
  const selectedIds = [];

  function formatDate(dateStr) {
    return dateStr.replaceAll("-", ".");
  }

  function formatDateWithBadge(a) {
    const badge = a.dateEstimated ? ' <span class="estimated-badge">추정</span>' : "";
    return formatDate(a.date) + badge;
  }

  function getSortedArticles() {
    const sorted = [...articles].sort((a, b) => a.date.localeCompare(b.date));
    return sortOrder === "asc" ? sorted : sorted.reverse();
  }

  function updateSelectionUI() {
    selectionCountEl.textContent = String(selectedIds.length);
    compareBtn.disabled = selectedIds.length !== 2;

    listEl.querySelectorAll(".article-card").forEach((card) => {
      const no = card.dataset.no;
      const checkbox = card.querySelector("input[type=checkbox]");
      const isSelected = selectedIds.includes(no);
      checkbox.checked = isSelected;
      card.classList.toggle("is-selected", isSelected);
      checkbox.disabled = !isSelected && selectedIds.length >= 2;
    });
  }

  function handleCheckboxChange(no, checked) {
    if (checked) {
      if (selectedIds.length >= 2) return;
      selectedIds.push(no);
    } else {
      const idx = selectedIds.indexOf(no);
      if (idx !== -1) selectedIds.splice(idx, 1);
    }
    updateSelectionUI();
  }

  /* NPF(피해자/책임주체/해결자/감정/정책대안) 칩 - 값이 비어 있으면
     그 칩은 아예 표시하지 않는다(자동분류가 못 찾은 항목이라는 뜻). */
  function npfTag(label, className, value) {
    if (!value) return "";
    return `<span class="npf-tag npf-tag--${className}"><span class="npf-tag__label">${label}</span>${value}</span>`;
  }

  function buildNpfTags(a) {
    const tags = [
      npfTag("피해자", "victim", a.victim),
      npfTag("책임주체", "responsible", a.responsible),
      npfTag("해결자", "solver", a.solver),
      npfTag("감정", "emotion", a.emotion),
      npfTag("해결책", "policy", a.policy),
    ].join("");
    return tags || '<span class="npf-tag npf-tag--empty">분류된 태그 없음</span>';
  }

  function renderList() {
    listEl.innerHTML = "";
    getSortedArticles().forEach((a) => {
      const card = document.createElement("div");
      card.className = "card article-card";
      card.dataset.no = a.no;
      card.innerHTML = `
        <span class="article-card__check">
          <input type="checkbox" id="check-${a.no}" aria-label='${a.title} 비교 대상으로 선택' />
        </span>
        <div class="article-card__body">
          <h3 class="article-card__title">${a.title}</h3>
          <div class="article-card__meta">
            <span>${a.outlet}</span><span>${a.region}</span><span>${formatDateWithBadge(a)}</span>
          </div>
          <p class="article-card__summary">${a.summary}</p>
          <div class="npf-tags">${buildNpfTags(a)}</div>
          <a class="article-card__source" href='${a.url}' target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>
        </div>
      `;
      const checkbox = card.querySelector("input[type=checkbox]");
      checkbox.addEventListener("change", (e) => handleCheckboxChange(a.no, e.target.checked));
      listEl.appendChild(card);
    });
    updateSelectionUI();
  }

  function renderSortButtons() {
    sortButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.sort === sortOrder);
    });
  }

  sortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sortOrder = btn.dataset.sort;
      renderSortButtons();
      renderList();
    });
  });

  function buildCompareCol(a) {
    const keyExpression = `${a.emotion} 등의 감정이 반복적으로 강조되었습니다.`;
    const cause = `기사는 문제의 원인으로 '${a.responsible}'을(를) 지목합니다.`;

    return `
      <div class="card compare-col">
        <span class="compare-col__outlet">${a.outlet}</span>
        <h3 class="compare-col__title">${a.title}</h3>
        <div class="compare-row">
          <span class="compare-row__label">언론사</span>
          <span class="compare-row__value">${a.outlet}</span>
        </div>
        <div class="compare-row">
          <span class="compare-row__label">작성 시점</span>
          <span class="compare-row__value">${formatDateWithBadge(a)}</span>
        </div>
        <div class="compare-row">
          <span class="compare-row__label">기사 요약</span>
          <span class="compare-row__value">${a.summary}</span>
        </div>
        <div class="compare-row">
          <span class="compare-row__label">주요 표현</span>
          <span class="compare-row__value">${keyExpression}</span>
        </div>
        <div class="compare-row">
          <span class="compare-row__label">제시된 원인</span>
          <span class="compare-row__value">${cause}</span>
        </div>
        <div class="compare-row">
          <span class="compare-row__label">제시된 해결책</span>
          <span class="compare-row__value">${a.policy}</span>
        </div>
        <div class="compare-row">
          <span class="compare-row__label">원문</span>
          <span class="compare-row__value"><a href='${a.url}' target="_blank" rel="noopener noreferrer">원문 보기 ↗</a></span>
        </div>
      </div>
    `;
  }

  compareBtn.addEventListener("click", () => {
    if (selectedIds.length !== 2) return;
    const sorted = getSortedArticles();
    const selected = sorted.filter((a) => selectedIds.includes(a.no));

    compareGrid.innerHTML = selected.map(buildCompareCol).join("");
    compareSection.classList.add("is-visible");
    compareSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  resetBtn.addEventListener("click", () => {
    selectedIds.length = 0;
    updateSelectionUI();
    compareSection.classList.remove("is-visible");
    listEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------------- 코너 B: 보수/진보 비교 ---------------- */

  function buildOrientationItem(a) {
    return `
      <div class="card orientation-item">
        <div class="orientation-item__outlet">${a.outlet} · ${formatDateWithBadge(a)}</div>
        <h3 class="orientation-item__title">${a.title}</h3>
        <p class="orientation-item__summary">${a.summary}</p>
        <a class="article-card__source" href='${a.url}' target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>
      </div>
    `;
  }

  function renderOrientationTab() {
    const conservativeEl = document.getElementById("orientation-conservative");
    const progressiveEl = document.getElementById("orientation-progressive");

    const conservative = [];
    const progressive = [];
    articles.forEach((a) => {
      const orientation = classifyOutletOrientation(a.outlet);
      if (orientation === "conservative") conservative.push(a);
      else if (orientation === "progressive") progressive.push(a);
    });

    conservativeEl.innerHTML = conservative.length
      ? conservative.map(buildOrientationItem).join("")
      : '<p class="orientation-empty">이 이슈를 다룬 보수 성향 언론사(조선일보·동아일보·중앙일보) 기사가 아직 없습니다.</p>';

    progressiveEl.innerHTML = progressive.length
      ? progressive.map(buildOrientationItem).join("")
      : '<p class="orientation-empty">이 이슈를 다룬 진보 성향 언론사(한겨레·경향신문·오마이뉴스) 기사가 아직 없습니다.</p>';
  }

  /* ---------------- 초기 로드 ---------------- */

  renderSortButtons();
  listEl.innerHTML = '<p class="muted" style="padding:12px 2px;">기사를 불러오는 중입니다...</p>';

  fetchArticlesByIssue(issueId)
    .then((data) => {
      articles = data;
      renderList();
      renderOrientationTab();
    })
    .catch((err) => {
      listEl.innerHTML = `<p class="muted" style="padding:12px 2px;">기사를 불러오지 못했습니다: ${err.message}</p>`;
    });
})();

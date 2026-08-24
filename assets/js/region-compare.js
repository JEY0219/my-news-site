(function () {
  const ISSUE_TITLES = {
    "gwangju-518": "광주 5·18과 역사 기억",
    "daegu-gyeongbuk": "대구·경북 정치 정체성",
    "capital-imbalance": "수도권·비수도권 불균형",
  };

  const params = new URLSearchParams(window.location.search);
  const issueId = params.get("issue");

  if (!issueId || !ISSUE_TITLES[issueId] || !REGION_COMPARE_DATA[issueId]) {
    window.location.href = "issues.html";
    return;
  }

  document.getElementById("issue-title").textContent =
    `${ISSUE_TITLES[issueId]} — 다른 지역 관점 비교`;

  const data = REGION_COMPARE_DATA[issueId];
  const TAB_KEYS = ["myRegion", "otherRegion", "national"];

  const tabsEl = document.getElementById("region-tabs");
  const captionEl = document.getElementById("table-caption");
  const cellVictim = document.getElementById("cell-victim");
  const cellResponsible = document.getElementById("cell-responsible");
  const cellEmotion = document.getElementById("cell-emotion");
  const cellSolution = document.getElementById("cell-solution");

  let activeKey = "myRegion";

  function renderTable() {
    const d = data[activeKey];
    captionEl.textContent = d.caption;
    cellVictim.textContent = d.victim;
    cellResponsible.textContent = d.responsible;
    cellEmotion.textContent = d.emotion;
    cellSolution.textContent = d.solution;
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    TAB_KEYS.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "region-tab" + (key === activeKey ? " is-active" : "");
      btn.textContent = data[key].tabLabel;
      btn.addEventListener("click", () => {
        activeKey = key;
        renderTabs();
        renderTable();
      });
      tabsEl.appendChild(btn);
    });
  }

  renderTabs();
  renderTable();

  /* ---------------- 성찰 질문 응답 게이트 ---------------- */

  const textareas = Array.from(document.querySelectorAll("#qa-list textarea"));
  const qaCountEl = document.getElementById("qa-count");
  const nextBtn = document.getElementById("btn-next");
  const MIN_ANSWERS = 2;

  function updateProgress() {
    const answered = textareas.filter((t) => t.value.trim().length > 0).length;
    qaCountEl.textContent = String(answered);
    nextBtn.disabled = answered < MIN_ANSWERS;
  }

  textareas.forEach((t) => t.addEventListener("input", updateProgress));
  updateProgress();

  nextBtn.addEventListener("click", () => {
    if (nextBtn.disabled) return;
    window.location.href = `emotion-check.html?issue=${encodeURIComponent(issueId)}`;
  });
})();

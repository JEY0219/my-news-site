(function () {
  const region = getSelectedRegion();
  if (!region) {
    window.location.href = "region-select.html";
    return;
  }

  document.getElementById("region-title").textContent = `${region.sido} ${region.sigungu}`;

  /* ---------------- 공공정보 접근성 등급 (서버 계산값) ---------------- */

  const DEFAULT_THRESHOLDS = [
    { grade: "A", min: 3.0, label: "매우 높음", desc: "인구 1만 명당 시설이 3개 이상으로 접근성이 우수합니다." },
    { grade: "B", min: 2.0, label: "높음", desc: "인구 1만 명당 시설이 2개 이상 3개 미만으로 접근성이 양호합니다." },
    { grade: "C", min: 1.0, label: "보통", desc: "인구 1만 명당 시설이 1개 이상 2개 미만으로 접근성이 보통 수준입니다." },
    { grade: "D", min: 0.5, label: "낮음", desc: "인구 1만 명당 시설이 0.5개 이상 1개 미만으로 접근성이 낮은 편입니다." },
    { grade: "E", min: 0, label: "매우 낮음", desc: "인구 1만 명당 시설이 0.5개 미만으로 접근성이 매우 낮습니다." },
  ];

  const gradeBadgeEl = document.getElementById("grade-badge");
  const gradeTitleEl = document.getElementById("grade-title");
  const gradeDescEl = document.getElementById("grade-desc");
  const accessibilityValueEl = document.getElementById("accessibility-value");
  const accessibilityNoteEl = document.getElementById("accessibility-note");
  const criteriaEl = document.getElementById("grade-criteria");

  function renderCriteria(stats) {
    criteriaEl.innerHTML = "";
    const thresholds = (stats && stats.thresholds) || DEFAULT_THRESHOLDS;
    thresholds.forEach((t) => {
      const row = document.createElement("div");
      row.className = "grade-criteria__row" + (stats && stats.grade === t.grade ? " is-current" : "");
      row.innerHTML = `
        <span class="grade-criteria__badge">${t.grade}</span>
        <span class="grade-criteria__text"><strong>${t.label}</strong> · 인구 1만 명당 시설 ${t.min}개 이상 — ${t.desc}</span>
      `;
      criteriaEl.appendChild(row);
    });
  }

  function renderGrade(stats) {
    if (!stats) {
      gradeBadgeEl.textContent = "-";
      gradeTitleEl.textContent = "등급을 계산할 수 없습니다";
      gradeDescEl.textContent = "공공데이터 서버에 연결하지 못했습니다.";
      accessibilityValueEl.textContent = "확인 불가";
      accessibilityNoteEl.textContent = "서버 연결 실패";
      renderCriteria(null);
      return;
    }

    if (stats.populationStatus !== "ok") {
      gradeBadgeEl.textContent = "-";
      gradeTitleEl.textContent = "인구 데이터가 아직 연결되지 않았습니다";
      gradeDescEl.textContent =
        stats.populationStatus === "not_configured"
          ? "서버 .env에 POPULATION_API_URL / POPULATION_API_KEY를 설정하면 등급이 자동으로 계산됩니다."
          : `인구 데이터를 불러오지 못했습니다: ${stats.populationError || "알 수 없는 오류"}`;
      accessibilityValueEl.textContent = "설정 필요";
      accessibilityNoteEl.textContent = "인구 데이터 연동 필요";
      renderCriteria(stats);
      return;
    }

    gradeBadgeEl.textContent = stats.grade;
    gradeTitleEl.textContent = `청소년 공공정보 접근성 ${stats.grade}등급`;
    gradeDescEl.textContent = stats.completeFacilityData
      ? stats.gradeDesc
      : `${stats.gradeDesc} (일부 시설 데이터를 불러오지 못해 실제보다 낮게 계산됐을 수 있습니다.)`;

    accessibilityValueEl.textContent = stats.gradeLabel;
    accessibilityNoteEl.textContent = `${stats.grade}등급 · 인구 1만 명당 시설 ${stats.ratePer10k}개 (인구 ${stats.population.toLocaleString()}명 · 시설 ${stats.facilityCount}곳)`;

    renderCriteria(stats);
  }

  /* ---------------- 공공정보 접근성 세부 항목 (예시 데이터) ---------------- */

  const LEVEL_LABEL = { 1: "낮음", 2: "보통", 3: "높음" };

  const detailItems = [
    { label: "청소년 인구 대비 도서관 수", level: 1 },
    { label: "청소년 인구 대비 청소년센터 수", level: 1 },
    { label: "상담복지센터 접근성", level: 2 },
    { label: "대중교통을 이용한 시설 접근성", level: 2 },
    { label: "온라인 공공정보 제공 수준", level: 1 },
  ];

  const detailListEl = document.getElementById("detail-list");
  detailItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "detail-row";

    const segs = [1, 2, 3]
      .map((n) => `<span class="level-meter__seg${n <= item.level ? " is-filled" : ""}"></span>`)
      .join("");

    row.innerHTML = `
      <span class="detail-row__label">${item.label}</span>
      <span class="level-meter__wrap">
        <span class="level-meter">${segs}</span>
        <span class="level-meter__text">${LEVEL_LABEL[item.level]}</span>
      </span>
    `;
    detailListEl.appendChild(row);
  });

  /* ---------------- 주변 시설: 공공데이터 API + 예시(평생학습관/주민센터) ---------------- */

  const sigungu = region.sigungu;

  const STATIC_FACILITIES = [
    { type: "평생학습관", name: `${sigungu} 평생학습관`, address: `${region.sido} ${sigungu} (예시 주소)`, example: true },
    { type: "주민센터", name: "행정동 주민센터", address: `${region.sido} ${sigungu} (예시 주소)`, example: true },
  ];

  const FACILITY_TYPES = ["전체", "도서관", "청소년수련시설", "청소년상담복지센터", "평생학습관", "주민센터"];

  const STATUS_LABEL = {
    not_configured: "API 키가 설정되지 않았습니다 (.env 확인).",
    error: "데이터를 불러오지 못했습니다.",
  };

  const tabsEl = document.getElementById("facility-tabs");
  const listEl = document.getElementById("facility-list");
  const countValueEl = document.getElementById("facility-count-value");
  const countNoteEl = document.getElementById("facility-count-note");

  let activeType = "전체";
  let liveFacilities = [];
  let statusNotes = [];

  function renderFacilityList() {
    listEl.innerHTML = "";

    if (statusNotes.length > 0) {
      const note = document.createElement("div");
      note.className = "facility-status-note";
      note.innerHTML = statusNotes.join("<br />");
      listEl.appendChild(note);
    }

    const all = [...liveFacilities, ...STATIC_FACILITIES];
    const filtered = all.filter((f) => activeType === "전체" || f.type === activeType);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.style.padding = "4px 2px";
      empty.textContent = "표시할 시설이 없습니다.";
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach((f) => {
      const item = document.createElement("div");
      item.className = "card facility-item";
      item.innerHTML = `
        <div class="facility-item__top">
          <span class="facility-item__name">${f.name}${f.example ? '<span class="example-badge">예시</span>' : ""}</span>
          <span class="facility-item__type">${f.type}</span>
        </div>
        <div class="facility-item__detail">
          주소: ${f.address || "정보 없음"}<br />
          ${f.tel ? `전화: ${f.tel}<br />` : ""}
          시설 유형: ${f.type}
        </div>
      `;
      item.addEventListener("click", () => item.classList.toggle("is-open"));
      listEl.appendChild(item);
    });
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    FACILITY_TYPES.forEach((type) => {
      const btn = document.createElement("button");
      btn.className = "facility-tab" + (type === activeType ? " is-active" : "");
      btn.textContent = type;
      btn.addEventListener("click", () => {
        activeType = type;
        renderTabs();
        renderFacilityList();
      });
      tabsEl.appendChild(btn);
    });
  }

  function updateSummaryCard() {
    const all = [...liveFacilities, ...STATIC_FACILITIES];
    countValueEl.textContent = `${all.length}곳`;

    const byType = {};
    all.forEach((f) => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });
    countNoteEl.textContent = Object.entries(byType)
      .map(([type, n]) => `${type} ${n}`)
      .join(" · ") || "확인된 시설 없음";
  }

  renderTabs();
  renderFacilityList();
  renderCriteria(null);

  fetch(`/api/facilities?sido=${encodeURIComponent(region.sido)}&sigungu=${encodeURIComponent(region.sigungu)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const categories = [
        { key: "libraries", label: "도서관" },
        { key: "youthFacilities", label: "청소년수련시설" },
        { key: "counselingCenters", label: "청소년상담복지센터" },
      ];
      const nextLive = [];
      const nextNotes = [];
      categories.forEach(({ key, label }) => {
        const result = data[key];
        if (!result) return;
        if (result.status === "ok") {
          nextLive.push(...result.items);
        } else {
          nextNotes.push(`${label}: ${STATUS_LABEL[result.status] || result.error || "알 수 없는 오류"}`);
        }
      });
      liveFacilities = nextLive;
      statusNotes = nextNotes;
      renderGrade(data.stats);
    })
    .catch((err) => {
      liveFacilities = [];
      statusNotes = [
        `공공데이터 서버에 연결하지 못했습니다 (${err.message}). "npm start"로 서버를 실행 중인지 확인해 주세요.`,
      ];
      renderGrade(null);
    })
    .finally(() => {
      renderFacilityList();
      updateSummaryCard();
    });

  /* ---------------- "주요 지역 이슈" 요약 카드 ----------------
     예전에는 "주거 · 교통 · 환경"으로 고정돼 있던 자리다. 지금은 지역신문
     코너와 완전히 같은 API(/api/local-news)가 함께 내려주는 topKeywords
     (지역신문 제목에서 자주 나오는 단어 상위 2~3개, 지역 이슈 자동 발견에
     쓰는 것과 같은 빈도 기반 로직)를 그대로 가져와 보여준다. */

  const localIssueValueEl = document.getElementById("local-issue-value");
  const localIssueNoteEl = document.getElementById("local-issue-note");

  function renderLocalIssueSummary(result) {
    if (!result || result.status === "error") {
      localIssueValueEl.textContent = "확인 불가";
      localIssueNoteEl.textContent = "지역신문 서버 연결 실패";
      return;
    }

    const keywords = result.topKeywords || [];
    if (keywords.length === 0) {
      localIssueValueEl.textContent = "확인 가능한 지역 이슈가 부족합니다";
      localIssueNoteEl.textContent =
        result.status === "not_configured"
          ? "이 지역의 지역신문 기사를 아직 확인할 수 없습니다"
          : "최근 지역신문 기사가 3건 미만이라 대표 키워드를 뽑지 못했습니다";
      return;
    }

    localIssueValueEl.textContent = keywords.join(" · ");
    localIssueNoteEl.textContent = "지역신문 기사 제목 빈도 기준";
  }

  fetch(`/api/local-news?sido=${encodeURIComponent(region.sido)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(renderLocalIssueSummary)
    .catch((err) => renderLocalIssueSummary({ status: "error", error: err.message }));
})();

(function () {
  const region = getSelectedRegion();
  if (!region) {
    window.location.href = "region-select.html";
    return;
  }

  const regionLineEl = document.getElementById("region-line");
  regionLineEl.innerHTML =
    `현재 지역: <a href="region-status.html">${region.sido} ${region.sigungu}</a> · ` +
    `지역 현황을 이미 확인했다면 아래에서 이슈를 선택하세요.`;

  const gridEl = document.getElementById("issue-grid");

  function renderIssueCard(issue, index) {
    const article = document.createElement("article");
    article.className = "card issue-card";
    article.innerHTML = `
      <span class="issue-card__index">${index + 1}</span>
      <h2 class="issue-card__title">${issue.title}</h2>
      <p class="issue-card__desc">${issue.description || ""}</p>
      <div class="issue-card__question">
        <span class="issue-card__question-label">핵심 질문</span>
        <span class="issue-card__question-text">${issue.question}</span>
      </div>
      <div class="issue-card__meta">
        <div class="issue-card__meta-row">
          <span class="issue-card__meta-label">관련 기사 수</span>
          <span class="issue-card__meta-value" id="count-${issue.id}">기사 수 확인 중</span>
        </div>
        <div class="issue-card__meta-row">
          <span class="issue-card__meta-label">분석 대상 지역</span>
          <span class="issue-card__meta-value">${issue.region || "전국"}</span>
        </div>
      </div>
      <a class="btn btn-primary btn-block" href="article-compare.html?issue=${encodeURIComponent(issue.id)}">
        기사 비교 시작하기
      </a>
    `;
    return article;
  }

  fetchIssues(region)
    .then((issues) => {
      if (issues.length === 0) {
        gridEl.innerHTML = '<p class="muted" style="padding:12px 2px;">아직 등록된 이슈가 없습니다.</p>';
        return;
      }
      gridEl.innerHTML = "";
      issues.forEach((issue, index) => gridEl.appendChild(renderIssueCard(issue, index)));

      if (typeof supabaseClient !== "undefined" && supabaseClient) {
        fetchArticleCounts()
          .then((counts) => {
            issues.forEach((issue) => {
              const el = document.getElementById(`count-${issue.id}`);
              if (el) el.textContent = `비교 가능한 기사 ${counts[issue.id] || 0}건`;
            });
          })
          .catch((err) => console.error("기사 수 조회 실패:", err));
      }
    })
    .catch((err) => {
      gridEl.innerHTML = `<p class="muted" style="padding:12px 2px;">이슈를 불러오지 못했습니다: ${err.message}</p>`;
    });
})();

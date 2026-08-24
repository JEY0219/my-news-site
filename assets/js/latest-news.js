(function () {
  const groupsEl = document.getElementById("news-groups");
  const fetchedAtEl = document.getElementById("fetched-at");
  const totalCountEl = document.getElementById("total-count");
  const loadMoreBtn = document.getElementById("btn-load-more");

  const PAGE_SIZE = 20;
  let offset = 0;
  let loading = false;

  function formatDate(dateStr) {
    return (dateStr || "").replaceAll("-", ".");
  }

  const ORIENTATION_LABEL = { conservative: "보수", progressive: "진보" };

  /* article-compare.js의 npfTag()/buildNpfTags()와 동일한 로직 - 값이
     비어 있는 항목은 칩 자체를 만들지 않는다(자동분류가 못 찾았다는 뜻). */
  function npfTag(label, className, value) {
    if (!value) return "";
    return `<span class="npf-tag npf-tag--${className}"><span class="npf-tag__label">${label}</span>${value}</span>`;
  }

  function buildNpfTags(npf) {
    if (!npf) return '<span class="npf-tag npf-tag--empty">분류된 태그 없음</span>';
    const tags = [
      npfTag("피해자", "victim", npf.victim),
      npfTag("책임주체", "responsible", npf.responsible),
      npfTag("해결자", "solver", npf.solver),
      npfTag("감정", "emotion", npf.emotion),
      npfTag("해결책", "policy", npf.policy),
    ].join("");
    return tags || '<span class="npf-tag npf-tag--empty">분류된 태그 없음</span>';
  }

  let npfSeq = 0;

  function renderPairCol(article) {
    const label = ORIENTATION_LABEL[article.orientation] || "";
    const orientationBadge = label
      ? `<span class="pair-col__orientation pair-col__orientation--${article.orientation}">${label}</span>`
      : "";
    const npfId = `npf-panel-${npfSeq++}`;
    return `
      <div class="pair-col">
        <span class="pair-col__outlet">${article.outlet}</span>${orientationBadge}
        <p class="pair-col__title">${article.title}</p>
        <div class="pair-col__date">${formatDate(article.date)}</div>
        <p class="pair-col__summary">${article.summary}</p>
        <a class="pair-col__link" href="${article.url}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>
        <button type="button" class="npf-toggle" data-npf-target="${npfId}" aria-expanded="false">
          서사분석 보기
        </button>
        <div class="npf-panel" id="${npfId}">
          <p class="npf-panel__disclaimer">이 분석은 실시간 자동 분류로, 정확하지 않을 수 있습니다.</p>
          <div class="npf-tags">${buildNpfTags(article.npf)}</div>
        </div>
      </div>
    `;
  }

  function renderPair(group) {
    const block = document.createElement("div");
    block.className = "card pair-block";
    block.innerHTML = `
      <span class="pair-block__label">🔍 같은 사건, 보수·진보 관점 비교</span>
      <div class="pair-grid">
        ${group.articles.map(renderPairCol).join("")}
      </div>
    `;
    block.querySelectorAll(".npf-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = block.querySelector(`#${btn.dataset.npfTarget}`);
        const isOpen = panel.classList.toggle("is-open");
        btn.classList.toggle("is-open", isOpen);
        btn.setAttribute("aria-expanded", String(isOpen));
        btn.textContent = isOpen ? "서사분석 접기" : "서사분석 보기";
      });
    });
    return block;
  }

  function appendGroups(groups) {
    groups.forEach((group) => groupsEl.appendChild(renderPair(group)));
  }

  function renderStatusNote(message) {
    groupsEl.innerHTML = `<div class="news-status-note">${message}</div>`;
    loadMoreBtn.style.display = "none";
  }

  function loadPage() {
    if (loading) return;
    loading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "불러오는 중...";

    fetch(`/api/latest-news?offset=${offset}&limit=${PAGE_SIZE}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.status === "not_configured") {
          renderStatusNote(
            "네이버 뉴스 검색 API 키가 아직 설정되지 않았습니다. 서버 .env의 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET을 확인해 주세요."
          );
          return;
        }
        if (data.status === "error" && (!data.groups || data.groups.length === 0)) {
          renderStatusNote(`기사를 불러오지 못했습니다: ${data.error || "알 수 없는 오류"}`);
          return;
        }

        if (offset === 0 && (data.groups || []).length === 0) {
          renderStatusNote("아직 쌓인 기사가 없습니다. 잠시 후 다시 확인해 주세요.");
          return;
        }

        appendGroups(data.groups || []);
        offset += (data.groups || []).length;

        totalCountEl.textContent = `전체 ${data.total}건 중 ${Math.min(offset, data.total)}건 표시`;
        if (data.lastFetchedAt) {
          const dt = new Date(data.lastFetchedAt);
          fetchedAtEl.textContent = `마지막 업데이트: ${dt.toLocaleString("ko-KR")}`;
        }

        loadMoreBtn.style.display = data.hasMore ? "inline-flex" : "none";
      })
      .catch((err) => {
        renderStatusNote(
          `공공데이터 서버에 연결하지 못했습니다 (${err.message}). "npm start"로 서버를 실행 중인지 확인해 주세요.`
        );
      })
      .finally(() => {
        loading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = "더보기";
      });
  }

  loadMoreBtn.addEventListener("click", loadPage);

  loadPage();
})();

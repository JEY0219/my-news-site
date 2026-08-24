(function () {
  /* ---------------------------------------------------------
     지역신문 코너 (5·18/대구경북/수도권비수도권 전국 이슈 3개와는
     완전히 별개). 방금 만든 지역신문 코너 API(/api/local-news)와 도메인
     매핑을 그대로 재사용한다 - region-status.html의 "이 지역의 이슈
     확인하기" 버튼이 예전에는 전국 이슈 목록(issues.html)으로 갔는데,
     지역 맥락과 맞지 않아 이 페이지로 대상을 바꿨다. 예전에
     region-status.html에 있던 지역신문 목록 렌더링 코드를 그대로
     옮겨와서, 같은 데이터를 두 화면에서 각각 다시 그리지 않고 이
     페이지 하나로 모았다.
  --------------------------------------------------------- */

  const region = getSelectedRegion();
  if (!region) {
    window.location.href = "region-select.html";
    return;
  }

  document.getElementById("page-title").textContent = `${region.sido} ${region.sigungu} 지역신문`;

  const noteEl = document.getElementById("local-news-note");
  const listEl = document.getElementById("local-news-list");

  function formatLocalDate(dateStr) {
    return String(dateStr || "").replaceAll("-", ".");
  }

  function renderItem(item) {
    const el = document.createElement("div");
    el.className = "card local-news-item";
    el.innerHTML = `
      <div class="local-news-item__meta"><span>${item.outlet}</span><span>${formatLocalDate(item.date)}</span></div>
      <h3 class="local-news-item__title">${item.title}</h3>
      <p class="local-news-item__summary">${item.summary || ""}</p>
      <a class="local-news-item__link" href="${item.url}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>
    `;
    return el;
  }

  function renderResult(result) {
    noteEl.innerHTML = "";
    listEl.innerHTML = "";

    if (!result || result.status === "error") {
      noteEl.innerHTML =
        '<div class="card local-news-note">지역신문 기사를 불러오지 못했습니다. "npm start"로 서버를 실행 중인지 확인해 주세요.</div>';
      return;
    }

    /* 서울처럼 자체 지역신문이 없는 지역은 서버가 수도권(경기·인천)
       기사로 대신 채워주면서 fallbackOf를 함께 내려준다 - 왜 다른
       지역 기사가 나오는지 알 수 있게 안내 문구를 붙인다. */
    if (result.fallbackOf) {
      noteEl.innerHTML += `<div class="card local-news-note local-news-note--fallback">${result.fallbackOf} 지역신문이 준비 중이라 수도권(경기·인천) 뉴스를 보여드립니다.</div>`;
    }

    if (result.status === "not_configured") {
      const msg =
        (result.outlets || []).length === 0
          ? `${region.sido}은(는) 아직 등록된 지역신문이 없어 "지역신문 준비 중"입니다.`
          : "네이버 뉴스 API 키가 설정되지 않아 지역신문 기사를 불러올 수 없습니다 (.env 확인).";
      noteEl.innerHTML += `<div class="card local-news-note">${msg}</div>`;
      return;
    }

    if (result.outlets && result.outlets.length > 0) {
      noteEl.innerHTML += `<div class="card local-news-note">대상 지역신문: ${result.outlets.join(", ")}</div>`;
    }

    if (!result.items || result.items.length === 0) {
      listEl.innerHTML = '<p class="muted" style="padding:12px 2px;">최근 이 지역신문에서 확인된 기사가 없습니다.</p>';
      return;
    }

    result.items.forEach((item) => listEl.appendChild(renderItem(item)));
  }

  listEl.innerHTML = '<p class="muted" style="padding:12px 2px;">지역신문 기사를 불러오는 중입니다...</p>';

  fetch(`/api/local-news?sido=${encodeURIComponent(region.sido)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(renderResult)
    .catch((err) => renderResult({ status: "error", error: err.message }));
})();

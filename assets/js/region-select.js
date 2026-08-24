(function () {
  const panels = {
    gps: document.getElementById("panel-gps"),
    manual: document.getElementById("panel-manual"),
    confirm: document.getElementById("panel-confirm"),
  };

  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle("is-active", key === name);
    });
  }

  function initialPanel() {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "manual" ? "manual" : "gps";
  }

  /* ---------------- 직접 선택 패널 ---------------- */

  const sidoSelect = document.getElementById("select-sido");
  const sigunguSelect = document.getElementById("select-sigungu");
  const manualConfirmBtn = document.getElementById("btn-manual-confirm");

  getSidoList().forEach((sido) => {
    const opt = document.createElement("option");
    opt.value = sido;
    opt.textContent = sido;
    sidoSelect.appendChild(opt);
  });

  sidoSelect.addEventListener("change", () => {
    const sido = sidoSelect.value;
    sigunguSelect.innerHTML = "";
    manualConfirmBtn.disabled = true;

    if (!sido) {
      sigunguSelect.disabled = true;
      const opt = document.createElement("option");
      opt.textContent = "시도를 먼저 선택하세요";
      sigunguSelect.appendChild(opt);
      return;
    }

    sigunguSelect.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "시군구를 선택하세요";
    sigunguSelect.appendChild(placeholder);

    getSigunguList(sido).forEach((sigungu) => {
      const opt = document.createElement("option");
      opt.value = sigungu;
      opt.textContent = sigungu;
      sigunguSelect.appendChild(opt);
    });
  });

  sigunguSelect.addEventListener("change", () => {
    manualConfirmBtn.disabled = !sigunguSelect.value;
  });

  manualConfirmBtn.addEventListener("click", () => {
    const sido = sidoSelect.value;
    const sigungu = sigunguSelect.value;
    if (!sido || !sigungu) return;
    setSelectedRegion(sido, sigungu, { viaGps: false });
    renderConfirm();
    showPanel("confirm");
  });

  document.getElementById("btn-go-gps").addEventListener("click", () => showPanel("gps"));
  document.getElementById("btn-go-manual").addEventListener("click", () => showPanel("manual"));
  document.getElementById("btn-reselect").addEventListener("click", () => showPanel("gps"));

  /* ---------------- GPS 동의 패널 ---------------- */

  const gpsStatus = document.getElementById("gps-status");
  const gpsAgreeBtn = document.getElementById("btn-gps-agree");
  const manualNoticeEl = document.getElementById("manual-notice");

  function setGpsStatus(html, showSpinner) {
    gpsStatus.innerHTML = (showSpinner ? '<span class="spinner"></span>' : "") + html;
  }

  const GEOLOCATION_FAILURE_MESSAGE = "위치 정보를 가져올 수 없습니다. 직접 선택해주세요.";

  /* 위치 권한 거부/실패든, 역지오코딩 실패든 실패 사유와 무관하게 같은
     안내 문구를 보여주고 직접 선택 화면으로 넘긴다 - 잘못된 시/군/구를
     추측해서 보여주는 것보다 사용자가 직접 고르게 하는 편이 안전하다. */
  function handleGpsFailure() {
    gpsAgreeBtn.disabled = false;
    setGpsStatus(GEOLOCATION_FAILURE_MESSAGE, false);
    if (manualNoticeEl) {
      manualNoticeEl.textContent = GEOLOCATION_FAILURE_MESSAGE;
      manualNoticeEl.style.display = "flex";
    }
    showPanel("manual");
  }

  gpsAgreeBtn.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      handleGpsFailure();
      return;
    }

    gpsAgreeBtn.disabled = true;
    setGpsStatus("현재 위치를 확인하는 중입니다...", true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setGpsStatus("행정구역으로 변환하는 중입니다...", true);

        // 좌표는 이 함수 안에서만 잠깐 쓰이고 버려진다 - 우리 서버로
        // 보내거나 저장하지 않는다(assets/js/geocode.js 참고).
        const region = await reverseGeocodeToRegion(latitude, longitude);

        if (!region) {
          handleGpsFailure();
          return;
        }

        gpsAgreeBtn.disabled = false;
        setGpsStatus("위치 확인이 완료되어 정확한 좌표는 저장하지 않고 삭제했습니다.", false);
        setSelectedRegion(region.sido, region.sigungu, { viaGps: true });
        renderConfirm();
        showPanel("confirm");
      },
      () => {
        handleGpsFailure();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );
  });

  /* ---------------- 확인 패널 ---------------- */

  function renderConfirm() {
    const region = getSelectedRegion();
    if (!region) return;
    document.getElementById("confirm-region").textContent = `${region.sido} ${region.sigungu}`;
    document.getElementById("confirm-tag").textContent = region.viaGps
      ? "GPS 기반 자동 추정 · 정확한 시군구 자동 변환은 추후 지도 API 연동 예정"
      : "직접 선택한 지역";
  }

  /* ---------------- 초기 진입 ---------------- */

  const params = new URLSearchParams(window.location.search);
  const existing = getSelectedRegion();

  if (!params.has("mode") && existing) {
    // 메뉴의 '내 지역'처럼 mode 지정 없이 들어온 경우, 기존 선택 지역을 바로 보여준다.
    renderConfirm();
    showPanel("confirm");
  } else {
    showPanel(initialPanel());
  }
})();

(function () {
  const tabs = document.querySelectorAll(".mode-tab");
  const panels = {
    pre: document.getElementById("panel-pre"),
    post: document.getElementById("panel-post"),
  };

  const formEls = {
    pre: document.getElementById("pre-form"),
    post: document.getElementById("post-form"),
  };

  const errorEls = {
    pre: document.getElementById("pre-error"),
    post: document.getElementById("post-error"),
  };

  const successEls = {
    pre: document.getElementById("pre-success"),
    post: document.getElementById("post-success"),
  };

  const submitBtns = {
    pre: document.getElementById("btn-submit-pre"),
    post: document.getElementById("btn-submit-post"),
  };

  renderSchema(SURVEY_SCHEMAS.pre, formEls.pre);
  renderSchema(SURVEY_SCHEMAS.post, formEls.post);

  function setMode(mode) {
    const target = mode === "post" ? "post" : "pre";
    tabs.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.mode === target));
    Object.keys(panels).forEach((key) => panels[key].classList.toggle("is-active", key === target));
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  const initialMode = new URLSearchParams(window.location.search).get("mode");
  setMode(initialMode);

  /* ---------------- 로그인/식별번호 확인 ---------------- */

  const loginRequiredEl = document.getElementById("login-required");
  const loginRequiredLink = document.getElementById("login-required-link");
  loginRequiredLink.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;

  let participant = null;

  function setSubmitEnabled(enabled) {
    submitBtns.pre.disabled = !enabled;
    submitBtns.post.disabled = !enabled;
  }

  setSubmitEnabled(false);

  function refreshParticipant() {
    return getParticipantDescriptor().then((p) => {
      participant = p;
      if (p) {
        loginRequiredEl.classList.remove("is-visible");
        setSubmitEnabled(true);
      } else {
        loginRequiredEl.classList.add("is-visible");
        setSubmitEnabled(false);
      }
      return p;
    });
  }

  /* ---------------- 제출 ---------------- */

  async function handleSubmit(type) {
    if (!supabaseClient) {
      errorEls[type].textContent = "Supabase 설정이 필요합니다 (assets/js/supabase-client.js).";
      errorEls[type].classList.add("is-visible");
      return;
    }
    if (!participant) {
      loginRequiredEl.classList.add("is-visible");
      return;
    }

    const schema = SURVEY_SCHEMAS[type];
    const containerEl = formEls[type];
    const answers = collectAnswers(containerEl, schema);

    errorEls[type].classList.remove("is-visible");
    submitBtns[type].disabled = true;

    const { error } = await supabaseClient.from("survey_responses").insert({
      survey_type: type,
      participant_kind: participant.participant_kind,
      anon_code: participant.anon_code,
      user_id: participant.user_id,
      answers,
    });

    submitBtns[type].disabled = false;

    if (error) {
      errorEls[type].textContent = `저장에 실패했습니다: ${error.message}`;
      errorEls[type].classList.add("is-visible");
      return;
    }

    successEls[type].textContent = `저장되었습니다. (${type === "pre" ? "사전" : "사후"} 설문)`;
    successEls[type].classList.add("is-visible");

    renderSchema(schema, containerEl);
    renderSummary();
  }

  submitBtns.pre.addEventListener("click", () => handleSubmit("pre"));
  submitBtns.post.addEventListener("click", () => handleSubmit("post"));

  /* ---------------- 내 응답 요약 / 다운로드 ---------------- */

  function scopedQuery(surveyType) {
    let q = supabaseClient.from("survey_responses").select("*").eq("survey_type", surveyType);
    if (participant.participant_kind === "member") {
      q = q.eq("user_id", participant.user_id);
    } else {
      q = q.eq("anon_code", participant.anon_code);
    }
    return q;
  }

  async function renderSummary() {
    if (!participant) {
      document.getElementById("count-pre").textContent = "-";
      document.getElementById("count-post").textContent = "-";
      return;
    }
    const [preRes, postRes] = await Promise.all([
      scopedQuery("pre").select("id", { count: "exact", head: true }),
      scopedQuery("post").select("id", { count: "exact", head: true }),
    ]);
    document.getElementById("count-pre").textContent = String(preRes.count ?? 0);
    document.getElementById("count-post").textContent = String(postRes.count ?? 0);
  }

  document.getElementById("btn-download").addEventListener("click", async () => {
    if (!participant) return;
    const [preRes, postRes] = await Promise.all([scopedQuery("pre"), scopedQuery("post")]);
    const payload = { pre: preRes.data || [], post: postRes.data || [] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-survey-responses.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  refreshParticipant().then(renderSummary);
})();

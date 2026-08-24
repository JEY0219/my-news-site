(function () {
  const EMOTION_CHECK_SCHEMA = [
    {
      id: "feeling",
      type: "choice",
      label: "기사를 읽으며 가장 크게 느낀 감정은 무엇입니까",
      options: ["분노", "불안", "안타까움", "자부심", "불신", "특별한 감정 없음", "기타"],
    },
    {
      id: "influence",
      type: "choice",
      label: "그 감정에 가장 큰 영향을 준 요소는 무엇입니까",
      options: ["기사 제목", "피해 사례", "책임 주체에 대한 설명", "사용된 사진", "반복된 단어", "제시된 해결책", "기타"],
    },
    {
      id: "changed_by_other_outlet",
      type: "choice",
      label: "다른 언론사의 기사를 본 뒤 처음 느낀 감정이 달라졌습니까",
      options: ["전혀 달라지지 않았다", "거의 달라지지 않았다", "조금 달라졌다", "많이 달라졌다", "매우 많이 달라졌다"],
    },
    {
      id: "changed_by_other_region",
      type: "choice",
      label: "다른 지역의 기사를 본 뒤 처음 판단을 수정하게 되었습니까",
      options: ["전혀 아니다", "아니다", "보통이다", "그렇다", "매우 그렇다"],
    },
  ];

  const issueId = new URLSearchParams(window.location.search).get("issue");

  const backBtn = document.getElementById("btn-back");
  if (issueId) {
    backBtn.href = `region-compare.html?issue=${encodeURIComponent(issueId)}`;
  }

  const formEl = document.getElementById("emotion-form");
  const errorEl = document.getElementById("form-error");
  const loginRequiredEl = document.getElementById("login-required");
  const loginRequiredLink = document.getElementById("login-required-link");
  const submitBtn = document.getElementById("btn-submit");
  const formSection = document.getElementById("form-section");
  const resultPanel = document.getElementById("result-panel");

  loginRequiredLink.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;

  renderSchema(EMOTION_CHECK_SCHEMA, formEl);

  let participant = null;
  submitBtn.disabled = true;
  getParticipantDescriptor().then((p) => {
    participant = p;
    if (p) {
      loginRequiredEl.classList.remove("is-visible");
      submitBtn.disabled = false;
    } else {
      loginRequiredEl.classList.add("is-visible");
      submitBtn.disabled = true;
    }
  });

  submitBtn.addEventListener("click", async () => {
    if (!supabaseClient) {
      errorEl.textContent = "Supabase 설정이 필요합니다 (assets/js/supabase-client.js).";
      errorEl.classList.add("is-visible");
      return;
    }
    if (!participant) {
      loginRequiredEl.classList.add("is-visible");
      return;
    }

    const answers = collectAnswers(formEl, EMOTION_CHECK_SCHEMA);
    const allAnswered = EMOTION_CHECK_SCHEMA.every((q) => answers[q.id]);

    if (!allAnswered) {
      errorEl.classList.add("is-visible");
      return;
    }
    errorEl.classList.remove("is-visible");

    submitBtn.disabled = true;
    const { error } = await supabaseClient.from("emotion_check_responses").insert({
      issue_id: issueId || null,
      participant_kind: participant.participant_kind,
      anon_code: participant.anon_code,
      user_id: participant.user_id,
      answers,
    });
    submitBtn.disabled = false;

    if (error) {
      errorEl.textContent = `저장에 실패했습니다: ${error.message}`;
      errorEl.classList.add("is-visible");
      return;
    }

    formSection.style.display = "none";
    resultPanel.classList.add("is-visible");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();

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

  /* ---------------- 권한 가드 ---------------- */

  getIdentity().then((identity) => {
    if (identity.kind !== "admin") {
      window.location.href = "login.html?tab=admin&redirect=admin.html";
      return;
    }
    document.getElementById("admin-guard").style.display = "none";
    document.getElementById("admin-content").style.display = "block";
    initTabs();
    initArticleManager();
    initCandidateManager();
    initDashboard();
  });

  function initTabs() {
    const tabs = document.querySelectorAll(".mode-tab");
    const panels = {
      articles: document.getElementById("panel-articles"),
      candidates: document.getElementById("panel-candidates"),
      dashboard: document.getElementById("panel-dashboard"),
    };
    function setMode(mode) {
      const target = panels[mode] ? mode : "articles";
      tabs.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.mode === target));
      Object.keys(panels).forEach((key) => panels[key].classList.toggle("is-active", key === target));
    }
    tabs.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
    setMode("articles");
  }

  /* ---------------- 기사 관리 ---------------- */

  function initArticleManager() {
    const listEl = document.getElementById("article-list-admin");
    const formTitleEl = document.getElementById("article-form-title");
    const errorEl = document.getElementById("article-form-error");
    const saveBtn = document.getElementById("btn-save-article");
    const cancelBtn = document.getElementById("btn-cancel-edit");

    const fields = {
      no: document.getElementById("f-no"),
      issue_id: document.getElementById("f-issue"),
      title: document.getElementById("f-title"),
      outlet: document.getElementById("f-outlet"),
      region: document.getElementById("f-region"),
      article_date: document.getElementById("f-date"),
      date_estimated: document.getElementById("f-estimated"),
      summary: document.getElementById("f-summary"),
      url: document.getElementById("f-url"),
      victim: document.getElementById("f-victim"),
      responsible: document.getElementById("f-responsible"),
      solver: document.getElementById("f-solver"),
      emotion: document.getElementById("f-emotion"),
      policy: document.getElementById("f-policy"),
    };

    let editingId = null;

    function resetForm() {
      editingId = null;
      Object.entries(fields).forEach(([key, el]) => {
        if (key === "date_estimated") el.checked = false;
        else el.value = "";
      });
      formTitleEl.textContent = "새 기사 추가";
      cancelBtn.style.display = "none";
      errorEl.classList.remove("is-visible");
    }

    function fillForm(row) {
      editingId = row.id;
      fields.no.value = row.no || "";
      fields.issue_id.value = row.issue_id || "gwangju-518";
      fields.title.value = row.title || "";
      fields.outlet.value = row.outlet || "";
      fields.region.value = row.region || "";
      fields.article_date.value = row.article_date || "";
      fields.date_estimated.checked = !!row.date_estimated;
      fields.summary.value = row.summary || "";
      fields.url.value = row.url || "";
      fields.victim.value = row.victim || "";
      fields.responsible.value = row.responsible || "";
      fields.solver.value = row.solver || "";
      fields.emotion.value = row.emotion || "";
      fields.policy.value = row.policy || "";
      formTitleEl.textContent = `기사 수정 (${row.no})`;
      cancelBtn.style.display = "inline-flex";
      errorEl.classList.remove("is-visible");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function loadArticles() {
      listEl.innerHTML = '<p class="muted" style="padding:8px 2px;">불러오는 중...</p>';
      const { data, error } = await supabaseClient
        .from("articles")
        .select("*")
        .order("issue_id", { ascending: true })
        .order("article_date", { ascending: true });

      if (error) {
        listEl.innerHTML = `<p class="muted" style="padding:8px 2px;">불러오지 못했습니다: ${error.message}</p>`;
        return;
      }

      document.getElementById("stat-article-count").textContent = String(data.length);

      listEl.innerHTML = "";
      data.forEach((row) => {
        const item = document.createElement("div");
        item.className = "article-row";
        item.innerHTML = `
          <div class="article-row__main">
            <div class="article-row__title">${row.title}</div>
            <div class="article-row__meta">${row.no} · ${row.issue_id} · ${row.outlet || ""} · ${row.article_date || ""}</div>
          </div>
          <div class="article-row__actions">
            <button type="button" class="btn btn-secondary" data-action="edit">수정</button>
            <button type="button" class="btn btn-ghost" data-action="delete">삭제</button>
          </div>
        `;
        item.querySelector('[data-action="edit"]').addEventListener("click", () => fillForm(row));
        item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!window.confirm(`"${row.title}" 기사를 삭제할까요?`)) return;
          const { error: delError } = await supabaseClient.from("articles").delete().eq("id", row.id);
          if (delError) {
            window.alert(`삭제 실패: ${delError.message}`);
            return;
          }
          loadArticles();
        });
        listEl.appendChild(item);
      });
    }

    saveBtn.addEventListener("click", async () => {
      const payload = {
        no: fields.no.value.trim(),
        issue_id: fields.issue_id.value,
        title: fields.title.value.trim(),
        outlet: fields.outlet.value.trim(),
        region: fields.region.value.trim(),
        article_date: fields.article_date.value || null,
        date_estimated: fields.date_estimated.checked,
        summary: fields.summary.value.trim(),
        url: fields.url.value.trim(),
        victim: fields.victim.value.trim(),
        responsible: fields.responsible.value.trim(),
        solver: fields.solver.value.trim(),
        emotion: fields.emotion.value.trim(),
        policy: fields.policy.value.trim(),
      };

      if (!payload.no || !payload.title) {
        errorEl.textContent = "기사 번호와 제목은 필수입니다.";
        errorEl.classList.add("is-visible");
        return;
      }

      saveBtn.disabled = true;
      const { error } = editingId
        ? await supabaseClient.from("articles").update(payload).eq("id", editingId)
        : await supabaseClient.from("articles").insert(payload);
      saveBtn.disabled = false;

      if (error) {
        errorEl.textContent = `저장 실패: ${error.message}`;
        errorEl.classList.add("is-visible");
        return;
      }

      resetForm();
      loadArticles();
    });

    cancelBtn.addEventListener("click", resetForm);

    async function populateIssueOptions() {
      try {
        const issues = await fetchIssues();
        fields.issue_id.innerHTML = issues.map((i) => `<option value="${i.id}">${i.title}</option>`).join("");
      } catch (err) {
        fields.issue_id.innerHTML = '<option value="">이슈를 불러오지 못했습니다</option>';
        console.error("이슈 목록 조회 실패:", err);
      }
    }

    populateIssueOptions().then(loadArticles);
  }

  /* ---------------- 이슈 후보 (승인 대기) ---------------- */

  function initCandidateManager() {
    const listEl = document.getElementById("candidate-list-admin");
    const runBtn = document.getElementById("btn-run-discovery");
    const statusEl = document.getElementById("discovery-status");
    const defaultStatusText = statusEl.textContent;

    function formatCount(article) {
      return `${article.outlet || "언론사 미상"} · ${article.date || ""}`;
    }

    function renderCandidate(candidate) {
      const row = document.createElement("div");
      row.className = "candidate-row";
      row.innerHTML = `
        <div class="candidate-row__top">
          <div>
            <div class="candidate-row__title">${candidate.title}</div>
            <div class="candidate-row__meta">${candidate.region} · 키워드 "${candidate.keyword}" · 매칭 기사 ${candidate.matched_count}건</div>
            <div class="candidate-row__desc">${candidate.description || ""}</div>
          </div>
          <div class="candidate-row__actions">
            <button type="button" class="btn btn-secondary" data-action="preview">미리보기</button>
            <button type="button" class="btn btn-primary" data-action="approve">이슈로 등록</button>
            <button type="button" class="btn btn-ghost" data-action="reject">반려</button>
          </div>
        </div>
        <div class="candidate-preview" data-el="preview">
          ${(candidate.matched_articles || [])
            .map(
              (a) => `
            <div class="candidate-preview__item">
              <strong>${a.title}</strong> (${formatCount(a)})<br />
              <span class="candidate-preview__npf">
                피해자: ${a.npf?.victim || "-"} · 책임주체: ${a.npf?.responsible || "-"} ·
                해결자: ${a.npf?.solver || "-"} · 감정: ${a.npf?.emotion || "-"} · 정책대안: ${a.npf?.policy || "-"}
              </span>
            </div>
          `
            )
            .join("")}
        </div>
        <div class="candidate-approve-form" data-el="approve-form">
          <input type="text" data-field="title" value="${candidate.title}" placeholder="이슈 제목" />
          <input type="text" data-field="question" value="${candidate.question}" placeholder="핵심 질문" />
          <div class="form-actions">
            <button type="button" class="btn btn-primary" data-action="confirm-approve">등록 확정</button>
            <button type="button" class="btn btn-ghost" data-action="cancel-approve">취소</button>
          </div>
        </div>
      `;

      const previewEl = row.querySelector('[data-el="preview"]');
      const approveFormEl = row.querySelector('[data-el="approve-form"]');

      row.querySelector('[data-action="preview"]').addEventListener("click", () => {
        previewEl.classList.toggle("is-open");
      });

      row.querySelector('[data-action="approve"]').addEventListener("click", () => {
        approveFormEl.classList.toggle("is-open");
      });
      row.querySelector('[data-action="cancel-approve"]').addEventListener("click", () => {
        approveFormEl.classList.remove("is-open");
      });

      row.querySelector('[data-action="confirm-approve"]').addEventListener("click", async () => {
        const title = row.querySelector('[data-field="title"]').value.trim();
        const question = row.querySelector('[data-field="question"]').value.trim();
        if (!title || !question) {
          window.alert("제목과 핵심 질문은 비워둘 수 없습니다.");
          return;
        }
        await approveCandidate(candidate, { title, question });
      });

      row.querySelector('[data-action="reject"]').addEventListener("click", async () => {
        if (!window.confirm(`"${candidate.title}" 후보를 반려할까요?`)) return;
        await decideCandidate(candidate.id, "rejected");
      });

      return row;
    }

    async function loadCandidates() {
      listEl.innerHTML = '<p class="muted" style="padding:8px 2px;">불러오는 중...</p>';
      const { data, error } = await supabaseClient
        .from("issue_candidates")
        .select("*")
        .eq("status", "pending")
        .order("matched_count", { ascending: false });

      if (error) {
        listEl.innerHTML = `<p class="muted" style="padding:8px 2px;">불러오지 못했습니다: ${error.message}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        listEl.innerHTML = '<p class="muted" style="padding:8px 2px;">승인 대기 중인 이슈 후보가 없습니다.</p>';
        return;
      }

      listEl.innerHTML = "";
      data.forEach((candidate) => listEl.appendChild(renderCandidate(candidate)));
    }

    async function decideCandidate(candidateId, status) {
      const identity = await getIdentity();
      const { error } = await supabaseClient
        .from("issue_candidates")
        .update({ status, decided_at: new Date().toISOString(), decided_by: identity.userId || null })
        .eq("id", candidateId);
      if (error) {
        window.alert(`처리 실패: ${error.message}`);
        return;
      }
      loadCandidates();
    }

    async function approveCandidate(candidate, edited) {
      const { error: issueError } = await supabaseClient.from("issues").insert({
        id: candidate.id,
        title: edited.title,
        question: edited.question,
        region: candidate.region,
        description: candidate.description,
        source: "auto",
      });
      if (issueError) {
        window.alert(`이슈 등록 실패: ${issueError.message}`);
        return;
      }

      const articleRows = (candidate.matched_articles || []).map((a, index) => ({
        no: `AUTO-${candidate.id.slice(0, 8)}-${index + 1}`,
        issue_id: candidate.id,
        title: a.title,
        outlet: a.outlet,
        region: candidate.region,
        article_date: a.date || null,
        date_estimated: false,
        summary: a.summary,
        url: a.url,
        victim: a.npf?.victim || "",
        responsible: a.npf?.responsible || "",
        solver: a.npf?.solver || "",
        emotion: a.npf?.emotion || "",
        policy: a.npf?.policy || "",
      }));

      if (articleRows.length > 0) {
        const { error: articlesError } = await supabaseClient.from("articles").insert(articleRows);
        if (articlesError) {
          window.alert(`이슈는 등록되었지만 기사 저장에 실패했습니다: ${articlesError.message}`);
        }
      }

      await decideCandidate(candidate.id, "approved");
    }

    function setDiscoveryStatus(kind, text) {
      statusEl.className = kind ? `discovery-status discovery-status--${kind}` : "discovery-status";
      statusEl.textContent = text;
    }

    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      runBtn.textContent = "검색 중...";
      setDiscoveryStatus(
        "loading",
        "🔄 검색을 실행하고 있습니다. 17개 시/도를 순서대로 확인하느라 최대 3분 정도 걸릴 수 있어요 - 이 창을 벗어나지 말고 잠시 기다려 주세요."
      );
      /* 검색이 오래 걸리는 동안 목록 영역도 "검색 중" 상태로 바꿔서,
         상태 문구만 보고는 실행 여부를 알아채기 어려운 경우에도 뭔가
         진행 중이라는 걸 알 수 있게 한다. */
      listEl.innerHTML = '<p class="muted" style="padding:8px 2px;">🔄 새 이슈 후보를 검색하는 중입니다. 완료되면 아래 목록이 자동으로 갱신됩니다...</p>';

      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error("로그인 세션을 확인할 수 없습니다. 새로고침 후 다시 로그인해 주세요.");
        }

        const res = await fetch("/api/issue-discovery/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        });
        const result = await res.json();

        if (!res.ok || result.status !== "ok") {
          setDiscoveryStatus("error", `❌ 실패: ${result.error || "알 수 없는 오류"}`);
        } else {
          const seconds = Math.round((result.durationMs || 0) / 1000);
          setDiscoveryStatus(
            "success",
            `✅ 완료(${seconds}초): 새 후보 ${result.inserted}건 (중복 제외 ${result.skippedDuplicate}건, ` +
              `부적절한 내용 제외 ${result.skippedProfanity}건, ${result.regionsProcessed}개 지역 처리)`
          );
        }
      } catch (err) {
        setDiscoveryStatus("error", `❌ 요청 실패: ${err.message}`);
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "새 후보 찾기";
        /* 성공/실패와 무관하게 항상 목록을 다시 불러온다 - 예전에는
           성공했을 때만 loadCandidates()를 불러서, 검색이 실패하면
           목록이 "검색 중..." placeholder에 그대로 멈춰 있었다. */
        loadCandidates();
      }
    });

    statusEl.textContent = defaultStatusText;
    loadCandidates();
  }

  /* ---------------- 설문 결과 대시보드 ---------------- */

  function isScaleQuestion(q) {
    return q.type === "choice" && JSON.stringify(q.options) === JSON.stringify(SCALE_AGREE);
  }

  function summarizeQuestion(q, rows) {
    if (q.type === "text") return null;

    if (q.type === "textarea") {
      const answers = rows.map((r) => r.answers && r.answers[q.id]).filter((v) => v && v.trim());
      return { label: q.label, kind: "text", answers };
    }

    const counts = {};
    rows.forEach((r) => {
      const val = r.answers && r.answers[q.id];
      if (!val) return;
      counts[val] = (counts[val] || 0) + 1;
    });

    let average = null;
    if (isScaleQuestion(q)) {
      let sum = 0;
      let n = 0;
      Object.entries(counts).forEach(([label, c]) => {
        const idx = SCALE_AGREE.indexOf(label);
        if (idx >= 0) {
          sum += (idx + 1) * c;
          n += c;
        }
      });
      average = n > 0 ? (sum / n).toFixed(2) : null;
    }

    const optionSet = new Set(q.options || []);
    const breakdown = (q.options || []).map((opt) => ({ option: opt, count: counts[opt] || 0 }));
    Object.keys(counts).forEach((key) => {
      if (!optionSet.has(key)) breakdown.push({ option: key, count: counts[key] });
    });

    return { label: q.label, kind: "choice", breakdown, average };
  }

  function renderQuestionSummary(container, summary) {
    if (!summary) return;
    const card = document.createElement("div");
    card.className = "card q-summary-card";

    if (summary.kind === "text") {
      card.innerHTML = `<div class="q-summary-card__label">${summary.label} (주관식, ${summary.answers.length}건)</div>`;
      const list = document.createElement("div");
      list.className = "text-answer-list";
      summary.answers.slice(0, 50).forEach((a) => {
        const item = document.createElement("div");
        item.className = "text-answer-list__item";
        item.textContent = a;
        list.appendChild(item);
      });
      if (summary.answers.length === 0) {
        list.innerHTML = '<div class="text-answer-list__item muted">응답 없음</div>';
      }
      card.appendChild(list);
    } else {
      const maxCount = Math.max(1, ...summary.breakdown.map((b) => b.count));
      const rowsHtml = summary.breakdown
        .map(
          (b) => `
        <div class="q-bar-row">
          <span class="q-bar-row__label">${b.option}</span>
          <span class="q-bar-track"><span class="q-bar-fill" style="width:${(b.count / maxCount) * 100}%"></span></span>
          <span class="q-bar-row__count">${b.count}명</span>
        </div>
      `
        )
        .join("");
      card.innerHTML = `
        <div class="q-summary-card__label">${summary.label}</div>
        ${rowsHtml}
        ${summary.average !== null ? `<div class="q-avg">평균 ${summary.average} / 5.00</div>` : ""}
      `;
    }
    container.appendChild(card);
  }

  function csvCell(value) {
    const str = value === undefined || value === null ? "" : String(value);
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  async function initDashboard() {
    const [preRes, postRes, emotionRes] = await Promise.all([
      supabaseClient.from("survey_responses").select("*").eq("survey_type", "pre"),
      supabaseClient.from("survey_responses").select("*").eq("survey_type", "post"),
      supabaseClient.from("emotion_check_responses").select("*"),
    ]);

    const pre = preRes.data || [];
    const post = postRes.data || [];
    const emotion = emotionRes.data || [];

    document.getElementById("stat-pre-count").textContent = String(pre.length);
    document.getElementById("stat-post-count").textContent = String(post.length);
    document.getElementById("stat-emotion-count").textContent = String(emotion.length);

    const preContainer = document.getElementById("dashboard-pre");
    const postContainer = document.getElementById("dashboard-post");
    const emotionContainer = document.getElementById("dashboard-emotion");

    preContainer.innerHTML = "";
    postContainer.innerHTML = "";
    emotionContainer.innerHTML = "";

    SURVEY_SCHEMAS.pre.forEach((q) => renderQuestionSummary(preContainer, summarizeQuestion(q, pre)));
    SURVEY_SCHEMAS.post.forEach((q) => renderQuestionSummary(postContainer, summarizeQuestion(q, post)));
    EMOTION_CHECK_SCHEMA.forEach((q) => renderQuestionSummary(emotionContainer, summarizeQuestion(q, emotion)));

    document.getElementById("btn-download-all-csv").addEventListener("click", () => {
      const preIds = SURVEY_SCHEMAS.pre.map((q) => q.id);
      const postIds = SURVEY_SCHEMAS.post.map((q) => q.id);
      const header = ["구분", "참여유형", "식별자", "제출시각", ...preIds, ...postIds];
      const rows = [header];

      function identifier(r) {
        return r.participant_kind === "member" ? r.user_id : r.anon_code;
      }

      pre.forEach((r) => {
        const row = ["사전", r.participant_kind, identifier(r), r.created_at];
        preIds.forEach((id) => row.push(r.answers[id] || ""));
        postIds.forEach(() => row.push(""));
        rows.push(row);
      });
      post.forEach((r) => {
        const row = ["사후", r.participant_kind, identifier(r), r.created_at];
        preIds.forEach(() => row.push(""));
        postIds.forEach((id) => row.push(r.answers[id] || ""));
        rows.push(row);
      });

      const csvBody = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      const BOM = String.fromCharCode(0xfeff);
      const blob = new Blob([BOM + csvBody], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "all-survey-responses.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
})();

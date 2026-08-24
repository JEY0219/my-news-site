(function () {
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const str = value === undefined || value === null ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function scopedQuery(participant, surveyType) {
    let q = supabaseClient.from("survey_responses").select("*").eq("survey_type", surveyType);
    if (participant.participant_kind === "member") {
      q = q.eq("user_id", participant.user_id);
    } else {
      q = q.eq("anon_code", participant.anon_code);
    }
    return q;
  }

  async function init() {
    if (!supabaseClient) {
      document.getElementById("login-note").style.display = "block";
      document.getElementById("btn-download-json").disabled = true;
      document.getElementById("btn-download-csv").disabled = true;
      return;
    }

    const participant = await getParticipantDescriptor();

    if (!participant) {
      document.getElementById("login-note").style.display = "block";
      document.getElementById("btn-download-json").disabled = true;
      document.getElementById("btn-download-csv").disabled = true;
      return;
    }

    const [preRes, postRes] = await Promise.all([
      scopedQuery(participant, "pre"),
      scopedQuery(participant, "post"),
    ]);
    const pre = preRes.data || [];
    const post = postRes.data || [];

    document.getElementById("count-pre").textContent = String(pre.length);
    document.getElementById("count-post").textContent = String(post.length);
    if (pre.length === 0 && post.length === 0) {
      document.getElementById("empty-note").style.display = "block";
    }

    document.getElementById("btn-download-json").addEventListener("click", () => {
      downloadBlob(JSON.stringify({ pre, post }, null, 2), "my-survey-responses.json", "application/json");
    });

    document.getElementById("btn-download-csv").addEventListener("click", () => {
      const preIds = SURVEY_SCHEMAS.pre.map((q) => q.id);
      const postIds = SURVEY_SCHEMAS.post.map((q) => q.id);
      const header = ["구분", "제출시각", ...preIds, ...postIds];
      const rows = [header];

      pre.forEach((r) => {
        const row = ["사전", r.created_at];
        preIds.forEach((id) => row.push(r.answers[id] || ""));
        postIds.forEach(() => row.push(""));
        rows.push(row);
      });
      post.forEach((r) => {
        const row = ["사후", r.created_at];
        preIds.forEach(() => row.push(""));
        postIds.forEach((id) => row.push(r.answers[id] || ""));
        rows.push(row);
      });

      const csvBody = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      const BOM = String.fromCharCode(0xfeff);
      downloadBlob(BOM + csvBody, "my-survey-responses.csv", "text/csv;charset=utf-8;");
    });
  }

  init();
})();

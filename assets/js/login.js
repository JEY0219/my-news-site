(function () {
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("redirect") || "index.html";
  const initialTab = params.get("tab") === "admin" ? "admin" : "guest";

  const tabs = document.querySelectorAll(".mode-tab");
  const panels = {
    guest: document.getElementById("panel-guest"),
    member: document.getElementById("panel-member"),
    admin: document.getElementById("panel-admin"),
  };

  function setMode(mode) {
    tabs.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.mode === mode));
    Object.keys(panels).forEach((key) => panels[key].classList.toggle("is-active", key === mode));
  }

  tabs.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  setMode(initialTab);

  /* ---------------- 현재 상태 표시 ---------------- */

  const statusCard = document.getElementById("status-card");
  const statusValue = document.getElementById("status-value");
  const logoutBtn = document.getElementById("btn-logout");

  function refreshStatus() {
    getIdentity().then((identity) => {
      if (identity.kind === "none") {
        statusCard.classList.remove("is-visible");
        return;
      }
      let text = "";
      if (identity.kind === "admin") text = `관리자로 로그인됨 (${identity.email})`;
      else if (identity.kind === "member") text = `회원으로 로그인됨 (${identity.email})`;
      else if (identity.kind === "guest") text = `비회원 식별번호 ${identity.code} 사용 중`;
      statusValue.textContent = text;
      statusCard.classList.add("is-visible");
    });
  }
  refreshStatus();

  logoutBtn.addEventListener("click", async () => {
    await signOutCurrentUser();
    refreshStatus();
  });

  /* ---------------- 비회원 ---------------- */

  const guestError = document.getElementById("guest-error");

  document.getElementById("btn-guest-continue").addEventListener("click", async () => {
    const code = document.getElementById("guest-code").value.trim();
    if (!/^\d{4}$/.test(code)) {
      guestError.classList.add("is-visible");
      return;
    }
    guestError.classList.remove("is-visible");

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session) {
        await supabaseClient.auth.signOut();
      }
    }
    setGuestCode(code);
    window.location.href = redirectTo;
  });

  /* ---------------- 회원 ---------------- */

  let memberSubMode = "signin";
  const memberError = document.getElementById("member-error");
  const memberSuccess = document.getElementById("member-success");
  const memberSubmitBtn = document.getElementById("btn-member-submit");

  document.querySelectorAll("#panel-member .sub-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      memberSubMode = btn.dataset.sub;
      document.querySelectorAll("#panel-member .sub-toggle button").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      memberSubmitBtn.textContent = memberSubMode === "signup" ? "회원가입" : "로그인";
      memberError.classList.remove("is-visible");
      memberSuccess.classList.remove("is-visible");
    });
  });

  memberSubmitBtn.addEventListener("click", async () => {
    memberError.classList.remove("is-visible");
    memberSuccess.classList.remove("is-visible");

    if (!supabaseClient) {
      memberError.textContent = "Supabase 설정이 필요합니다 (assets/js/supabase-client.js).";
      memberError.classList.add("is-visible");
      return;
    }

    const email = document.getElementById("member-email").value.trim();
    const password = document.getElementById("member-password").value;

    if (!email || password.length < 6) {
      memberError.textContent = "이메일과 6자 이상의 비밀번호를 입력해 주세요.";
      memberError.classList.add("is-visible");
      return;
    }

    if (memberSubMode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        memberError.textContent = error.message;
        memberError.classList.add("is-visible");
        return;
      }
      if (data.session) {
        clearGuestCode();
        window.location.href = redirectTo;
      } else {
        memberSuccess.textContent = "가입 확인 이메일을 보냈습니다. 메일함을 확인한 뒤 로그인해 주세요.";
        memberSuccess.classList.add("is-visible");
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        memberError.textContent = error.message;
        memberError.classList.add("is-visible");
        return;
      }
      clearGuestCode();
      window.location.href = redirectTo;
    }
  });

  /* ---------------- 관리자 ---------------- */

  const adminError = document.getElementById("admin-error");

  document.getElementById("btn-admin-submit").addEventListener("click", async () => {
    adminError.classList.remove("is-visible");

    if (!supabaseClient) {
      adminError.textContent = "Supabase 설정이 필요합니다 (assets/js/supabase-client.js).";
      adminError.classList.add("is-visible");
      return;
    }

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      adminError.textContent = error.message;
      adminError.classList.add("is-visible");
      return;
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      await supabaseClient.auth.signOut();
      adminError.textContent = "관리자 계정이 아닙니다.";
      adminError.classList.add("is-visible");
      return;
    }

    clearGuestCode();
    window.location.href = "admin.html";
  });
})();

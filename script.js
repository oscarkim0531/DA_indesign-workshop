(() => {
  const TASK_KEY = "da-indesign-project-current-tasks-v2";
  const NOTE_KEY = "da-indesign-project-notes-v1";
  const LOG_KEY = "da-indesign-project-logs-v1";
  const LEGACY_KEYS = {
    [NOTE_KEY]: "da-work01-notes-v1",
    [LOG_KEY]: "da-work01-logs-v1",
  };

  Object.entries(LEGACY_KEYS).forEach(([currentKey, legacyKey]) => {
    if (localStorage.getItem(currentKey) === null && localStorage.getItem(legacyKey) !== null) {
      localStorage.setItem(currentKey, localStorage.getItem(legacyKey));
    }
  });

  const shell = document.querySelector(".app-shell");
  const taskInputs = [...document.querySelectorAll("[data-task]")];
  const currentTaskInputs = [...document.querySelectorAll("[data-current-task]")];
  const progressValues = [...document.querySelectorAll("[data-progress-value]")];
  const progressTrack = document.querySelector("[role='progressbar']");
  const progressBar = document.querySelector("[data-progress-bar]");
  const progressRing = document.querySelector(".done-ring");
  const completedOutput = document.querySelector("[data-task-completed]");
  const totalOutput = document.querySelector("[data-task-total]");

  const readJSON = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const savedTasks = readJSON(TASK_KEY, {});
  taskInputs.forEach((input) => {
    if (Object.prototype.hasOwnProperty.call(savedTasks, input.dataset.task)) {
      input.checked = Boolean(savedTasks[input.dataset.task]);
    }
  });

  const updateProgress = () => {
    const uniqueTasks = new Map();
    currentTaskInputs.forEach((input) => uniqueTasks.set(input.dataset.task, input.checked));

    const total = uniqueTasks.size;
    const completed = [...uniqueTasks.values()].filter(Boolean).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    progressValues.forEach((node) => {
      node.textContent = String(percent);
    });
    if (completedOutput) completedOutput.textContent = String(completed);
    if (totalOutput) totalOutput.textContent = String(total);
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressRing) progressRing.style.setProperty("--progress", `${percent}%`);
    if (progressTrack) {
      progressTrack.setAttribute("aria-valuenow", String(percent));
    }
  };

  taskInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const state = readJSON(TASK_KEY, {});
      state[input.dataset.task] = input.checked;

      document
        .querySelectorAll(`[data-task="${CSS.escape(input.dataset.task)}"]`)
        .forEach((matchingInput) => {
          matchingInput.checked = input.checked;
        });

      localStorage.setItem(TASK_KEY, JSON.stringify(state));
      updateProgress();
    });
  });
  updateProgress();

  const pad = document.querySelector("[data-persist-note]");
  const saveStatus = document.querySelector("[data-save-status]");
  if (pad) {
    const savedNotes = readJSON(NOTE_KEY, {});
    pad.value = savedNotes[pad.dataset.persistNote] || "";
    let saveTimer;

    pad.addEventListener("input", () => {
      window.clearTimeout(saveTimer);
      if (saveStatus) saveStatus.textContent = "저장 중…";
      saveTimer = window.setTimeout(() => {
        const notes = readJSON(NOTE_KEY, {});
        notes[pad.dataset.persistNote] = pad.value;
        localStorage.setItem(NOTE_KEY, JSON.stringify(notes));
        if (saveStatus) saveStatus.textContent = "이 브라우저에 저장되었습니다.";
      }, 240);
    });
  }

  const deadline = shell?.dataset.deadline ? new Date(shell.dataset.deadline) : null;
  const daysNode = document.querySelector("[data-countdown-days]");
  const hoursNode = document.querySelector("[data-countdown-hours]");
  const minutesNode = document.querySelector("[data-countdown-minutes]");

  const updateCountdown = () => {
    if (!deadline || Number.isNaN(deadline.getTime())) return;
    const remaining = Math.max(0, deadline.getTime() - Date.now());
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    if (daysNode) daysNode.textContent = String(days).padStart(2, "0");
    if (hoursNode) hoursNode.textContent = String(hours).padStart(2, "0");
    if (minutesNode) minutesNode.textContent = String(minutes).padStart(2, "0");
  };
  updateCountdown();
  window.setInterval(updateCountdown, 60_000);

  const archiveForm = document.querySelector("[data-archive-form]");
  const logList = document.querySelector("[data-log-list]");
  const logCount = document.querySelector("[data-log-count]");

  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>'"]/g,
      (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
    );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(date)
      .replaceAll(". ", ".")
      .replace(/\.$/, "");
  };

  const renderLogs = () => {
    if (!logList) return;
    logList.querySelectorAll(".log-user").forEach((entry) => entry.remove());
    const logs = readJSON(LOG_KEY, []);

    logs
      .slice()
      .reverse()
      .forEach((log) => {
        const article = document.createElement("article");
        article.className = "log-entry log-user";
        article.innerHTML = `
          <div class="log-meta">
            <span>${escapeHTML(log.type)}</span>
            <time datetime="${escapeHTML(log.createdAt)}">${escapeHTML(formatDate(log.createdAt))}</time>
          </div>
          <h3>${escapeHTML(log.title)}</h3>
          <p>${escapeHTML(log.note).replaceAll("\n", "<br>")}</p>
        `;
        logList.insertBefore(article, logList.querySelector(".log-seed"));
      });

    if (logCount) logCount.textContent = String(logs.length + 14);
  };

  archiveForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(archiveForm);
    const entry = {
      type: String(formData.get("type") || "DECISION"),
      title: String(formData.get("title") || "").trim(),
      note: String(formData.get("note") || "").trim(),
      createdAt: new Date().toISOString(),
    };
    if (!entry.title || !entry.note) return;

    const logs = readJSON(LOG_KEY, []);
    logs.push(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    archiveForm.reset();
    renderLogs();
  });
  renderLogs();

  document.querySelector("[data-export-log]")?.addEventListener("click", () => {
    const logs = readJSON(LOG_KEY, []);
    const seed = [
      "[SOURCE] 2026.08.07 — 공지방 원본 정리\n참여자 입·퇴장 기록을 제거하고 Date / User / Message 구조의 원본을 준비했다.",
      "[DECISION] 2026.08.09 — 대표 원본을 CSV로 고정\n동일한 내보내기 사본을 구분하고, 분석 기준 파일을 edit.csv 하나로 정했다.",
      "[RESULT] 2026.08.09 — 20가지 분석·통계 도출\n공지의 크기, 편집 문법, 시간, 발신자 차이를 네 개의 대제목과 20개의 검산 가능한 분석으로 구조화했다.",
      "[DECISION] 2026.08.09 — 핵심 분석 8개와 분석 관점 확정\n01·02·07·08·09·13·17·18을 선택하고, 공지방을 학교생활을 운영한 작은 정보 유통 시스템으로 분석하기로 했다.",
      "[DECISION] 2026.08.09 — 데이터 원칙과 핵심 질문 확정\n익명화·삭제 기록 분리·미디어 수량 처리·민감 정보 비노출 원칙을 정하고, ‘한 학년 동안 공지방에 온 학과 공지는 어떤 규칙이 있을까?’를 핵심 질문으로 확정했다.",
      "[RESULT] 2026.08.09 — 원고 Ver.01 작성\n선택한 8개 분석을 지속·조합·이동·집중의 네 가지 규칙으로 구성해, 들어가며와 나가며를 갖춘 첫 원고를 완성했다.",
      "[REVISION] 2026.08.10 — 원고 Ver.01.01 수정\n작업 과정 설명과 발신자 중심 분석을 덜어내고, 학사 구간·콘텐츠 구성·이모지 353종·핵심 행동어를 네 가지 패턴의 줄글 본문과 별도 그래픽 자료로 다시 구성했다.",
      "[TITLE] 2026.08.10 — A School Year in the Inbox\n한 학년 동안 여러 종류의 공지가 한곳에 축적된 공동의 수신함이라는 관점을 포괄하는 영문 제목으로 확정했다.",
      "[TONE] 2026.08.10 — 건조한 관찰 보고서 톤 확정\n수치를 먼저 제시하고 해석은 한 걸음 물러서며, 공지 원문의 강한 시각언어와 차분한 본문의 대비를 활용하기로 했다.",
      "[CHECK] 2026.08.10 — 원고·수치·개인정보 최종 점검\n핵심 통계를 대표 CSV와 다시 대조하고, 본문에서 실제 이름·연락처·원문 링크가 드러나지 않는지 확인했다.",
      "[DELIVERABLE] 2026.08.10 — 웹 제출본과 Work 01 인쇄 기능 준비\n개인용 원본 CSV 다운로드와 Work 01 전용 인쇄·PDF 저장 기능을 추가하고, 웹사이트를 주 제출 문서로 정했다.",
      "[PLAN] 2026.08.10 — 내지 20페이지 구성과 그래픽 방향 확정\n속표지부터 캡션까지 여덟 개의 페이지 묶음을 정하고, 전구·기간별 밀도·콘텐츠 비율·이모지 벽·행동어·링크 화면의 그래픽 역할을 함께 기록했다.",
      "[SOURCE] 2026.08.11 — Work 02 공식 안내 수신\n페이지 순서, 새 문서, 마스터, 스타일, 간격, 이미지, 전체 적용, 매크로로 이어지는 여덟 단계의 과제 범위를 확인했다.",
      "[PLAN] 2026.08.11 — 8월 18일까지의 Work 02 계획 수립\n구조를 먼저 만들고 디테일을 나중에 다듬는 원칙에 따라, 하루 단위 산출물과 18일 18시 내부 마감을 정했다.",
    ];
    const userLogs = logs.map(
      (log) => `[${log.type}] ${formatDate(log.createdAt)} — ${log.title}\n${log.note}`,
    );
    const text = ["DA INDESIGN WORKSHOP / PROJECT LOG", "", ...seed, ...userLogs].join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "DA_InDesign_Workshop_process-log.txt";
    link.click();
    URL.revokeObjectURL(url);
  });

  let printOpenStates = [];
  const clearPrintMode = () => {
    if (!document.body.classList.contains("print-work01")) return;
    printOpenStates.forEach(({ details, wasOpen }) => {
      details.open = wasOpen;
    });
    printOpenStates = [];
    document.body.classList.remove("print-work01");
  };

  const printWork01 = () => {
    printOpenStates = [...document.querySelectorAll("[data-work01-print] details")].map((details) => ({
      details,
      wasOpen: details.open,
    }));
    printOpenStates.forEach(({ details }) => {
      details.open = true;
    });
    document.body.classList.add("print-work01");
    window.print();
    window.setTimeout(clearPrintMode, 1000);
  };

  document.querySelectorAll("[data-print-work01]").forEach((button) => {
    button.addEventListener("click", printWork01);
  });
  window.addEventListener("afterprint", clearPrintMode);

  const navLinks = [...document.querySelectorAll(".side-nav a")];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
        });
      },
      { rootMargin: "-20% 0px -60%", threshold: [0.05, 0.25, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
  }
})();

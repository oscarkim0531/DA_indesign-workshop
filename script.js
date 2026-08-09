(() => {
  const TASK_KEY = "da-indesign-project-current-tasks-v1";
  const NOTE_KEY = "da-indesign-project-notes-v1";
  const LOG_KEY = "da-indesign-project-logs-v1";
  const LEGACY_KEYS = {
    [TASK_KEY]: "da-work01-tasks-v1",
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
    taskInputs.forEach((input) => uniqueTasks.set(input.dataset.task, input.checked));

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

    if (logCount) logCount.textContent = String(logs.length + 3);
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

  document.querySelector("[data-print-page]")?.addEventListener("click", () => window.print());

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

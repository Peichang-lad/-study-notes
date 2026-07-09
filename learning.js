/**
 * ============================================================
 * Bouke 博客 — 学习追踪系统 (Learning Tracker)
 * 纯前端模块，所有数据存储在浏览器 localStorage 中
 * 技术栈：原生 JavaScript ES6，无框架依赖
 * ============================================================
 *
 * 功能清单：
 *   1.  阅读自动计时（打开/关闭文章时触发）
 *   2.  学习记录卡（首次阅读、最近阅读、次数、累计/本次时长）
 *   3.  阅读历史（最近20次记录，可展开查看）
 *   4.  文章卡片状态徽标（已读/未读/上次阅读天数）
 *   5.  掌握程度（⭐ 1~5 星，点击切换）
 *   6.  学习笔记（文本备注，永久保存）
 *   7.  复习状态（未学习 / 学习中 / 已掌握，三态切换）
 *   8.  首页学习统计面板
 *   9.  侧边栏 - 最近学习
 *  10.  今日学习统计
 *  11.  继续阅读（快速打开上次阅读文章）
 *  12.  学习日历（GitHub 贡献图风格热力图）
 *  13.  学习排行榜（按阅读次数排序）
 *  14.  导出 / 导入 JSON 数据
 * ============================================================
 */

const LearningTracker = (function () {
  "use strict";

  // ==================== Storage Keys ====================
  const KEYS = {
    RECORDS:  "bt_learning_records",   // { [postId]: Record }
    HISTORY:  "bt_learning_history",   // { [postId]: Session[] }
    NOTES:    "bt_learning_notes",     // { [postId]: string }
    MASTERY:  "bt_learning_mastery",   // { [postId]: 0|1|2|3|4|5 }
    REVIEW:   "bt_learning_review",    // { [postId]: "none"|"learning"|"mastered" }
    DAILY:    "bt_learning_daily",     // { "YYYY-MM-DD": DayStats }
  };

  /** @typedef {{ firstRead: string, lastRead: string, readCount: number, totalSeconds: number, lastDuration: number }} Record */
  /** @typedef {{ date: string, duration: number }} Session */
  /** @typedef {{ postIds: string[], totalSeconds: number }} DayStats */

  // ==================== 运行时状态 ====================
  let readingStartTime = null;   // 当前阅读开始时间戳 (ms)
  let currentPostId = null;      // 当前正在阅读的文章 ID
  let onOpenCallback = null;     // 外部回调：打开文章时触发（用于刷新文章卡片状态）
  let onCloseCallback = null;    // 外部回调：关闭文章时触发

  // ==================== 工具函数 ====================

  /** 从 localStorage 读取 JSON，失败返回默认值 */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  /** 写入 localStorage */
  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn("[LearningTracker] localStorage 写入失败:", e);
    }
  }

  /** 获取今天日期字符串 YYYY-MM-DD */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  /** 格式化时间戳为 "YYYY-MM-DD HH:mm" */
  function formatTime(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0");
  }

  /** 格式化秒数为可读时长 */
  function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return "不到1分钟";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return h + "小时" + (m > 0 ? m + "分钟" : "");
    return m + "分钟";
  }

  /** 获取相对天数描述 */
  function daysAgo(dateStr) {
    if (!dateStr) return "";
    const then = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - then) / 86400000);
    if (diff === 0) return "今天";
    if (diff === 1) return "昨天";
    if (diff <= 7) return diff + "天前";
    if (diff <= 30) return Math.floor(diff / 7) + "周前";
    return Math.floor(diff / 30) + "个月前";
  }

  // ==================== 数据读写 ====================

  function getRecords()  { return load(KEYS.RECORDS, {}); }
  function setRecords(v)  { save(KEYS.RECORDS, v); }
  function getHistory()  { return load(KEYS.HISTORY, {}); }
  function setHistory(v)  { save(KEYS.HISTORY, v); }
  function getNotes()    { return load(KEYS.NOTES, {}); }
  function setNotes(v)    { save(KEYS.NOTES, v); }
  function getMastery()  { return load(KEYS.MASTERY, {}); }
  function setMastery(v)  { save(KEYS.MASTERY, v); }
  function getReview()   { return load(KEYS.REVIEW, {}); }
  function setReview(v)   { save(KEYS.REVIEW, v); }
  function getDaily()    { return load(KEYS.DAILY, {}); }
  function setDaily(v)    { save(KEYS.DAILY, v); }

  // ==================== 1. 阅读计时 ====================

  /**
   * 开始阅读（由 script.js 在打开弹窗时调用）
   * @param {string} postId - 文章唯一标识
   */
  function startReading(postId) {
    readingStartTime = Date.now();
    currentPostId = postId;
  }

  /**
   * 结束阅读（由 script.js 在关闭弹窗时调用）
   * @param {string} postId - 文章唯一标识
   */
  function endReading(postId) {
    if (!readingStartTime || currentPostId !== postId) return;
    const elapsed = Math.round((Date.now() - readingStartTime) / 1000);
    readingStartTime = null;
    currentPostId = null;

    if (elapsed < 3) return; // 小于 3 秒忽略（误触）

    const now = new Date();
    const nowStr = formatTime(now);
    const today = todayStr();

    // --- 更新文章学习记录 ---
    const records = getRecords();
    if (!records[postId]) {
      records[postId] = {
        firstRead: nowStr,
        lastRead: nowStr,
        readCount: 0,
        totalSeconds: 0,
        lastDuration: 0
      };
    }
    const rec = records[postId];
    rec.lastRead = nowStr;
    rec.readCount += 1;
    rec.totalSeconds += elapsed;
    rec.lastDuration = elapsed;
    setRecords(records);

    // --- 更新阅读历史（每篇文章最多保留 20 条） ---
    const history = getHistory();
    if (!history[postId]) history[postId] = [];
    history[postId].push({ date: nowStr, duration: elapsed });
    if (history[postId].length > 20) {
      history[postId] = history[postId].slice(-20);
    }
    setHistory(history);

    // --- 更新每日统计 ---
    const daily = getDaily();
    if (!daily[today]) daily[today] = { postIds: [], totalSeconds: 0 };
    if (!daily[today].postIds.includes(postId)) {
      daily[today].postIds.push(postId);
    }
    daily[today].totalSeconds += elapsed;
    setDaily(daily);

    // --- 通知外部更新 UI ---
    if (onCloseCallback) onCloseCallback(postId);
  }

  // ==================== 2. 学习记录卡（弹窗内） ====================

  /**
   * 生成弹窗内的学习记录 HTML
   * @param {string} postId
   * @returns {string} HTML 字符串
   */
  function renderLearningCard(postId) {
    const rec = getRecords()[postId];
    if (!rec) {
      return `<div class="lr-card">
        <h3>📖 学习记录</h3>
        <p class="lr-no-data">还没有学习记录，阅读一会儿就会自动记录。</p>
      </div>`;
    }

    return `
      <div class="lr-card">
        <h3>📖 学习记录</h3>
        <table class="lr-table">
          <tr><td class="lr-label">首次阅读：</td><td>${rec.firstRead}</td></tr>
          <tr><td class="lr-label">最近阅读：</td><td>${rec.lastRead}</td></tr>
          <tr><td class="lr-label">阅读次数：</td><td><strong>${rec.readCount}</strong> 次</td></tr>
          <tr><td class="lr-label">累计阅读：</td><td><strong>${formatDuration(rec.totalSeconds)}</strong></td></tr>
          <tr><td class="lr-label">本次阅读：</td><td><strong>${formatDuration(rec.lastDuration)}</strong></td></tr>
        </table>
      </div>`;
  }

  // ==================== 3. 阅读历史（弹窗内，可展开） ====================

  /**
   * 生成阅读历史 HTML（可折叠展开）
   * @param {string} postId
   * @returns {string}
   */
  function renderReadingHistory(postId) {
    const sessions = getHistory()[postId];
    if (!sessions || sessions.length === 0) return "";

    const rows = sessions
      .slice()
      .reverse()
      .map((s) => `<li><span>${s.date.slice(0, 10)}</span><span>阅读 ${formatDuration(s.duration)}</span></li>`)
      .join("");

    return `
      <div class="lr-card lr-history">
        <button class="lr-history-toggle" id="lrHistoryToggle" data-post-id="${escapeAttr(postId)}">
          查看阅读历史 ▾
        </button>
        <ul class="lr-history-list" id="lrHistoryList" style="display:none;">
          ${rows}
        </ul>
      </div>`;
  }

  // ==================== 4. 掌握程度 ⭐ ====================

  function renderMasteryStars(postId) {
    const level = getMastery()[postId] || 0;
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      stars += `<span class="lr-star ${i <= level ? "active" : ""}" data-star="${i}" data-post-id="${escapeAttr(postId)}">★</span>`;
    }
    return `
      <div class="lr-card">
        <h4>掌握程度</h4>
        <div class="lr-stars">${stars}</div>
      </div>`;
  }

  // ==================== 5. 学习笔记 ====================

  function renderNotes(postId) {
    const notes = getNotes();
    const text = notes[postId] || "";
    return `
      <div class="lr-card">
        <h4>学习笔记</h4>
        <textarea class="lr-notes-input" id="lrNotesInput" data-post-id="${escapeAttr(postId)}"
                  placeholder="记录你的学习心得...">${escapeHtml(text)}</textarea>
        <button class="lr-notes-save" id="lrNotesSave" data-post-id="${escapeAttr(postId)}">保存笔记</button>
        <span class="lr-notes-status" id="lrNotesStatus"></span>
      </div>`;
  }

  // ==================== 6. 复习状态 ====================

  function renderReviewStatus(postId) {
    const status = getReview()[postId] || "none";
    const states = [
      { key: "none",     label: "○ 未学习", cls: "lr-review-none" },
      { key: "learning", label: "🟡 学习中", cls: "lr-review-learning" },
      { key: "mastered", label: "🟢 已掌握", cls: "lr-review-mastered" },
    ];
    const buttons = states.map((s) => {
      const active = status === s.key ? " active" : "";
      return `<button class="lr-review-btn ${s.cls}${active}" data-review="${s.key}" data-post-id="${escapeAttr(postId)}">${s.label}</button>`;
    }).join("");
    return `<div class="lr-card"><h4>复习状态</h4><div class="lr-review-group">${buttons}</div></div>`;
  }

  // ==================== 7. 弹窗综合内容（供 script.js 调用） ====================

  /**
   * 生成弹窗内的全部学习模块 HTML（在文章正文之后）
   * @param {string} postId
   * @returns {string}
   */
  function renderModalContent(postId) {
    return `
      <div class="lr-modal-section">
        ${renderLearningCard(postId)}
        ${renderReadingHistory(postId)}
        ${renderMasteryStars(postId)}
        ${renderReviewStatus(postId)}
        ${renderNotes(postId)}
      </div>`;
  }

  /**
   * 为弹窗内的学习模块绑定事件（由 script.js 在 openModal 后调用）
   * @param {string} postId
   */
  function bindModalEvents(postId) {
    // 历史展开/收起
    const toggle = document.getElementById("lrHistoryToggle");
    const list = document.getElementById("lrHistoryList");
    if (toggle && list) {
      toggle.addEventListener("click", () => {
        const show = list.style.display === "none";
        list.style.display = show ? "block" : "none";
        toggle.textContent = show ? "收起阅读历史 ▴" : "查看阅读历史 ▾";
      });
    }

    // 掌握程度星星点击
    document.querySelectorAll(".lr-star").forEach((star) => {
      star.addEventListener("click", function () {
        const level = parseInt(this.dataset.star);
        const pid = this.dataset.postId;
        const mastery = getMastery();
        // 点击同一颗星则降一级（toggle down）
        const newLevel = (mastery[pid] === level) ? level - 1 : level;
        mastery[pid] = Math.max(0, newLevel);
        setMastery(mastery);
        refreshStars(pid);
      });
    });

    // 复习状态切换
    document.querySelectorAll(".lr-review-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const pid = this.dataset.postId;
        const review = getReview();
        review[pid] = this.dataset.review;
        setReview(review);
        refreshReviewButtons(pid);
      });
    });

    // 笔记保存
    const saveBtn = document.getElementById("lrNotesSave");
    const notesInput = document.getElementById("lrNotesInput");
    const statusEl = document.getElementById("lrNotesStatus");
    if (saveBtn && notesInput) {
      saveBtn.addEventListener("click", () => {
        const pid = saveBtn.dataset.postId;
        const notes = getNotes();
        notes[pid] = notesInput.value.trim();
        setNotes(notes);
        if (statusEl) {
          statusEl.textContent = "✓ 已保存";
          statusEl.className = "lr-notes-status saved";
          setTimeout(() => { statusEl.textContent = ""; }, 2000);
        }
      });
    }
  }

  /** 刷新弹窗内的星星显示 */
  function refreshStars(postId) {
    const level = getMastery()[postId] || 0;
    document.querySelectorAll(".lr-star").forEach((star) => {
      const s = parseInt(star.dataset.star);
      star.classList.toggle("active", s <= level);
    });
  }

  /** 刷新弹窗内的复习状态按钮 */
  function refreshReviewButtons(postId) {
    const status = getReview()[postId] || "none";
    document.querySelectorAll(".lr-review-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.review === status);
    });
  }

  // ==================== 8. 文章卡片状态徽标 ====================

  /**
   * 获取文章卡片状态信息
   * @param {string} postId
   * @returns {{ html: string, cls: string }}
   */
  function getArticleStatus(postId) {
    const rec = getRecords()[postId];
    if (!rec || rec.readCount === 0) {
      return { html: '<span class="card-badge badge-new">🆕 未阅读</span>', cls: "" };
    }
    const ago = daysAgo(rec.lastRead);
    if (rec.readCount >= 5) {
      return { html: `<span class="card-badge badge-done">✓ 已学习 · ${rec.readCount}次</span>`, cls: "card-read" };
    }
    return { html: `<span class="card-badge badge-reading">📖 上次：${ago}</span>`, cls: "card-reading" };
  }

  // ==================== 9. 首页学习统计 ====================

  function renderHomeStats(allPosts) {
    const records = getRecords();
    const totalPosts = allPosts.length;
    let readCount = 0;
    let totalSeconds = 0;
    for (const pid of Object.keys(records)) {
      if (records[pid].readCount > 0) readCount++;
      totalSeconds += records[pid].totalSeconds || 0;
    }
    const unreadCount = totalPosts - readCount;
    const avgSeconds = readCount > 0 ? Math.round(totalSeconds / readCount) : 0;

    return `
      <div class="lr-home-stats" id="lrHomeStats">
        <div class="lr-stat-item"><span class="lr-stat-num">${totalPosts}</span><span class="lr-stat-label">文章总数</span></div>
        <div class="lr-stat-item"><span class="lr-stat-num">${readCount}</span><span class="lr-stat-label">已阅读</span></div>
        <div class="lr-stat-item"><span class="lr-stat-num">${unreadCount}</span><span class="lr-stat-label">未阅读</span></div>
        <div class="lr-stat-item"><span class="lr-stat-num">${formatDuration(totalSeconds)}</span><span class="lr-stat-label">累计学习</span></div>
        <div class="lr-stat-item"><span class="lr-stat-num">${formatDuration(avgSeconds)}</span><span class="lr-stat-label">平均每篇</span></div>
      </div>`;
  }

  // ==================== 10. 继续阅读 ====================

  function renderContinueReading(onOpen) {
    const records = getRecords();
    // 找到 lastRead 最近的文章
    let latestPid = null;
    let latestTime = "";
    for (const [pid, rec] of Object.entries(records)) {
      if (rec.lastRead && rec.lastRead > latestTime) {
        latestTime = rec.lastRead;
        latestPid = pid;
      }
    }
    if (!latestPid) return "";

    return `
      <div class="lr-continue" id="lrContinue">
        <span>📌 继续阅读：</span>
        <a href="#" class="lr-continue-link" data-post-id="${escapeAttr(latestPid)}">点击打开上次阅读的文章</a>
      </div>`;
  }

  // ==================== 11. 学习日历（GitHub 风格热力图） ====================

  function renderCalendar() {
    const daily = getDaily();
    const DAYS = 84;
    // 严格以今天为终点（抹去时分秒，杜绝时区偏移算到明天）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 构建每日数据：从 DAYS-1 天前逐日递增，最后一格恰好是今天
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
      const dayData = daily[key];
      const minutes = dayData ? Math.round(dayData.totalSeconds / 60) : 0;
      let level = 0;
      if (minutes > 0 && minutes <= 30) level = 1;
      else if (minutes > 30 && minutes <= 60) level = 2;
      else if (minutes > 60 && minutes <= 120) level = 3;
      else if (minutes > 120) level = 4;

      const titleParts = [key];
      if (dayData) {
        titleParts.push("学习：" + dayData.postIds.length + "篇");
        titleParts.push("共：" + formatDuration(dayData.totalSeconds));
      } else {
        titleParts.push("无学习记录");
      }
      days.push({ month: d.getMonth(), level: level, title: titleParts.join("\n") });
    }

    // 对齐到周日：第一个日期是周几就在前面补几个空白格
    const firstDate = new Date(today);
    firstDate.setDate(firstDate.getDate() - (DAYS - 1));
    const startDow = firstDate.getDay(); // 0=Sun

    const cells = [];
    for (let i = 0; i < startDow; i++) {
      cells.push('<span class="lr-cal-cell lr-cal-empty"></span>');
    }
    days.forEach(function (d) {
      cells.push('<span class="lr-cal-cell lr-cal-lv' + d.level + '" title="' + d.title + '"></span>');
    });

    // 生成月份标签（按天数比例定位，避免同列重叠）
    var monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    var lastMonth = -1;
    var monthLabels = "";
    for (var i = 0; i < days.length; i++) {
      var m = days[i].month;
      if (m !== lastMonth) {
        var pct = Math.round((i / (DAYS - 1)) * 100);
        if (pct < 0) pct = 0;
        if (pct > 92) pct = 92;
        monthLabels += '<span class="lr-cal-month" style="left:' + pct + '%">' + monthNames[m] + '</span>';
        lastMonth = m;
      }
    }

    // 按周（7 列）排列
    var rows = "";
    for (var r = 0; r < cells.length; r += 7) {
      var weekCells = cells.slice(r, r + 7);
      // 补齐最后一周
      while (weekCells.length < 7) {
        weekCells.push('<span class="lr-cal-cell lr-cal-empty"></span>');
      }
      rows += '<div class="lr-cal-week">' + weekCells.join("") + "</div>";
    }

    return '<div class="lr-card lr-calendar-card">' +
      "<h4>📅 学习日历</h4>" +
      '<div class="lr-cal-months">' + monthLabels + "</div>" +
      '<div class="lr-cal-grid">' + rows + "</div>" +
      '<div class="lr-cal-legend">' +
        "<span>少</span>" +
        '<span class="lr-cal-cell lr-cal-lv0"></span>' +
        '<span class="lr-cal-cell lr-cal-lv1"></span>' +
        '<span class="lr-cal-cell lr-cal-lv2"></span>' +
        '<span class="lr-cal-cell lr-cal-lv3"></span>' +
        '<span class="lr-cal-cell lr-cal-lv4"></span>' +
        "<span>多</span>" +
      "</div>" +
    "</div>";
  }

  // ==================== 12. 学习排行榜 ====================

  function renderLeaderboard(allPosts) {
    const records = getRecords();
    // 构建 id → title 映射
    const titleMap = {};
    allPosts.forEach((p) => {
      titleMap[p.id ?? encodeURIComponent(p.title)] = p.title;
    });

    const entries = Object.entries(records)
      .filter(([, rec]) => rec.readCount > 0)
      .sort((a, b) => b[1].readCount - a[1].readCount)
      .slice(0, 10);

    if (entries.length === 0) return "";

    const medals = ["🥇", "🥈", "🥉"];
    const rows = entries.map(([pid, rec], i) => {
      const prefix = i < 3 ? medals[i] : (i + 1);
      const title = titleMap[pid] || pid;
      return `<li><span class="lr-rank-num">${prefix}</span> ${escapeHtml(title)} <span class="lr-rank-count">${rec.readCount}次</span></li>`;
    }).join("");

    return `
      <div class="lr-card lr-leaderboard-card">
        <h4>🏆 学习排行榜</h4>
        <ol class="lr-leaderboard">${rows}</ol>
      </div>`;
  }

  // ==================== 13. 侧边栏 - 最近学习 ====================

  function renderRecentLearning(allPosts) {
    const records = getRecords();
    const titleMap = {};
    allPosts.forEach((p) => {
      titleMap[p.id ?? encodeURIComponent(p.title)] = p.title;
    });

    const recent = Object.entries(records)
      .filter(([, rec]) => rec.lastRead)
      .sort((a, b) => b[1].lastRead.localeCompare(a[1].lastRead))
      .slice(0, 5);

    if (recent.length === 0) return "";

    const items = recent.map(([pid, rec]) => {
      const title = titleMap[pid] || pid;
      const ago = daysAgo(rec.lastRead);
      return `<li><a href="#" class="lr-recent-link" data-post-id="${escapeAttr(pid)}">${escapeHtml(title)}<span class="lr-recent-ago">${ago}</span></a></li>`;
    }).join("");

    return `
      <div class="sidebar-card lr-sidebar-card" id="lrRecentLearning">
        <h4>📚 最近学习</h4>
        <ul class="lr-recent-list">${items}</ul>
      </div>`;
  }

  // ==================== 14. 今日学习 ====================

  function renderTodayLearning() {
    const daily = getDaily();
    const today = todayStr();
    const dayData = daily[today];
    if (!dayData) return "";

    return `
      <div class="sidebar-card lr-sidebar-card" id="lrTodayLearning">
        <h4>📅 今日学习</h4>
        <p><strong>${dayData.postIds.length}</strong> 篇</p>
        <p>总时长 <strong>${formatDuration(dayData.totalSeconds)}</strong></p>
      </div>`;
  }

  // ==================== 15. 导出 / 导入 ====================

  function exportAll() {
    return {
      version: 1,
      exportedAt: formatTime(Date.now()),
      records: getRecords(),
      history: getHistory(),
      notes: getNotes(),
      mastery: getMastery(),
      review: getReview(),
      daily: getDaily(),
    };
  }

  function importAll(json) {
    try {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      if (!data || typeof data !== "object") throw new Error("格式错误");
      if (data.records)  setRecords(data.records);
      if (data.history)  setHistory(data.history);
      if (data.notes)    setNotes(data.notes);
      if (data.mastery)  setMastery(data.mastery);
      if (data.review)   setReview(data.review);
      if (data.daily)    setDaily(data.daily);
      return true;
    } catch (e) {
      console.error("[LearningTracker] 导入失败:", e);
      return false;
    }
  }

  function renderExportImport() {
    return `
      <div class="lr-export-import" id="lrExportImport">
        <button class="lr-btn-export" id="lrBtnExport">📥 导出学习记录 (JSON)</button>
        <button class="lr-btn-import" id="lrBtnImport">📤 导入学习记录</button>
        <input type="file" id="lrImportFile" accept=".json" style="display:none;">
      </div>`;
  }

  /**
   * 刷新所有首页学习相关 UI（学习统计、继续阅读、日历、排行榜）
   * @param {Array} allPosts - 全部文章数据
   * @param {Function} onOpen - 打开文章的回调
   */
  function refreshHomeUI(allPosts, onOpen) {
    // 学习统计
    const statsContainer = document.getElementById("lrHomeStatsContainer");
    if (statsContainer) {
      statsContainer.innerHTML = renderHomeStats(allPosts);
    }

    // 继续阅读
    const continueContainer = document.getElementById("lrContinueContainer");
    if (continueContainer) {
      continueContainer.innerHTML = renderContinueReading(onOpen);
      // 绑定点击事件
      const link = continueContainer.querySelector(".lr-continue-link");
      if (link && onOpen) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          onOpen(this.dataset.postId);
        });
      }
    }

    // 学习日历
    const calContainer = document.getElementById("lrCalendarContainer");
    if (calContainer) {
      calContainer.innerHTML = renderCalendar();
    }

    // 排行榜
    const lbContainer = document.getElementById("lrLeaderboardContainer");
    if (lbContainer) {
      lbContainer.innerHTML = renderLeaderboard(allPosts);
    }
  }

  /**
   * 刷新侧边栏学习 UI
   * @param {Array} allPosts
   * @param {Function} onOpen
   */
  function refreshSidebarUI(allPosts, onOpen) {
    const sidebar = document.getElementById("lrSidebarContainer");
    if (!sidebar) return;
    sidebar.innerHTML = renderTodayLearning() + renderRecentLearning(allPosts);

    // 绑定点击
    sidebar.querySelectorAll(".lr-recent-link").forEach((link) => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (onOpen) onOpen(this.dataset.postId);
      });
    });
  }

  /**
   * 刷新文章卡片状态（在关闭文章后调用）
   * @param {string} postId
   */
  function refreshCardStatus(postId) {
    const status = getArticleStatus(postId);
    // 更新对应卡片的徽标
    const cards = document.querySelectorAll(".article-card");
    cards.forEach((card) => {
      const link = card.querySelector(".post-title-link");
      const readBtn = card.querySelector(".read-more");
      const cardPid = (link || readBtn)?.dataset.postId;
      if (cardPid === postId) {
        // 移除旧徽标
        const old = card.querySelector(".card-badge");
        if (old) old.remove();
        // 插入新徽标（在标题后）
        const h2 = card.querySelector("h2");
        if (h2 && status.html) {
          h2.insertAdjacentHTML("afterend", status.html);
        }
        // 更新卡片样式
        card.classList.remove("card-read", "card-reading");
        if (status.cls) card.classList.add(status.cls);
      }
    });
  }

  // ==================== 公开 API ====================

  return {
    // 初始化（注册回调）
    init: function (callbacks) {
      if (callbacks) {
        onOpenCallback  = callbacks.onOpen  || null;
        onCloseCallback = callbacks.onClose || null;
      }
      // 绑定导出/导入（委托到 body）
      document.addEventListener("click", function (e) {
        const exportBtn = e.target.closest("#lrBtnExport");
        const importBtn = e.target.closest("#lrBtnImport");
        if (exportBtn) {
          const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "learning-data.json";
          a.click();
          URL.revokeObjectURL(url);
        }
        if (importBtn) {
          document.getElementById("lrImportFile").click();
        }
      });

      // 文件导入
      document.addEventListener("change", function (e) {
        if (e.target.id !== "lrImportFile") return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          const ok = importAll(reader.result);
          if (ok) {
            alert("✅ 学习记录导入成功！请刷新页面查看。");
            location.reload();
          } else {
            alert("❌ 导入失败，请检查文件格式。");
          }
        };
        reader.readAsText(file);
      });
    },

    // 阅读计时
    startReading: startReading,
    endReading: endReading,

    // 弹窗内容
    renderModalContent: renderModalContent,
    bindModalEvents: bindModalEvents,

    // 文章卡片状态
    getArticleStatus: getArticleStatus,

    // 刷新 UI
    refreshHomeUI: refreshHomeUI,
    refreshSidebarUI: refreshSidebarUI,
    refreshCardStatus: refreshCardStatus,

    // 导出/导入 UI
    renderExportImport: renderExportImport,

    // 数据访问（供外部使用）
    getRecords: getRecords,
    exportAll: exportAll,
    importAll: importAll,
  };

  // ==================== 私有辅助 ====================
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return "";
    return str.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
  }
})();

/**
 * =============================================================
 * GIS x 408 x 数学学习笔记 — 前端交互脚本
 * 技术栈：原生 JavaScript ES6 + marked.js + highlight.js
 * 依赖：learning.js（学习追踪模块，须先于本脚本加载）
 *
 * 路由：轻量级 Hash Router
 *   - #/post/<id>  → 文章阅读界面（隐藏首页布局）
 *   - 无 hash       → 首页文章列表
 *   支持浏览器前进/后退 + 直链分享
 * =============================================================
 */

(function () {
  "use strict";

  // ===================== 全局状态 =====================
  let allPosts = [];             // 全部文章数据
  let filteredPosts = [];       // 当前筛选后的文章
  let displayedCount = 0;       // 已展示数量
  const PAGE_SIZE = 6;          // 每页篇数

  let currentOpenPostId = null; // 当前打开的文章 ID（用于学习追踪）

  let currentFilter = {
    type: "all",                // "all" | "category" | "tag" | "search"
    value: null
  };

  // 路由守卫：防止 handleRouting 递归调用
  let routingInProgress = false;

  // ===================== DOM 引用 =====================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    articleList:      $("#articleList"),
    loadMore:         $("#loadMore"),
    noResults:        $("#noResults"),
    filterIndicator:  $("#filterIndicator"),
    quickFilters:     $("#quickFilters"),
    searchDesktop:    $("#searchInputDesktop"),
    searchMobile:     $("#searchInputMobile"),
    modalOverlay:     $("#modalOverlay"),
    modalContent:     $("#modalContent"),
    modalClose:       $("#modalClose"),
    hamburger:        $("#hamburger"),
    navMenu:          $("#navMenu"),
    totalCount:       $("#totalCount"),
    categoryList:     $("#categoryList"),
    tagCloud:         $("#tagCloud"),
    recentPosts:      $("#recentPosts")
  };

  // ===================== 初始化 =====================
  async function init() {
    try {
      const resp = await fetch("posts.json");
      if (!resp.ok) throw new Error("posts.json 加载失败");
      allPosts = await resp.json();

      // 按日期降序排列
      allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

      // 初始化 LearningTracker（注册回调）
      LearningTracker.init({
        onClose: function () {
          // 关闭文章后刷新学习 UI
          refreshAllLearningUI();
        }
      });

      buildSidebar();
      resetAndRender();
      bindEvents();
      refreshAllLearningUI();

      // 渲染导出/导入按钮
      const eiContainer = document.getElementById("lrExportImport");
      if (eiContainer) {
        eiContainer.innerHTML = LearningTracker.renderExportImport();
      }

      // 【核心】注册路由监听
      window.addEventListener("hashchange", handleRouting);
      handleRouting(); // 初始触发，支持带 hash 的直链访问
    } catch (err) {
      dom.articleList.innerHTML =
        '<div class="no-results">加载文章数据失败，请确认已运行 generate.js 生成 posts.json</div>';
      console.error("初始化失败:", err);
    }
  }

  // ===================== Hash 路由 =====================

  /**
   * 核心路由分发：根据 URL hash 决定展示哪个界面
   *   #/post/<id> → 阅读界面
   *   其它 / 空    → 首页列表
   */
  function handleRouting() {
    if (routingInProgress) return;
    routingInProgress = true;

    const hash = window.location.hash;
    if (hash.startsWith("#/post/")) {
      const id = hash.replace("#/post/", "");
      const post = findPostById(id);
      if (post) {
        openModal(post);
      } else {
        // 找不到文章则回首页
        window.location.hash = "";
      }
    } else {
      closeModal();
    }

    routingInProgress = false;
  }

  /** 刷新所有学习追踪相关 UI */
  function refreshAllLearningUI() {
    // 首页 widgets
    LearningTracker.refreshHomeUI(allPosts, function (postId) {
      window.location.hash = "#/post/" + postId;
    });

    // 侧边栏 widgets
    LearningTracker.refreshSidebarUI(allPosts, function (postId) {
      window.location.hash = "#/post/" + postId;
    });
  }

  // ===================== 构建侧边栏 =====================
  function buildSidebar() {
    buildStats();
    buildCategories();
    buildTagCloud();
    buildRecentPosts();
  }

  // 文章总数
  function buildStats() {
    dom.totalCount.textContent = "共 " + allPosts.length + " 篇文章";
  }

  // ===================== 树状文件目录（折叠展开） =====================
  function buildCategories() {
    const categoryListEl = document.getElementById("categoryList");
    if (!categoryListEl) return;

    // 按分类分组
    const categoryGroups = {};
    allPosts.forEach(function (post) {
      var cat = post.category || "未分类";
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(post);
    });

    // 生成树状 HTML
    var html = "";
    Object.keys(categoryGroups).forEach(function (cat) {
      var postsInCat = categoryGroups[cat];
      html += '<li class="tree-category-item">';
      html += '<div class="tree-category-header">';
      html += '<span class="tree-arrow">▶</span>';
      html += '<span class="tree-folder">📂</span>';
      html += '<span class="tree-category-name">' + escapeHtml(cat) + '</span>';
      html += '<span class="tree-count">(' + postsInCat.length + ')</span>';
      html += '</div>';
      html += '<ul class="tree-article-list">';
      postsInCat.forEach(function (post) {
        var postId = post.id || encodeURIComponent(post.title);
        html += '<li class="tree-article-item">';
        html += '<span class="tree-file-icon">📄</span>';
        html += '<a href="#/post/' + postId + '" class="tree-article-link" title="' + escapeAttr(post.title) + '">' + escapeHtml(post.title) + '</a>';
        html += '</li>';
      });
      html += '</ul>';
      html += '</li>';
    });

    categoryListEl.innerHTML = html;
  }

  // 标签云（出现次数前20）
  function buildTagCloud() {
    const tagMap = {};
    allPosts.forEach((p) => {
      (Array.isArray(p.tags) ? p.tags : []).forEach((t) => {
        tagMap[t] = (tagMap[t] || 0) + 1;
      });
    });

    const sorted = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    dom.tagCloud.innerHTML = sorted
      .map(
        ([tag, count]) =>
          `<span class="tag" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)} (${count})</span>`
      )
      .join("");
  }

  // 最近5篇
  function buildRecentPosts() {
    const recent = allPosts.slice(0, 5);
    dom.recentPosts.innerHTML = recent
      .map(
        (p) =>
          `<li><a href="#" data-post-id="${p.id ?? escapeAttr(p.title)}" class="recent-link">${escapeHtml(p.title)}</a></li>`
      )
      .join("");
  }

  // ===================== 筛选 & 渲染 =====================
  function resetAndRender() {
    displayedCount = 0;
    applyFilters();
    renderArticles(true);
  }

  // 根据 currentFilter 设置 filteredPosts
  function applyFilters() {
    const { type, value } = currentFilter;

    if (type === "all" || !value) {
      filteredPosts = [...allPosts];
    } else if (type === "category") {
      filteredPosts = allPosts.filter((p) => p.category === value);
    } else if (type === "tag") {
      filteredPosts = allPosts.filter((p) => (Array.isArray(p.tags) ? p.tags : []).includes(value));
    } else if (type === "search") {
      const q = value.toLowerCase();
      filteredPosts = allPosts.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const tagMatch = (Array.isArray(p.tags) ? p.tags : []).some((t) => t.toLowerCase().includes(q));
        const catMatch = (p.category || "").toLowerCase().includes(q);
        return titleMatch || tagMatch || catMatch;
      });
    }

    updateFilterIndicator();
    updateQuickFilterActive();
    updateLoadMore();
  }

  // 筛选提示文字
  function updateFilterIndicator() {
    const { type, value } = currentFilter;
    if (type === "all" || !value) {
      dom.filterIndicator.textContent = "";
    } else if (type === "category") {
      dom.filterIndicator.textContent = "当前筛选分类：" + value + "（共 " + filteredPosts.length + " 篇）";
    } else if (type === "tag") {
      dom.filterIndicator.textContent = "当前筛选标签：" + value + "（共 " + filteredPosts.length + " 篇）";
    } else if (type === "search") {
      dom.filterIndicator.textContent = "搜索 \"" + value + "\" 的结果（共 " + filteredPosts.length + " 篇）";
    }
  }

  // 更新快捷标签的 active 状态
  function updateQuickFilterActive() {
    $$("#quickFilters .filter-tag").forEach((btn) => {
      const f = btn.dataset.filter;
      if (f === "全部" && currentFilter.type === "all") {
        btn.classList.add("active");
      } else if (currentFilter.type === "category" && f === currentFilter.value) {
        btn.classList.add("active");
      } else if (currentFilter.type === "tag" && f === currentFilter.value) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // 加载更多按钮显隐
  function updateLoadMore() {
    if (displayedCount < filteredPosts.length) {
      dom.loadMore.style.display = "block";
    } else {
      dom.loadMore.style.display = "none";
    }
  }

  // 渲染文章列表
  function renderArticles(reset) {
    if (reset) {
      displayedCount = 0;
      dom.articleList.innerHTML = "";
    }

    const slice = filteredPosts.slice(displayedCount, displayedCount + PAGE_SIZE);
    if (slice.length === 0 && reset) {
      dom.noResults.style.display = "block";
      dom.loadMore.style.display = "none";
      return;
    }

    dom.noResults.style.display = "none";

    slice.forEach((post) => {
      const card = createArticleCard(post);
      dom.articleList.appendChild(card);
    });

    displayedCount += slice.length;
    updateLoadMore();
  }

  // 创建单篇文章卡片（集成学习状态）
  function createArticleCard(post) {
    const card = document.createElement("div");
    card.className = "article-card";

    const tagsHtml = (post.tags || [])
      .map((t) => `<span class="tag" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</span>`)
      .join("");

    const postId = post.id ?? encodeURIComponent(post.title);

    // 从 LearningTracker 获取学习状态徽标
    let badgeHtml = "";
    let extraClass = "";
    if (typeof LearningTracker !== "undefined" && LearningTracker.getArticleStatus) {
      const status = LearningTracker.getArticleStatus(postId);
      badgeHtml = status.html;
      extraClass = status.cls;
    }
    card.className = "article-card " + extraClass;

    card.innerHTML = `
      <h2><a href="#" class="post-title-link" data-post-id="${escapeAttr(postId)}">${escapeHtml(post.title)}</a></h2>
      ${badgeHtml}
      <div class="article-meta">
        <span class="date">${escapeHtml(post.date)}</span>
        <span class="category">${escapeHtml(post.category || "未分类")}</span>
      </div>
      <p class="article-summary">${escapeHtml(post.summary || "")}</p>
      <div class="article-tags">${tagsHtml}</div>
      <button class="read-more" data-post-id="${escapeAttr(postId)}">阅读全文</button>
    `;

    return card;
  }

  // ===================== 文章阅读界面 =====================

  /**
   * 打开文章阅读界面（由路由触发）
   * 隐藏首页主布局与页脚，呈现独立阅读视图
   */
  function openModal(post) {
    const postId = post.id ?? encodeURIComponent(post.title);

    // 预处理 Markdown：兼容 Obsidian ![[图片]] 语法 → 标准 <img> 标签
    let mdContent = post.content || "";
    mdContent = mdContent.replace(
      /!\[\[(.*?\.(?:png|jpg|jpeg|gif|webp|svg))\]\]/gi,
      function (match, fileName) {
        return '<img src="assets/' + fileName + '" alt="' + fileName + '" style="max-width:100%; border-radius:6px; margin:10px 0;">';
      }
    );

    // 使用 marked.js 渲染 Markdown
    const html = marked.parse(mdContent);

    // 获取学习模块内容
    let learningHtml = "";
    if (typeof LearningTracker !== "undefined") {
      learningHtml = LearningTracker.renderModalContent(postId) || "";
    }

    // 构建阅读内容
    dom.modalContent.innerHTML = `
      <h1>${escapeHtml(post.title)}</h1>
      <div class="article-meta" style="margin-bottom:20px;">
        <span class="date">${escapeHtml(post.date)}</span>
        <span class="category">${escapeHtml(post.category || "未分类")}</span>
      </div>
      <div class="markdown-body">${html}</div>
      <div class="article-tags" style="margin-top:24px;">
        ${(post.tags || []).map((t) => `<span class="tag" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</span>`).join("")}
      </div>
      ${learningHtml}
    `;

    // 切换导航栏：隐藏首页导航，显示文章专属微型导航栏
    if ($("#navbar")) $("#navbar").style.display = "none";
    const artNavbar = $("#articleNavbar");
    if (artNavbar) {
      artNavbar.style.display = "block";
      const titleEl = $("#navArticleTitle");
      if (titleEl) titleEl.textContent = post.title;
    }

    // 隐藏首页主布局与页脚，实现"跳转"效果
    const mainLayout = $(".main-layout");
    const footer = $(".footer");
    if (mainLayout) mainLayout.style.display = "none";
    if (footer) footer.style.display = "none";

    dom.modalOverlay.classList.add("open");
    window.scrollTo({ top: 0 });

    // 代码高亮
    dom.modalContent.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });

    // LaTeX 公式渲染（MathJax v3，仅解析 .markdown-body 区域）
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([dom.modalContent]).catch((err) => {
        console.error("MathJax 渲染失败:", err);
      });
    }

    // 学习追踪：开始计时
    if (typeof LearningTracker !== "undefined") {
      LearningTracker.startReading(postId);
      LearningTracker.bindModalEvents(postId);
    }

    // 生成当前文章大纲目录 + 渲染右侧全量目录树
    generateArticleTOC();
    renderModalCategories(post.category, postId);

    // 阅读进度条监听
    window.addEventListener("scroll", updateProgressBar);

    currentOpenPostId = postId;
  }

  /**
   * 关闭文章阅读界面（由路由触发）
   * 恢复首页主布局与页脚
   */
  function closeModal() {
    // 学习追踪：结束计时
    if (currentOpenPostId && typeof LearningTracker !== "undefined") {
      LearningTracker.endReading(currentOpenPostId);
    }

    // 恢复原导航栏，隐藏文章微型导航栏，重置字号与主题
    if ($("#navbar")) $("#navbar").style.display = "block";
    const artNavbar = $("#articleNavbar");
    if (artNavbar) artNavbar.style.display = "none";
    window.removeEventListener("scroll", updateProgressBar);

    // 重置字号
    const modalContentEl = document.getElementById("modalContent");
    if (modalContentEl) modalContentEl.style.fontSize = "";
    // 重置主题
    document.body.classList.remove("theme-eye-care", "theme-parchment", "theme-dark");
    const ts = document.getElementById("themeSelect");
    if (ts) ts.value = "default";

    dom.modalOverlay.classList.remove("open");
    dom.modalContent.innerHTML = "";
    currentOpenPostId = null;

    // 恢复首页主布局与页脚
    const mainLayout = $(".main-layout");
    const footer = $(".footer");
    if (mainLayout) mainLayout.style.display = "flex";
    if (footer) footer.style.display = "block";
  }

  /** 更新阅读进度条（线条 + 数字百分比） */
  function updateProgressBar() {
    const progress = document.getElementById("readingProgress");
    const progressText = document.getElementById("progressText");
    if (!progress) return;
    const totalH = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollT = window.scrollY;
    const scrollPercent = totalH > 0 ? Math.round((scrollT / totalH) * 100) : 0;
    progress.style.width = scrollPercent + "%";
    if (progressText) progressText.textContent = scrollPercent + "%";
  }

  // ===================== 根据 ID 查找文章 =====================
  function findPostById(id) {
    return allPosts.find((p) => (p.id ?? encodeURIComponent(p.title)) === id);
  }

  // ===================== 事件绑定 =====================
  function bindEvents() {
    // --- 品牌名点击：返回首页 ---
    const brand = $(".nav-brand");
    if (brand) {
      brand.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = "";
      });
    }

    // --- 文章微型导航栏返回按钮 ---
    const navBackBtn = $("#navBackBtn");
    if (navBackBtn) {
      navBackBtn.addEventListener("click", () => {
        window.location.hash = "";
      });
    }

    // --- 字号调节 ---
    let currentFontSize = 16;
    const modalContentEl = document.getElementById("modalContent");
    document.getElementById("btnFontInc")?.addEventListener("click", () => {
      if (currentFontSize < 24) {
        currentFontSize += 1;
        if (modalContentEl) modalContentEl.style.fontSize = currentFontSize + "px";
      }
    });
    document.getElementById("btnFontDec")?.addEventListener("click", () => {
      if (currentFontSize > 12) {
        currentFontSize -= 1;
        if (modalContentEl) modalContentEl.style.fontSize = currentFontSize + "px";
      }
    });

    // --- 主题切换 ---
    document.getElementById("themeSelect")?.addEventListener("change", (e) => {
      const theme = e.target.value;
      document.body.classList.remove("theme-eye-care", "theme-parchment", "theme-dark");
      if (theme !== "default") {
        document.body.classList.add("theme-" + theme);
      }
    });

    // --- 加载更多 ---
    dom.loadMore.addEventListener("click", () => {
      renderArticles(false);
    });

    // --- 快捷筛选标签 ---
    dom.quickFilters.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-tag");
      if (!btn) return;
      const filter = btn.dataset.filter;
      if (filter === "全部") {
        setFilter("all", null);
      } else {
        const asCategory = allPosts.some((p) => p.category === filter);
        if (asCategory) {
          setFilter("category", filter);
        } else {
          setFilter("tag", filter);
        }
      }
    });

    // --- 文章卡片内点击（阅读全文 / 标题 / 标签） ---
    dom.articleList.addEventListener("click", (e) => {
      // 阅读全文按钮或标题 → hash 路由跳转
      const readBtn = e.target.closest(".read-more");
      const titleLink = e.target.closest(".post-title-link");
      if (readBtn || titleLink) {
        e.preventDefault();
        const id = (readBtn || titleLink).dataset.postId;
        window.location.hash = "#/post/" + id;
        return;
      }
      // 标签 → 筛选
      const tagEl = e.target.closest(".tag");
      if (tagEl) {
        e.preventDefault();
        const tag = tagEl.dataset.tag;
        setFilter("tag", tag);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    // --- 继续阅读链接（委托到 content 区域） ---
    dom.articleList.parentElement.addEventListener("click", (e) => {
      const link = e.target.closest(".lr-continue-link");
      if (!link) return;
      e.preventDefault();
      window.location.hash = "#/post/" + link.dataset.postId;
    });

    // --- 弹窗关闭（返回按钮 / 遮罩点击 / ESC → 清空 hash） ---
    dom.modalClose.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "";
    });
    dom.modalOverlay.addEventListener("click", (e) => {
      if (e.target === dom.modalOverlay) {
        window.location.hash = "";
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dom.modalOverlay.classList.contains("open")) {
        window.location.hash = "";
      }
    });

    // 弹窗内标签点击 → 清空 hash 回到列表并筛选
    dom.modalContent.addEventListener("click", (e) => {
      const tagEl = e.target.closest(".tag");
      if (tagEl) {
        const tag = tagEl.dataset.tag;
        setFilter("tag", tag);
        window.location.hash = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    // --- 搜索（桌面 & 移动） ---
    let searchTimer;
    const handleSearch = (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const val = e.target.value.trim();
        if (val) {
          setFilter("search", val);
        } else {
          setFilter("all", null);
        }
      }, 300);
    };
    dom.searchDesktop.addEventListener("input", handleSearch);
    dom.searchMobile.addEventListener("input", handleSearch);

    // --- 侧边栏分类树：点击标题展开/收起 ---
    dom.categoryList.addEventListener("click", (e) => {
      // 点击文章链接 → hash 路由跳转，不拦截
      const articleLink = e.target.closest(".tree-article-link");
      if (articleLink) return;

      // 点击分类标题 → 展开/收起
      const header = e.target.closest(".tree-category-header");
      if (header) {
        header.parentElement.classList.toggle("open");
      }
    });

    // --- 侧边栏标签云 ---
    dom.tagCloud.addEventListener("click", (e) => {
      const tagEl = e.target.closest(".tag");
      if (!tagEl) return;
      const tag = tagEl.dataset.tag;
      setFilter("tag", tag);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // --- 侧边栏最近文章 → hash 路由跳转 ---
    dom.recentPosts.addEventListener("click", (e) => {
      e.preventDefault();
      const link = e.target.closest(".recent-link");
      if (!link) return;
      window.location.hash = "#/post/" + link.dataset.postId;
    });

    // --- 侧边栏学习模块（最近学习） → hash 路由跳转 ---
    document.getElementById("sidebar").addEventListener("click", (e) => {
      const link = e.target.closest(".lr-recent-link");
      if (!link) return;
      e.preventDefault();
      window.location.hash = "#/post/" + link.dataset.postId;
    });

    // --- 导航栏菜单项 ---
    dom.navMenu.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-filter]");
      if (!link) return;
      e.preventDefault();
      const filter = link.dataset.filter;
      setFilter("category", filter);
      window.scrollTo({ top: 0, behavior: "smooth" });
      // 移动端关闭菜单
      dom.navMenu.classList.remove("open");
      dom.hamburger.classList.remove("active");
    });

    // --- 汉堡菜单 ---
    dom.hamburger.addEventListener("click", () => {
      dom.hamburger.classList.toggle("active");
      dom.navMenu.classList.toggle("open");
    });

    // --- 移动端下拉菜单（点击展开，替代 hover） ---
    dom.navMenu.addEventListener("click", (e) => {
      const dropdownToggle = e.target.closest(".has-dropdown > .nav-link");
      if (!dropdownToggle) return;
      if (window.innerWidth > 768) return;
      e.preventDefault();
      const parent = dropdownToggle.parentElement;
      $$(".has-dropdown.open").forEach((item) => {
        if (item !== parent) item.classList.remove("open");
      });
      parent.classList.toggle("open");
    });

    // --- 窗口尺寸变化时重置移动端菜单 ---
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        dom.navMenu.classList.remove("open");
        dom.hamburger.classList.remove("active");
        $$(".has-dropdown.open").forEach((item) => item.classList.remove("open"));
      }
    });
  }

  // ===================== 设置筛选条件 =====================
  function setFilter(type, value) {
    currentFilter.type = type;
    currentFilter.value = value;

    // 清空搜索框（如果筛选不是来自搜索）
    if (type !== "search") {
      dom.searchDesktop.value = "";
      dom.searchMobile.value = "";
    }

    resetAndRender();
  }

  // ===================== 文章内部大纲目录 (TOC) =====================
  function generateArticleTOC() {
    var contentEl = document.getElementById("modalContent");
    var tocSection = document.getElementById("modalTocSection");
    var tocList = document.getElementById("modalTocList");

    if (!contentEl || !tocSection || !tocList) return;

    // 抓取正文中所有 h1, h2, h3 标题
    var headings = contentEl.querySelectorAll("h1, h2, h3");

    if (headings.length === 0) {
      tocSection.style.display = "none";
      tocList.innerHTML = "";
      return;
    }

    tocSection.style.display = "block";

    // 遍历标题，赋予 ID 并生成大纲 HTML
    tocList.innerHTML = Array.from(headings).map(function (heading, index) {
      var headingId = "article-heading-" + index;
      heading.id = headingId;
      var tagName = heading.tagName.toLowerCase();

      return '<li class="toc-item toc-' + tagName + '">' +
        '<a href="#' + headingId + '" class="toc-link" title="' + escapeAttr(heading.textContent) + '">' +
        escapeHtml(heading.textContent) +
        '</a>' +
        '</li>';
    }).join("");

    // 绑定平滑滚动
    tocList.querySelectorAll(".toc-link").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var targetId = this.getAttribute("href").slice(1);
        var targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // ===================== 阅读界面右侧全量目录树 =====================
  // ===================== 阅读界面右侧多级无限嵌套目录树 =====================
  function renderModalCategories(currentCategory, currentPostId) {
    var modalCatListEl = document.getElementById("modalCategoryList");
    if (!modalCatListEl) return;

    // 初始化树根
    var root = { dirs: {}, posts: [] };

    // 把所有文章按 "A/B/C" 斜杠路径拆分组装进树
    allPosts.forEach(function (p) {
      var cat = p.category || "未分类";
      var parts = cat.split("/").map(function (s) { return s.trim(); }).filter(Boolean);
      var current = root;
      parts.forEach(function (part) {
        if (!current.dirs[part]) {
          current.dirs[part] = { dirs: {}, posts: [] };
        }
        current = current.dirs[part];
      });
      current.posts.push(p);
    });

    // 递归渲染
    function renderTree(node) {
      var html = "";
      var dirNames = Object.keys(node.dirs).sort();
      dirNames.forEach(function (dirName) {
        var isOpen = currentCategory && (
          currentCategory === dirName ||
          currentCategory.indexOf(dirName + "/") === 0
        );
        html += '<li class="tree-category-item ' + (isOpen ? "open" : "") + '">' +
          '<div class="tree-category-header" onclick="event.stopPropagation();this.parentElement.classList.toggle(\'open\')">' +
          '<span class="tree-arrow">▶</span>' +
          '<span class="tree-folder">📂</span>' +
          '<span class="tree-category-name">' + escapeHtml(dirName) + '</span>' +
          '</div>' +
          '<ul class="tree-article-list">' +
          renderTree(node.dirs[dirName]) +
          '</ul>' +
          '</li>';
      });
      node.posts.forEach(function (p) {
        var pId = p.id || encodeURIComponent(p.title);
        var activeClass = pId === currentPostId ? "active" : "";
        html += '<li class="tree-article-item ' + activeClass + '">' +
          '<span class="tree-file-icon">📄</span>' +
          '<a href="#/post/' + pId + '" class="tree-article-link" title="' + escapeAttr(p.title) + '">' +
          escapeHtml(p.title) + '</a>' +
          '</li>';
      });
      return html;
    }

    modalCatListEl.innerHTML = renderTree(root);
  }

  // ===================== 工具函数 =====================
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

  // ===================== 启动 =====================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

# GIS × 408 × 数学学习笔记

一个极简、专业、可部署到 GitHub Pages 的静态个人技术博客。

## 技术栈

| 层面 | 技术 |
|------|------|
| 页面结构 | HTML5 |
| 样式 | CSS3（CSS 变量 + Flexbox） |
| 交互 | 原生 JavaScript ES6 |
| Markdown 渲染 | [marked.js](https://marked.js.org/) |
| 代码高亮 | [highlight.js](https://highlightjs.org/) |
| 构建脚本 | Node.js（`generate.js`） |

不使用任何前端框架（Vue / React / Angular / jQuery）。

## 目录结构

```
/
├── index.html          # 主页面（三栏布局）
├── style.css           # 全局样式
├── script.js           # 前端交互逻辑
├── generate.js         # 文章构建脚本
├── posts.json          # 由 generate.js 生成的文章数据
├── README.md           # 本文件
│
├── posts/              # Markdown 文章目录
│   ├── inode.md        # 示例：为什么 inode 不保存文件名？
│   ├── shp.md          # 示例：ArcGIS 数据格式对比
│   ├── ndvi.md         # 示例：GEE 计算 NDVI
│   └── integral.md     # 示例：三角代换积分技巧
│
└── assets/             # 静态资源
    └── avatar.png      # 头像占位图
```

## 功能概览

- **三栏布局**：固定导航 + 文章列表 + 侧边栏
- **导航栏**：支持一级菜单和二级下拉菜单，移动端汉堡菜单
- **文章卡片**：标题、日期、分类、摘要、标签
- **阅读弹窗**：点击"阅读全文"弹出 Modal，使用 marked.js 渲染 Markdown
- **筛选**：快捷标签筛选、分类筛选、标签云筛选、搜索框实时过滤
- **分页**：每次加载 6 篇，点击"加载更多"
- **侧边栏**：个人简介、文章统计、分类统计（带数量）、标签云（前20）、最近更新
- **代码高亮**：highlight.js 自动高亮代码块
- **响应式**：768px 断点，移动端导航折叠、单栏布局
- **ESC / 点击遮罩**关闭弹窗

## 如何新增文章

1. 在 `posts/` 目录下新建 `.md` 文件，文件名建议使用英文。

2. 文章格式：YAML Front Matter + Markdown 正文。

```markdown
---
title: "文章标题"
date: "2026-07-09"
category: "分类名"
tags:
  - 标签1
  - 标签2
---

正文内容（Markdown 格式）……
```

3. 运行构建脚本生成 `posts.json`：

```bash
node generate.js
```

4. 刷新页面即可看到新文章。

## 如何运行

### 方式一：本地直接打开

直接用浏览器打开 `index.html` 即可。CDN 资源（marked.js、highlight.js）会自动加载。

> 注意：部分浏览器可能因跨域限制禁止 `fetch('posts.json')`。推荐使用方式二。

### 方式二：本地服务器

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .

# 然后打开 http://localhost:8080
```

### 方式三：GitHub Pages

1. 将整个项目推送到 GitHub 仓库。
2. 在仓库 Settings → Pages 中选择部署分支（如 `main`）。
3. 访问 `https://<用户名>.github.io/<仓库名>/`。

## 筛选与搜索说明

| 方式 | 说明 |
|------|------|
| 快捷标签 | 页面顶部一行按钮，点击筛选。点击"全部"恢复。 |
| 导航菜单 | 点击任意菜单项按分类筛选。 |
| 侧边栏分类 | 点击分类名筛选，括号内数字为文章数。 |
| 标签云 | 点击任意标签筛选。分类筛选与标签筛选互斥。 |
| 搜索框 | 支持标题、标签、分类的实时搜索，输入后 300ms 防抖。 |

## 未来可扩展功能

- [ ] KaTeX 数学公式渲染（接口已预留）
- [ ] 深色模式切换
- [ ] RSS 订阅源生成
- [ ] 文章目录（TOC）自动生成
- [ ] 评论系统集成（Giscus / utterances）
- [ ] 文章内标签链接跳转
- [ ] 归档页面（按年份/月份分组）
- [ ] 全文 RSS / 搜索索引
- [ ] 图片懒加载
- [ ] PWA 离线支持

## 许可

MIT License

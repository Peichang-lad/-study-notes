/**
 * generate.js
 */

const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "posts");
const OUTPUT_FILE = path.join(__dirname, "posts.json");
const SUMMARY_MAX_LENGTH = 150;

/** 递归扫描目录，收集所有 .md 文件（含相对路径） */
function collectMdFiles(dir, baseDir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectMdFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      // 记录相对路径，用于日志
      const relPath = path.relative(baseDir, fullPath);
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error("posts/ not found");
    process.exit(1);
  }
  const mdFiles = collectMdFiles(POSTS_DIR, POSTS_DIR);
  if (mdFiles.length === 0) {
    fs.writeFileSync(OUTPUT_FILE, "[]", "utf-8");
    console.log("empty posts.json generated");
    return;
  }
  const posts = [];
  let ok = 0, fail = 0;
  for (const { fullPath, relPath } of mdFiles) {
    try {
      let raw = fs.readFileSync(fullPath, "utf-8");
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const parsed = parsePost(raw, path.basename(relPath));
      // 自动用文件夹路径作为分类（如果 front matter 没写 category）
      if (!parsed.category || parsed.category === "uncategorized") {
        const dirName = path.dirname(relPath);
        parsed.category = dirName === "." ? "未分类" : dirName.replace(/\\/g, "/");
      }
      posts.push(parsed);
      ok++;
    } catch (err) {
      console.error(relPath + " - " + err.message);
      fail++;
    }
  }
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2), "utf-8");
  console.log("Generated: " + ok + " posts");
  if (fail > 0) console.log("Failed: " + fail);
}

function parsePost(raw, filename) {
  const re = new RegExp("^---\\s*\\r?\\n([\\s\\S]*?)\\r?\\n---\\s*\\r?\\n([\\s\\S]*)$");
  const m = raw.match(re);
  if (!m) throw new Error("no front matter");
  const fm = parseFrontMatter(m[1]);
  const content = m[2].trim();
  return {
    id: encodeURIComponent(fm.title || filename),
    title: fm.title || "untitled",
    date: fm.date || "1970-01-01",
    category: fm.category || "uncategorized",
    tags: normalizeTags(fm.tags),
    summary: extractSummary(content),
    content: content
  };
}

/** 统一将 tags 规范化为数组（兼容 [a,b] 字符串格式） */
function normalizeTags(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const m = val.match(/^\[(.+)\]$/);
    if (m) return m[1].split(",").map(s => s.trim()).filter(Boolean);
    return [val];
  }
  return [];
}

function parseFrontMatter(raw) {
  const result = {};
  const ls = raw.split(/\r?\n/);
  let ck = null;
  for (const l of ls) {
    if (l.trim() === "") continue;
    const ar = l.match(/^\s{2}-\s+(.*)/);
    if (ar && ck) {
      if (!result[ck]) result[ck] = [];
      result[ck].push(ar[1].trim());
      continue;
    }
    const kv = l.match(/^(\w[\w\s]*?):\s*(.*)/);
    if (kv) {
      ck = kv[1].trim();
      const v = kv[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        result[ck] = v.slice(1, -1);
      } else if (v === "") {
        result[ck] = [];
      } else {
        result[ck] = v;
      }
    }
  }
  return result;
}

function extractSummary(content) {
  const ls = content.split(/\r?\n/);
  let parts = [];
  for (const l of ls) {
    const t = l.trim();
    if (t === "") continue;
    if (t.startsWith("#")) continue;
    if (t.startsWith("|")) continue;
    if (t.startsWith(">")) { parts.push(t.replace(/^>\s*/, "")); continue; }
    // skip code block fences
    if (/^`{3}/.test(t)) continue;
    let c = t;
    c = c.replace(/\*\*(.+?)\*\*/g, "$1");
    c = c.replace(/\*(.+?)\*/g, "$1");
    c = c.replace(new RegExp(`"(.+?)"`, "g"), "$1");
    c = c.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    c = c.replace(/\$\$?[^$]+\$\$?/g, "");
    parts.push(c);
    if (parts.join(" ").length >= SUMMARY_MAX_LENGTH) break;
  }
  let s = parts.join(" ").trim();
  if (s.length > SUMMARY_MAX_LENGTH) {
    s = s.slice(0, SUMMARY_MAX_LENGTH);
    const sp = s.lastIndexOf(" ");
    if (sp > SUMMARY_MAX_LENGTH * 0.7) s = s.slice(0, sp);
    s += "...";
  }
  return s;
}

main();
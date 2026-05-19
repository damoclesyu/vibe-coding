# RSS 智能阅读器（国际局势版）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯静态的 RSS 智能阅读器 Demo，从多个国际新闻源抓取文章，通过 Claude API 生成摘要和可信度评分，在单个 HTML 页面中展示。

**Architecture:** Node.js 脚本负责 RSS 抓取 + AI 处理，输出 `articles.json`。前端为单个 HTML 文件，内嵌 CSS 和 JS，通过 `fetch` 加载 JSON 数据，渲染卡片列表、排序和筛选。

**Tech Stack:** Node.js + rss-parser + Claude API（兼容 OpenAI SDK）+ 原生 HTML/CSS/JS

---

## 文件结构

```
src/rss-reader/
├── scripts/
│   └── fetch.js          # RSS 抓取 + AI 处理脚本
├── public/
│   ├── index.html        # 前端页面（单文件，内嵌 CSS/JS）
│   └── articles.json     # 抓取脚本输出的数据文件
├── package.json          # 项目依赖
├── .env.example          # API Key 配置模板
└── README.md             # 快速启动说明
```

---

### Task 1: 项目初始化

**Files:**
- Create: `src/rss-reader/package.json`
- Create: `src/rss-reader/.env.example`
- Create: `src/rss-reader/public/articles.json` (sample)

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "rss-reader",
  "version": "1.0.0",
  "description": "RSS 智能阅读器 — 国际局势版",
  "scripts": {
    "fetch": "node scripts/fetch.js"
  },
  "dependencies": {
    "rss-parser": "^3.13.0",
    "@anthropic-ai/sdk": "^0.39.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `cd src/rss-reader && npm install`
Expected: `node_modules/` 目录创建，无错误。

- [ ] **Step 3: 创建 .env.example**

```bash
# Claude API Key (从 https://console.anthropic.com 获取)
ANTHROPIC_API_KEY=sk-ant-xxx

# 可选：自定义 API 地址（使用兼容代理时填写）
# ANTHROPIC_BASE_URL=https://api.anthropic.com
```

- [ ] **Step 4: 创建 sample articles.json（用于前端开发时预览）**

```json
[
  {
    "title": "中美经贸高级别磋商将于下周在华盛顿举行",
    "link": "https://example.com/news/1",
    "pubDate": "2026-05-19T08:30:00Z",
    "contentSnippet": "美方表示已做好充分准备，中方强调谈判应在平等互利基础上进行。",
    "sourceName": "路透社",
    "sourceWeight": 95,
    "aiSummary": "美方已做好谈判准备，中方强调平等互利原则。",
    "credibilityScore": 92,
    "credibilityLevel": "high",
    "credibilityReason": "来源权威、有直接引述、多方交叉验证、时间地点明确"
  },
  {
    "title": "加沙地带停火谈判取得初步进展",
    "link": "https://example.com/news/2",
    "pubDate": "2026-05-19T05:15:00Z",
    "contentSnippet": "各方在释放人质问题上达成框架性共识，但具体执行时间表仍有待敲定。",
    "sourceName": "Al Jazeera",
    "sourceWeight": 80,
    "aiSummary": "各方在释放人质问题上达成框架共识，执行时间表待定。",
    "credibilityScore": 71,
    "credibilityLevel": "medium",
    "credibilityReason": "来源较权威、报道内容具体、部分执行细节待确认"
  },
  {
    "title": "网传某国边境发生军事冲突 官方尚未回应",
    "link": "https://example.com/news/3",
    "pubDate": "2026-05-19T10:00:00Z",
    "contentSnippet": "社交媒体流传某国边境发生军事冲突的消息，目前尚无官方确认。",
    "sourceName": "社交媒体转载",
    "sourceWeight": 30,
    "aiSummary": "社交媒体流传边境冲突消息，尚无官方确认。",
    "credibilityScore": 38,
    "credibilityLevel": "low",
    "credibilityReason": "匿名消息源、无官方确认、含情绪化表述、缺乏可验证事实"
  },
  {
    "title": "欧盟宣布新一轮对俄制裁措施 涉及能源领域",
    "link": "https://example.com/news/4",
    "pubDate": "2026-05-18T14:30:00Z",
    "contentSnippet": "欧盟委员会主席宣布新制裁将针对俄罗斯能源出口的关键漏洞。",
    "sourceName": "德国之声",
    "sourceWeight": 80,
    "aiSummary": "欧盟宣布对俄新能源制裁，针对能源出口关键漏洞。",
    "credibilityScore": 88,
    "credibilityLevel": "high",
    "credibilityReason": "多源交叉验证、官方声明明确、事实链条完整、时间线清晰"
  },
  {
    "title": "朝鲜向东部海域发射弹道导弹 韩日谴责",
    "link": "https://example.com/news/5",
    "pubDate": "2026-05-18T08:00:00Z",
    "contentSnippet": "韩国联合参谋本部确认导弹飞行约800公里后落入日本海。",
    "sourceName": "BBC 中文网",
    "sourceWeight": 90,
    "aiSummary": "朝鲜发射弹道导弹落入日本海，韩日军方确认并谴责。",
    "credibilityScore": 85,
    "credibilityLevel": "high",
    "credibilityReason": "多方官方声明、数据具体一致、时间线可追溯"
  },
  {
    "title": "联合国气候变化报告：全球变暖速度超出预期",
    "link": "https://example.com/news/6",
    "pubDate": "2026-05-17T11:00:00Z",
    "contentSnippet": "联合国最新报告指出全球变暖速度超出此前预期。",
    "sourceName": "新华社",
    "sourceWeight": 85,
    "aiSummary": "联合国报告指出全球变暖速度超出预期，呼吁加速减排。",
    "credibilityScore": 90,
    "credibilityLevel": "high",
    "credibilityReason": "联合国官方报告、数据详实、多源可查证"
  }
]
```

- [ ] **Step 5: 提交**

```bash
git add src/rss-reader/package.json src/rss-reader/.env.example src/rss-reader/public/articles.json
git commit -m "feat: 初始化 RSS 阅读器项目结构"
```

---

### Task 2: RSS 抓取脚本

**Files:**
- Create: `src/rss-reader/scripts/fetch.js`

- [ ] **Step 1: 编写抓取脚本（不含 AI 处理）**

```javascript
const Parser = require("rss-parser");
const fs = require("fs");
const path = require("path");

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; RSSReader/1.0)",
  },
});

// 预置 RSS 源
const RSS_SOURCES = [
  { name: "路透社国际", url: "https://feeds.reuters.com/reuters/worldNews", weight: 95 },
  { name: "BBC 中文网", url: "https://feeds.bbci.co.uk/chinese/rss.xml", weight: 90 },
  { name: "新华社国际", url: "https://english.news.cn/rss/world.xml", weight: 85 },
  { name: "德国之声中文", url: "https://rss.dw.com/rss/rss-chi-all", weight: 80 },
  { name: "Al Jazeera 英文", url: "https://www.aljazeera.com/xml/rss/all.xml", weight: 80 },
  { name: "联合早报国际", url: "https://www.zaobao.com/news/world/rss.xml", weight: 75 },
  { name: "法国国际广播中文", url: "https://www.rfi.fr/cn/一般新闻/rss", weight: 75 },
  { name: "美国之音中文", url: "https://www.voachinese.com/api/z$-$i$-$m$-$p", weight: 70 },
];

const MAX_PER_SOURCE = 8;
const OUTPUT_FILE = path.join(__dirname, "..", "public", "articles.json");

function deduplicateByUrl(articles) {
  const seen = new Set();
  return articles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
}

async function fetchAll() {
  const allArticles = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`📡 抓取: ${source.name} (${source.url})`);
      const feed = await parser.parseURL(source.url);
      const items = (feed.items || []).slice(0, MAX_PER_SOURCE);

      for (const item of items) {
        allArticles.push({
          title: item.title?.trim() || "",
          link: item.link?.trim() || "",
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          contentSnippet: (item.contentSnippet || item.content || "").slice(0, 300).trim(),
          sourceName: source.name,
          sourceWeight: source.weight,
          aiSummary: "",
          credibilityScore: 0,
          credibilityLevel: "pending",
          credibilityReason: "",
        });
      }
      console.log(`   ✅ ${items.length} 条`);
    } catch (err) {
      console.error(`   ❌ 失败: ${err.message}`);
    }
  }

  console.log(`\n📊 抓取总计: ${allArticles.length} 条`);
  return allArticles;
}

async function main() {
  const articles = await fetchAll();
  const deduped = deduplicateByUrl(articles);
  console.log(`📊 去重后: ${deduped.length} 条`);

  // 按发布时间降序排列
  deduped.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const output = JSON.stringify(deduped, null, 2);
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
  console.log(`💾 已保存到 ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
```

- [ ] **Step 2: 测试抓取脚本**

Run: `cd src/rss-reader && node scripts/fetch.js`
Expected: 输出抓取日志，生成 `public/articles.json`，包含文章数据（部分源可能失败，属正常）。

- [ ] **Step 3: 提交**

```bash
git add src/rss-reader/scripts/fetch.js
git commit -m "feat: 添加 RSS 抓取脚本（含 URL 去重）"
```

---

### Task 3: AI 处理模块

**Files:**
- Modify: `src/rss-reader/scripts/fetch.js`

- [ ] **Step 1: 在 fetch.js 中添加 AI 处理函数**

在 `fetch.js` 顶部 import 区新增：

```javascript
const Anthropic = require("@anthropic-ai/sdk");
```

在 `MAX_PER_SOURCE` 常量下方新增：

```javascript
const AI_MAX_ARTICLES = 30; // Demo 阶段限制 AI 处理篇数

const AI_SYSTEM_PROMPT = `你是一位国际新闻分析师，擅长快速评估新闻可信度。

请分析以下新闻文章，输出严格的 JSON 格式（不要输出其他内容）：

{
  "summary": "一句话中文摘要，不超过40字，客观冷静的语气",
  "credibilityScore": 85,
  "credibilityLevel": "high",
  "credibilityReason": "简要说明评分依据（50字以内）"
}

评分标准（0-100 分）：
- 90-100：来源权威（路透/BBC/新华社等一线通讯社）、有直接引述、多源交叉验证
- 70-89：来源较权威、内容具体、事实可查证
- 50-69：知名媒体但非一线、报道简短、部分细节不完整
- 30-49：来源不明、缺少署名、情绪化用语较多
- 0-29：明显谣言、完全无来源、煽动性标题

评分时考虑：
1. 来源权威性（权重最高）
2. 信息具体程度（时间/地点/人物/数据）
3. 是否有直接引述或原始出处
4. 用词是否客观中性
5. 能否与其他来源交叉验证`;
```

在 `main()` 函数中，`deduped` 排序之后、写入文件之前，新增：

```javascript
  // AI 处理（限制篇数）
  console.log("\n🤖 开始 AI 处理...");
  const toProcess = deduped.slice(0, AI_MAX_ARTICLES);
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i];
    console.log(`   [${i + 1}/${toProcess.length}] ${article.title.slice(0, 30)}...`);

    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        temperature: 0.3,
        system: AI_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `标题：${article.title}\n来源：${article.sourceName}\n发布时间：${article.pubDate}\n正文摘要：${article.contentSnippet}`,
          },
        ],
      });

      const text = msg.content[0].text;
      // 提取 JSON（处理可能的 markdown 代码块包裹）
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        article.aiSummary = result.summary || "";
        article.credibilityScore = result.credibilityScore || 0;
        article.credibilityLevel = result.credibilityLevel || "pending";
        article.credibilityReason = result.credibilityReason || "";
        console.log(`      ✅ 分数: ${article.credibilityScore}`);
      } else {
        throw new Error("无法解析 AI 返回的 JSON");
      }
    } catch (err) {
      console.error(`      ❌ AI 处理失败: ${err.message}`);
      article.aiSummary = article.contentSnippet.slice(0, 40);
      article.credibilityScore = Math.round(article.sourceWeight * 0.6);
      article.credibilityLevel = article.credibilityScore >= 80 ? "high" : article.credibilityScore >= 60 ? "medium" : "low";
      article.credibilityReason = "AI 处理失败，使用来源权重作为默认评分";
    }

    // 请求间隔 500ms，避免限流
    await new Promise((r) => setTimeout(r, 500));
  }
```

- [ ] **Step 2: 测试 AI 处理（需 API Key）**

Run: `cd src/rss-reader && ANTHROPIC_API_KEY=your-key-here node scripts/fetch.js`
Expected: 抓取后对每篇文章调用 AI，输出评分日志，`articles.json` 中包含 AI 结果。

- [ ] **Step 3: 提交**

```bash
git add src/rss-reader/scripts/fetch.js
git commit -m "feat: 集成 Claude API 进行新闻摘要和可信度评分"
```

---

### Task 4: 前端页面 — HTML 结构 + CSS 样式

**Files:**
- Create: `src/rss-reader/public/index.html`

- [ ] **Step 1: 创建完整的前端页面**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>国际局势 · 智能简报</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
    background: #f5f7fa;
    color: #2c3e50;
    line-height: 1.6;
    min-height: 100vh;
  }

  /* Header */
  .header {
    background: #fff;
    border-bottom: 1px solid #e8eaed;
    padding: 16px 20px;
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .header-title {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
  }
  .header-meta {
    font-size: 12px;
    color: #999;
  }
  .header-update {
    font-size: 11px;
    padding: 4px 14px;
    border-radius: 16px;
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Filter Bar */
  .filter-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .filter-btn {
    font-size: 12px;
    padding: 6px 16px;
    border-radius: 18px;
    border: none;
    cursor: pointer;
    background: #f0f0f0;
    color: #5f6368;
    font-weight: 500;
    transition: all 0.2s;
  }
  .filter-btn:hover { background: #e0e0e0; }
  .filter-btn.active {
    background: #1a73e8;
    color: #fff;
  }
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-left: auto;
    cursor: pointer;
    user-select: none;
    color: #5f6368;
  }
  .toggle-switch {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: #ccc;
    position: relative;
    transition: background 0.2s;
  }
  .toggle-switch.on { background: #1a73e8; }
  .toggle-switch::after {
    content: '';
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: left 0.2s;
  }
  .toggle-switch.on::after { left: 20px; }

  /* Content */
  .content {
    max-width: 800px;
    margin: 0 auto;
    padding: 16px 20px 40px;
  }

  /* Date Separator */
  .date-separator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 0 8px;
  }
  .date-separator:first-child { padding-top: 4px; }
  .date-label {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a2e;
    white-space: nowrap;
  }
  .date-label.past { color: #999; }
  .date-line {
    flex: 1;
    height: 1px;
    background: #e0e0e0;
  }
  .date-count {
    font-size: 11px;
    color: #999;
    white-space: nowrap;
  }

  /* Card */
  .card {
    background: #fff;
    border-radius: 10px;
    padding: 18px;
    margin-bottom: 10px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  .card-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .card-source {
    font-size: 12px;
    color: #5f6368;
  }
  .card-time {
    font-size: 12px;
    color: #999;
    margin-left: auto;
  }

  /* Credibility Badge */
  .badge {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 14px;
    font-weight: 700;
    white-space: nowrap;
  }
  .badge.high { background: #e8f5e9; color: #2e7d32; }
  .badge.medium { background: #fff3e0; color: #e65100; }
  .badge.low { background: #fce4ec; color: #c62828; }
  .badge.pending { background: #f5f5f5; color: #999; }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: #1a73e8;
    text-decoration: none;
    display: block;
    margin-bottom: 8px;
    line-height: 1.4;
  }
  .card-title:hover { text-decoration: underline; }
  .card-summary {
    font-size: 13px;
    color: #5f6368;
    line-height: 1.7;
    background: #f8fafc;
    padding: 10px 14px;
    border-radius: 8px;
    border-left: 3px solid #1a73e8;
    margin-bottom: 8px;
  }
  .card-reason {
    font-size: 11px;
    color: #8b8fa3;
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  .card-reason-icon { flex-shrink: 0; }

  /* States */
  .state-loading, .state-empty, .state-error {
    text-align: center;
    padding: 60px 20px;
    color: #999;
  }
  .state-error { color: #c62828; }

  /* Footer */
  .footer {
    text-align: center;
    padding: 20px;
    font-size: 12px;
    color: #bbb;
    border-top: 1px solid #f0f0f0;
    margin-top: 20px;
  }

  /* Mobile */
  @media (max-width: 600px) {
    .header { padding: 12px 14px; }
    .header-title { font-size: 17px; }
    .content { padding: 10px 14px 30px; }
    .card { padding: 14px; }
    .card-title { font-size: 14px; }
    .filter-bar { gap: 4px; }
    .filter-btn { font-size: 11px; padding: 5px 12px; }
    .filter-toggle { margin-left: 0; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div>
      <div class="header-title">📰 国际局势 · 智能简报</div>
      <div class="header-meta">基于多信源 · <span id="updateTime">加载中...</span></div>
    </div>
    <div class="header-update" id="updateBadge">⏱ 加载中</div>
  </div>
  <div class="filter-bar">
    <button class="filter-btn active" data-sort="credibility" onclick="setSort('credibility')">可信度 ↓</button>
    <button class="filter-btn" data-sort="newest" onclick="setSort('newest')">最新</button>
    <div class="filter-toggle" onclick="toggleHighOnly()">
      <div class="toggle-switch" id="toggleSwitch"></div>
      <span>仅高可信</span>
    </div>
  </div>
</div>

<div class="content" id="content">
  <div class="state-loading">⏳ 正在加载新闻...</div>
</div>

<div class="footer">AI 摘要 &amp; 可信度评分 | 每日更新国际局势</div>

<script>
// --- State ---
let articles = [];
let sortMode = 'credibility';
let highOnly = false;

// --- Load ---
async function loadArticles() {
  try {
    const resp = await fetch('./articles.json');
    if (!resp.ok) throw new Error('加载失败');
    articles = await resp.json();
    document.getElementById('updateTime').textContent =
      new Date().toLocaleString('zh-CN');
    document.getElementById('updateBadge').textContent = '⏱ 已加载';
    render();
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<div class="state-error">❌ 数据加载失败，请确保 articles.json 存在</div>';
  }
}

// --- Filter & Sort ---
function getFilteredArticles() {
  let list = [...articles];
  if (highOnly) {
    list = list.filter(a => a.credibilityScore >= 80);
  }
  if (sortMode === 'credibility') {
    list.sort((a, b) => b.credibilityScore - a.credibilityScore);
  } else {
    list.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  return list;
}

// --- Date Grouping ---
function getDateGroup(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const articleDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (articleDate.getTime() >= today.getTime()) return { label: '📅 今天', past: false };
  if (articleDate.getTime() >= yesterday.getTime()) return { label: '📅 昨天', past: true };
  return {
    label: '📅 ' + d.toLocaleDateString('zh-CN', { month:'long', day:'numeric' }),
    past: true
  };
}

// --- Format ---
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + ' 分钟前';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' 小时前';
  const days = Math.floor(hours / 24);
  return days + ' 天前';
}

function levelLabel(score) {
  if (score >= 80) return '高';
  if (score >= 60) return '中';
  return '低';
}

function levelClass(level) {
  return level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low';
}

// --- Render ---
function render() {
  const list = getFilteredArticles();
  const container = document.getElementById('content');

  if (list.length === 0) {
    container.innerHTML = '<div class="state-empty">📭 没有符合条件的新闻</div>';
    return;
  }

  let html = '';
  let lastGroup = '';
  let groupCount = 0;

  for (const a of list) {
    const group = getDateGroup(a.pubDate);
    const groupKey = group.label;

    if (groupKey !== lastGroup) {
      if (lastGroup !== '') {
        html += `</div>`;
      }
      lastGroup = groupKey;

      // Count articles in this group
      groupCount = list.filter(x => getDateGroup(x.pubDate).label === groupKey).length;
      const countHtml = groupCount + ' 条';

      html += `<div class="date-separator">
        <span class="date-label${group.past ? ' past' : ''}">${groupKey}</span>
        <div class="date-line"></div>
        <span class="date-count">${countHtml}</span>
      </div>`;
    }

    const lvl = levelLabel(a.credibilityScore);
    html += `
    <div class="card">
      <div class="card-meta">
        <span class="badge ${levelClass(a.credibilityLevel)}">${lvl} · ${a.credibilityScore}</span>
        <span class="card-source">${a.sourceName}</span>
        <span class="card-time">${timeAgo(a.pubDate)}</span>
      </div>
      <a class="card-title" href="${a.link}" target="_blank" rel="noopener">${a.title}</a>
      <div class="card-summary">${a.aiSummary || a.contentSnippet.slice(0, 80)}</div>
      <div class="card-reason">
        <span class="card-reason-icon">💡</span>${a.credibilityReason || '暂无评分理由'}
      </div>
    </div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// --- Controls ---
function setSort(mode) {
  sortMode = mode;
  document.querySelectorAll('.filter-btn[data-sort]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === mode);
  });
  render();
}

function toggleHighOnly() {
  highOnly = !highOnly;
  document.getElementById('toggleSwitch').classList.toggle('on', highOnly);
  render();
}

// --- Init ---
loadArticles();
</script>

</body>
</html>
```

- [ ] **Step 2: 使用 sample 数据预览前端**

Run: `cd src/rss-reader/public && npx serve .`
Expected: 打开浏览器 http://localhost:3000，看到新闻卡片列表，可切换排序和筛选。

- [ ] **Step 3: 提交**

```bash
git add src/rss-reader/public/index.html
git commit -m "feat: 添加前端页面（卡片列表、排序、筛选、日期分组）"
```

---

### Task 5: 端到端验证与 README

**Files:**
- Create: `src/rss-reader/README.md`

- [ ] **Step 1: 创建 README.md**

```markdown
# RSS 智能阅读器（国际局势版）

多源国际新闻聚合 + AI 摘要 + 可信度评分。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env，填入 Claude API Key
```

### 3. 运行数据抓取

```bash
npm run fetch
# 或手动指定 API Key:
# ANTHROPIC_API_KEY=sk-ant-xxx npm run fetch
```

脚本会抓取所有 RSS 源 → 去重 → 调用 AI 生成摘要和评分 → 输出 `public/articles.json`。

### 4. 预览前端

```bash
npx serve public
```

浏览器打开 http://localhost:3000

## 项目结构

```
scripts/fetch.js    # RSS 抓取 + AI 处理脚本
public/
  index.html        # 前端页面
  articles.json     # 数据文件（脚本生成）
.env.example        # API Key 模板
```

## 功能

- 8 个预置国际新闻 RSS 源
- AI 一句话摘要 + 可信度评分（0-100）
- 按可信度/时间排序
- 仅显示高可信文章
- 按日期分组
- 响应式设计
```

- [ ] **Step 2: 端到端测试**

Run: `cd src/rss-reader && npm run fetch`
Expected: 脚本执行完成，生成 `public/articles.json`，包含 AI 处理后的文章。

Run: `cd src/rss-reader/public && npx serve .`
Expected: 浏览器打开后：
- 卡片列表正常展示
- 可信度排序/最新排序切换正常
- 仅高可信开关有效
- 日期分组显示正确

- [ ] **Step 3: 提交**

```bash
git add src/rss-reader/README.md
git commit -m "docs: 添加 RSS 阅读器 README 快速启动说明"
```

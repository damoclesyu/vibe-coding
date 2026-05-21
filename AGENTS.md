# AGENTS.md — 项目总结

## 项目概览

**智能简报** — 双语中文 RSS 新闻聚合器，通过 DeepSeek API 对新闻进行 AI 摘要和可信度评分。双选项卡界面（国际局势 / 科技新闻），每日自动更新并部署到 GitHub Pages。

- GitHub Pages: 部署于 `src/rss-reader/public/` 目录
- 自动更新: GitHub Actions 每天 UTC 0:00（北京时间 8:00）触发
- 技术栈: Node.js（后端抓取）+ 纯前端 HTML/CSS/JS（无框架）+ rss-parser + DeepSeek API

---

## 目录结构

```
src/rss-reader/
├── public/                    # GitHub Pages 根目录（静态文件）
│   ├── index.html             # 前端页面（双选项卡、搜索、筛选、自定义源）
│   ├── articles.json          # 国际新闻数据（由 fetch.js 生成）
│   └── tech-articles.json     # 科技新闻数据（由 fetch-tech.js 生成）
├── scripts/
│   ├── fetch-core.js          # 共享核心模块: RSS抓取、去重、合并、AI处理、排序
│   ├── fetch.js               # 国际新闻入口（RSS源列表+AI提示词）
│   └── fetch-tech.js          # 科技新闻入口（RSS源列表+AI提示词）
├── package.json               # npm scripts: fetch / fetch-tech / fetch-all
└── .env                       # DEEPSEEK_API_KEY（不提交）
.github/workflows/
└── auto-fetch.yml             # GitHub Actions: 每天8AM抓取+部署GitHub Pages
```

---

## RSS 源列表

### 国际新闻（6 个源）

| 源 | 权重 | URL |
|----|------|-----|
| 环球网 | 85 | `https://m.huanqiu.com/rss/` |
| 中国新闻网 | 82 | `http://www.chinanews.com/rss/scroll-news.xml` |
| 澎湃新闻 | 82 | `https://plink.anyfeeder.com/thepaper` |
| 联合早报·中港台 | 80 | `https://plink.anyfeeder.com/zaobao/realtime/china` |
| 联合早报·国际 | 80 | `https://plink.anyfeeder.com/zaobao/realtime/world` |
| 央视新闻 | 80 | `https://plink.anyfeeder.com/weixin/cctvnewscenter` |

### 科技新闻（8 个源）

| 源 | 权重 | URL |
|----|------|-----|
| 36氪 | 88 | `https://36kr.com/feed` |
| IT之家 | 85 | `https://www.ithome.com/rss/` |
| 爱范儿 | 82 | `https://www.ifanr.com/feed` |
| 钛媒体 | 82 | `https://www.tmtpost.com/rss` |
| 量子位 | 80 | `https://www.qbitai.com/feed` |
| 少数派 | 78 | `https://sspai.com/feed` |
| InfoQ中文 | 78 | `https://www.infoq.cn/feed` |
| Solidot | 75 | `https://www.solidot.org/index.rss` |

**注意**: 澎湃/联合早报/央视通过 `plink.anyfeeder.com` 代理接入（WebFollow 生态）。多数中国新闻站无原生 RSS 或已失效。RSSHub 所有公共实例在国内被墙。

---

## 核心算法（fetch-core.js）

### 数据流
```
抓取各源 → URL去重 → 主题合并（标题相似度）→ 热门排序（覆盖数→权重→随机）→ 取前15 → AI处理 → 多源加分 → 输出JSON
```

### 日期处理
- 滚动 24 小时窗口（`now - 24h` 到 `now`），不是固定截止时间
- 修复常见中文 RSS 日期格式: 去括号、`CST`/`CDT`→`+0800`
- 前端 `parseDate()` 做同样处理，避免 `new Date("(CST)")` 解析失败

### 同主题合并
- `normalizeTitle()`: 去标点符号、去常见前缀（快讯/最新/独家等）
- `isSimilarTitle()`: 精确匹配 → 包含匹配 → 字符重叠率 > 65%
- 合并后 `allSources` 数组去重，每个额外源 +5 分（`coverageBoost`）

### 排序逻辑
- 主排序: `coverageCount` 降序（多源覆盖越热越靠前）
- 次排序: `sourceWeight` 降序（信源权威性）
- 平局: `Math.random()` 随机打乱（避免每次相同）

### 可信度评分
- AI（DeepSeek）对每篇文章评分 0-100
- 含敏感词跳过 AI 处理，用 `sourceWeight * 0.6` 作为默认分
- AI 处理失败用默认分兜底
- 多源覆盖加分：每额外一个源 +5，封顶 100

### 内容安全
- `hasSensitiveContent()`: 检测标题+正文是否含敏感词列表
- 命中后跳过 AI 处理（避免 DeepSeek "Content Exists Risk" 400 错误）

---

## 关键配置

### 常量
- `MAX_ARTICLES = 15` — 最终输出最多 15 条
- `MAX_PER_SOURCE = 100` — 每源最多检查 100 条（大值确保高活跃源不漏旧文）
- DeepSeek 模型: `deepseek-chat`（可在 `.env` 中通过 `DEEPSEEK_MODEL` 覆盖）
- API 地址: `https://api.deepseek.com/v1/chat/completions`

### 敏感词列表
台独, 西藏独立, 东突厥斯坦, 法轮功, 六四, 天安门事件, 新疆独立, 香港独立, 藏独, 疆独, 港独

---

## 前端功能（index.html）

- **双选项卡**: 国际局势 / 科技新闻，各自加载 articles.json / tech-articles.json
- **排序**: 最新（默认） / 可信度，支持升降序
- **筛选**: 仅高可信开关、搜索框（搜索标题/摘要/来源）
- **侧边栏**: 今日统计（高/中/低可信分布图）、信源列表（可隐藏）、自定义 RSS 源（localStorage）
- **自定义源**: 用户可添加任意 RSS 源，存储在 localStorage
- **徽章颜色**: 统一根据 credibilityScore 计算，`getLevel(score)` 返回 `{label, cls}`（>=80 高/绿, >=60 中/橙, <60 低/红）

### 重要前端细节
- `timeAgo()`、`getDateGroup()` 使用 `parseDate()` 预处理（去括号+时区修复）
- 标题未使用 API 返回的 `credibilityLevel` 字段，统一从 score 计算等级
- 日期分组：今天 / 昨天 / 具体日期

---

## 部署与 CI/CD

- GitHub Actions: `auto-fetch.yml`
  - 触发: cron `0 0 * * *`（每天 UTC 0:00）+ 手动 workflow_dispatch
  - 步骤: checkout → npm install → `npm run fetch-all` → commit 数据 → 部署 GitHub Pages
  - 环境变量: `DEEPSEEK_API_KEY` 通过 GitHub Secrets 注入
  - `[skip ci]` 标签避免提交触发死循环
- 数据文件提交到仓库（articles.json / tech-articles.json），GitHub Pages 静态部署

---

## 已知约束

1. 中国网络环境限制: 多数海外 RSS 源（BBC/FT/WSJ）、RSSHub 公共实例不可用
2. 中文 RSS 生态差: 大量源 404/死链/日期损坏，每个源需人工验证
3. DeepSeek 限流: 500ms 延迟防止 429，偶发 503 有兜底
4. 前端无构建步骤: 纯静态 HTML/CSS/JS，无法使用 npm 包
5. 环球网日期格式: `(Thu,21 May 2026 12:29:40 CST)`，需要去括号+CST→+0800

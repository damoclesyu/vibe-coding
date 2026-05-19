# RSS 智能阅读器（国际局势版）— 设计文档

## 项目概述

构建一个 RSS 智能阅读器，专注于每日国际局势新闻的聚合、清洗与可信度评估。用户每天打开网页，看到来自多个权威国际媒体的最新新闻列表，每条附带 AI 摘要、可信度评分和来源标注。

### 解决的核心问题

- 信息过载，杂七杂八的干扰多
- 难以区分有效信息与谣言/低质内容
- 不同信源立场不明，缺乏交叉验证

---

## UI 设计决策

| 维度 | 选择 |
|------|------|
| 整体风格 | 白色新闻门户风 — 干净清爽，类似 Google News |
| 卡片样式 | 宽松卡片式 — 每条新闻独立卡片，含 AI 摘要、评分理由 |
| 顶部栏 | 简洁顶栏：标题 + 更新时间在一行，筛选栏独立一行 |
| 日期分组 | 日期分隔线自然分隔（今天/昨天/本周），带新闻计数 |
| 可信度标签 | 三色胶囊：绿(≥80 高) / 橙(60-79 中) / 红(<60 低) |
| 默认排序 | 可信度优先（高分在上），可选「最新」「按来源筛选」 |
| 响应式 | 适配桌面端和移动端 |

---

## MVP 功能模块

### 1. 信源管理
- 预置 10-15 个国际局势相关 RSS 源（BBC、路透、新华社、联合早报、德国之声、Al Jazeera 等）
- 支持手动添加/删除 RSS 地址

### 2. 定时抓取与存储
- 每 2 小时抓取所有订阅源的最新文章
- 字段：标题、发布时间、正文/摘要、原文链接
- 去重：同一文章多源转载合并来源列表（算法见下文）
- 存储：本地 SQLite 数据库
- 数据保留：最近 15 天或最多 500 篇文章，超出自动清理

### 3. AI 处理模块
- 对每篇文章调用 Claude API：
  - 生成一句话摘要（≤40 字）
  - 输出可信度评分（0-100）及评级
  - 提供评分理由
- 批量处理新增文章

### 4. 前端展示界面
- 新闻卡片列表，每条含：标题（可点击跳转原文）、来源、时间、AI 摘要、可信度标签、评分理由
- 筛选：按可信度排序、按来源筛选、「仅高可信」开关
- 按日期分组（今天/昨天/本周）

---

## 技术架构

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + Vite |
| 样式 | CSS Modules 或 Tailwind CSS |
| 后端 | Node.js 脚本（抓取 + AI 处理） |
| 数据库 | SQLite（better-sqlite3） |
| RSS 解析 | rss-parser |
| AI 接口 | Claude API |

### 数据流

```
RSS 源 → 定时抓取脚本 → SQLite 存储 → AI 处理（Claude API）→ 更新评分/摘要
                                                              ↓
用户浏览器 ← React 前端 ← 后端 API（读取 SQLite）
```

### 组件树

```
App
├── Header
│   ├── TitleBar（标题 + 更新状态）
│   └── FilterBar（排序/来源/仅高可信）
├── NewsList
│   ├── DateSeparator（日期分隔线 + 计数）
│   └── NewsCard × N
│       ├── CredibilityBadge（可信度标签）
│       ├── SourceLine（来源 + 时间）
│       ├── Headline（可点击标题）
│       ├── AiSummary（AI 摘要）
│       └── ScoreReason（评分理由）
└── Footer
```

---

## API 设计

前端通过 REST API 读取文章数据。

### GET /api/articles

查询已处理的文章列表。

**请求参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sort` | string | `credibility` | 排序方式：`credibility` / `newest` |
| `min_score` | int | 0 | 最低可信度阈值（0-100） |
| `source` | string | 无 | 按来源过滤，多选用逗号分隔 |
| `limit` | int | 50 | 每页条数 |
| `offset` | int | 0 | 分页偏移 |
| `date` | string | 无 | 日期过滤：`today` / `yesterday` / `week` |

**响应格式：**

```json
{
  "total": 128,
  "articles": [
    {
      "id": 1,
      "title": "中美经贸高级别磋商将于下周在华盛顿举行",
      "link": "https://reuters.com/...",
      "sources": ["路透社", "BBC", "联合早报"],
      "published_at": "2026-05-19T08:30:00Z",
      "ai_summary": "美方准备好谈判，中方强调平等互利原则。",
      "credibility_score": 92,
      "credibility_level": "high",
      "score_reason": "来源权威、有直接引述、多方交叉验证、时间地点明确",
      "created_at": "2026-05-19T10:00:00Z"
    }
  ]
}
```

### GET /api/sources

返回当前订阅源列表及健康状态。

```json
{
  "sources": [
    { "name": "路透社", "url": "https://...", "status": "ok", "last_fetch": "..." },
    { "name": "BBC", "url": "https://...", "status": "error", "last_fetch": "..." }
  ]
}
```

### GET /api/stats

返回数据概览。

```json
{
  "total_articles": 128,
  "today_count": 23,
  "high_credibility_ratio": 0.45,
  "last_update": "2026-05-19T10:00:00Z"
}
```

---

## 去重算法

两层去重策略，按优先级执行：

**第一层 — URL 精确匹配（优先）：**
- 同一 URL 的文章视为完全重复，只保留首次抓取到的记录
- 后续抓取到相同 URL 时，将新来源追加到 `sources` 字段

**第二层 — 标题相似度匹配（兜底）：**
- 不同 URL 但标题 Jaccard 相似度 > 0.8 的文章视为转载同一事件
- Jaccard 相似度 = |A ∩ B| / |A ∪ B|，对标题做分词后计算
- 匹配后合并来源，保留发布时间最早的记录

---

## AI 提示词模板

对每篇文章调用 Claude API 时的系统提示词：

```
你是一位国际新闻分析师，擅长快速评估新闻可信度。

请分析以下新闻文章，输出严格的 JSON 格式（不要输出其他内容）：

{
  "summary": "一句话中文摘要，不超过40字，客观冷静的语气",
  "credibility_score": 85,
  "credibility_level": "high",
  "score_reason": "简要说明评分依据（50字以内）"
}

评分标准（0-100 分）：
- 90-100 (高)：来源权威（路透/BBC/新华社等一线通讯社）、有直接引述、时间地点明确、多源交叉验证
- 70-89 (高)：来源较权威、内容具体、事实可查证
- 50-69 (中)：知名媒体但非一线、报道相对简短、部分细节不完整
- 30-49 (低)：来源不明、缺少署名、情绪化用语较多
- 0-29 (低)：明显谣言、完全无来源、煽动性标题

评分时请同时考虑：
1. 来源权威性（权重最高）
2. 信息具体程度（时间/地点/人物/数据）
3. 是否有直接引述或原始出处
4. 用词是否客观中性
5. 能否与其他来源交叉验证
```

**调用示例（用户消息）：**
```
标题：{{article_title}}
来源：{{article_source}}
发布时间：{{article_pubdate}}
正文摘要：{{article_summary}}
```

**API 参数：**
- model: claude-sonnet-4-6（性价比高，摘要任务足够）
- max_tokens: 300
- temperature: 0.3（低温度保证评分稳定性）
- response_format: 使用 JSON mode 或 tool_use 强制 JSON 输出

---

## 部署方案

### 方案：本地优先 + 静态前端

考虑到 MVP 阶段的简单性和零成本，采用以下方案：

**抓取脚本运行环境：**
- Node.js 脚本（`scripts/fetch-and-score.js`），执行：抓取 RSS → 去重 → 调 Claude API → 写入 SQLite
- 本地手动运行或通过系统定时任务（Windows 任务计划器 / cron）每 2 小时触发
- 后续升级方案：GitHub Actions 定时运行 + 将 SQLite 作为 artifact 上传

**数据库与文件：**
- SQLite 数据库文件存储在项目根目录 `data/articles.db`
- 数据库文件随前端一起部署（静态 JSON 作为降级方案：`public/data/articles.json`）

**前端部署：**
- Vite build 输出纯静态文件到 `dist/`
- 部署到 GitHub Pages（免费、零配置、自定义域名支持）
- 前端启动时从 `public/data/articles.json` 读取数据（构建前由抓取脚本生成）

**降级策略：**
- 如果 GitHub Pages 部署不可用，直接 `npx serve dist/` 本地启动
- 如果数据库损坏，前端显示空状态提示而非崩溃

### 后续升级路径

| 阶段 | 方案 |
|------|------|
| MVP（当前） | 本地脚本 + SQLite + 静态 JSON + GitHub Pages |
| V2 | GitHub Actions 定时运行 + SQLite artifact 自动部署 |
| V3 | 迁移到轻量 VPS（Railway / Fly.io）+ 真正的后端 API 服务 |

---

## 错误处理

- RSS 源抓取失败：跳过该源，记录日志，不影响其他源
- AI API 调用失败：文章标记为「待处理」，下次重试
- 数据库不可用：前端显示错误状态提示，不崩溃

## 测试策略

- 组件单元测试：NewsCard、FilterBar、CredibilityBadge
- API 层测试：抓取逻辑、去重逻辑、评分逻辑
- 前端集成测试：列表渲染、筛选交互

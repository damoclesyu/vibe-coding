# 国际局势智能简报 — 简历项目总结

## 一句话概述

> 多源国际新闻聚合平台，集成 Claude AI 进行智能摘要与可信度评分，帮助用户高效获取可靠资讯。

## 项目地址

- 源码：`src/rss-reader/`
- 在线演示：**https://damoclesyu.github.io/vibe-coding/** （GitHub Pages 自动部署，打开即用，无需安装任何东西）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML5 / CSS3 / JavaScript（零框架） |
| 后端脚本 | Node.js + CommonJS |
| AI 能力 | Claude API（Anthropic） |
| 数据获取 | RSS 多源聚合（rss-parser） |
| 持久化 | 浏览器 localStorage |
| 部署 | 静态托管（GitHub Pages / Vercel / Netlify） |

## 核心功能

### 1. 多源 RSS 聚合
- 整合 8 个国内权威新闻源（人民网、新华网、央视网、中国新闻网等）
- 自动抓取、URL 去重、按时间排序
- 支持用户自定义添加 RSS 源，数据持久化到 localStorage

### 2. AI 智能摘要与可信度评分
- 调用 Claude API 为每条新闻生成 30 字以内的中文摘要
- 基于 5 个维度打分（0-100）：来源权威性、信息具体程度、原始出处可追溯性、用词客观性、交叉验证可行性
- AI 处理失败的降级策略：回退到来源权重计算默认分数

### 3. 前端交互
- 按可信度 / 发布时间排序，支持升降序切换
- 一键筛选「仅高可信」（≥80 分）
- 按日期分组（今天 / 昨天 / 更早）
- 整个卡片可点击，直接跳转原文
- 低可信度（<60 分）卡片附带评分理由，帮助用户判断

### 4. 侧边栏数据面板
- 实时统计高/中/低可信文章数量及占比条形图
- 信源列表展示权重
- 自定义源管理（增删）

### 5. 响应式设计
- 桌面端双栏布局（内容 + 侧边栏），移动端自适应单栏
- 纯 CSS 实现，无第三方 UI 库依赖

---

## 简历描述模板

### 适合「项目经历」板块：

**国际局势智能简报** | 独立开发 | 2026.05

- 基于 Node.js 开发 RSS 多源聚合脚本，集成 8 个新闻源，实现自动抓取、URL 去重与数据清洗
- 调用 Claude API 对新闻进行 AI 摘要生成与多维度可信度评分（0-100），含降级容错策略
- 使用原生 HTML/CSS/JS 构建响应式前端，实现排序、筛选、日期分组、全文跳转等交互
- 通过 localStorage 实现自定义 RSS 源管理，支持用户增删自定义信源
- 关注安全性，对用户输入进行 HTML 实体转义，防范 XSS 攻击

### 面试可展开的技术点

| 话题 | 可聊内容 |
|------|----------|
| 为什么用原生 JS | 无框架依赖、深入理解 DOM 操作、体积小加载快 |
| AI 评分的设计 | 5 维度评估标准、Prompt Engineering、AI 失败降级 |
| 安全性考虑 | XSS 防御（escapeHtml + 事件委托）、localStorage 容错 |
| 数据处理 | RSS 多源聚合、URL 去重（Set）、时间排序 |
| 响应式 | Flexbox 双栏布局、sticky 定位、媒体查询断点 |
| 部署方案 | 静态托管 + 定时任务自动更新数据（GitHub Actions） |

## 亮点（面试官视角）

1. **全栈能力** — 从 Node.js 脚本到前端页面，完整的数据处理链路
2. **AI 工程化** — 不只是「调 API」，有 Prompt 设计、评分体系、失败降级
3. **工程细节** — URL 去重、XSS 防御、localStorage 容错、响应式适配
4. **独立思考** — 自己设计评分标准、自己决定 UI 交互、自己选择技术方案
5. **持续迭代** — 从可用到好用，经过多轮改进（git log 可见提交历史）

---

## 面试官如何体验

面试官**无需安装任何软件、无需 API Key、无需克隆仓库**，只需：

1. 打开浏览器
2. 访问 **https://damoclesyu.github.io/vibe-coding/**
3. 即可看到 AI 摘要、可信度评分、排序筛选等全部功能

数据（`articles.json`）已预生成并随代码一起部署，不依赖后端服务。

## 部署方式

通过 GitHub Actions 自动部署到 GitHub Pages：

- `.github/workflows/deploy.yml` — 每次推送 main 分支，自动将 `src/rss-reader/public/` 部署到 GitHub Pages
- 数据更新：手动运行 `npm run fetch` 后推送，或配置定时 GitHub Action 自动抓取

## 本地运行（如需要）

```bash
git clone git@github.com:damoclesyu/vibe-coding.git
cd vibe-coding/src/rss-reader
npm install
npm run fetch   # 需要 ANTHROPIC_API_KEY
npx serve public
```

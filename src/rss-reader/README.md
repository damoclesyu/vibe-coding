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

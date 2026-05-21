const Parser = require("rss-parser");
const fs = require("fs");
const path = require("path");

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; RSSReader/1.0)",
  },
});

// 预置 RSS 源（全部国内直连，无需梯子）
const RSS_SOURCES = [
  { name: "环球网", url: "https://m.huanqiu.com/rss/", weight: 85 },
  { name: "中国新闻网", url: "http://www.chinanews.com/rss/scroll-news.xml", weight: 82 },
  { name: "联合国新闻中文", url: "https://news.un.org/feed/subscribe/zh/news/all/rss.xml", weight: 80 },
];

const MAX_ARTICLES = 15;
const MAX_PER_SOURCE = 30;
const OUTPUT_FILE = path.join(__dirname, "..", "public", "articles.json");

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

// 内容预检：避免触发 DeepSeek 内容安全审查
function hasSensitiveContent(article) {
  const sensitiveWords = [
    "台独", "西藏独立", "东突厥斯坦", "法轮功", "六四", "天安门事件",
    "新疆独立", "香港独立", "藏独", "疆独", "港独",
  ];
  const text = `${article.title} ${article.contentSnippet}`.toLowerCase();
  return sensitiveWords.some((word) => text.includes(word));
}

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

function deduplicateByUrl(articles) {
  const seen = new Set();
  return articles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
}

// --- 标题相似度匹配：用于跨源同主题合并 ---

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^一-龥a-zA-Z0-9]/g, '')   // 仅保留中文/字母/数字
    .replace(/^(快讯|最新|独家|权威|重磅|突发|直播|视频|图)/, '');
}

function isSimilarTitle(t1, t2) {
  const a = normalizeTitle(t1);
  const b = normalizeTitle(t2);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // 字符级重叠度 > 65% 视为相似
  const intersection = [...a].filter(c => b.includes(c)).length;
  return intersection / Math.min(a.length, b.length) > 0.65;
}

function mergeSimilarArticles(articles) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue;
    const group = [articles[i]];
    used.add(i);

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue;
      if (isSimilarTitle(articles[i].title, articles[j].title)) {
        group.push(articles[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups.map(group => {
    group.sort((a, b) => b.sourceWeight - a.sourceWeight);
    const primary = group[0];
    const uniqueSources = [...new Set(group.map(a => a.sourceName))];
    primary.allSources = uniqueSources;
    primary.coverageCount = uniqueSources.length;
    primary.coverageBoost = (uniqueSources.length - 1) * 5;
    return primary;
  });
}

function isWithinWindow(dateStr) {
  if (!dateStr) return false;

  // 修复常见日期格式问题（CST→+0800、括号包裹等）
  let normalized = dateStr
    .replace(/[()]/g, '')
    .replace(/\bCST\b/, '+0800')
    .replace(/\bCDT\b/, '+0800');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return false;

  const now = Date.now();

  // 窗口：昨天 8:00 → 今天 8:00（北京时间）
  const nowDate = new Date();
  const today8am = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 8, 0, 0).getTime();
  const end = now < today8am ? today8am - 24 * 60 * 60 * 1000 : today8am;
  const start = end - 24 * 60 * 60 * 1000;

  return d.getTime() >= start && d.getTime() < end;
}

async function fetchAll() {
  const allArticles = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`📡 抓取: ${source.name} (${source.url})`);
      const feed = await parser.parseURL(source.url);
      const items = (feed.items || [])
        .filter(item => isWithinWindow(item.pubDate || item.isoDate))
        .slice(0, MAX_PER_SOURCE);

      for (const item of items) {
        allArticles.push({
          title: item.title?.trim() || "",
          link: item.link?.trim() || "",
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          contentSnippet: (item.contentSnippet || item.content || "").slice(0, 300).trim(),
          sourceName: source.name,
          sourceWeight: source.weight,
          allSources: [source.name],
          coverageCount: 1,
          coverageBoost: 0,
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

async function aiProcess(article) {
  const sourceStr = article.allSources?.length > 1
    ? article.allSources.join(' + ')
    : article.sourceName;

  const resp = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `标题：${article.title}\n来源：${sourceStr}\n发布时间：${article.pubDate}\n正文摘要：${article.contentSnippet}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    throw new Error(`${resp.status} ${await resp.text().then(t => t.slice(0, 200))}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const result = JSON.parse(jsonMatch[0]);
    article.aiSummary = result.summary || "";
    article.credibilityScore = result.credibilityScore || 0;
    article.credibilityLevel = result.credibilityLevel || "pending";
    article.credibilityReason = result.credibilityReason || "";
  } else {
    throw new Error("无法解析 AI 返回的 JSON");
  }
}

// 为多源覆盖文章增加可信度加成
function applyCoverageBoost(article) {
  if (article.coverageBoost > 0) {
    article.credibilityScore = Math.min(100, article.credibilityScore + article.coverageBoost);
    if (article.credibilityScore >= 80) article.credibilityLevel = "high";
    else if (article.credibilityScore >= 60) article.credibilityLevel = "medium";
    article.credibilityReason += `（多源覆盖 +${article.coverageBoost}）`;
  }
}

async function main() {
  if (!DEEPSEEK_API_KEY) {
    console.error("❌ 请设置 DEEPSEEK_API_KEY 环境变量");
    console.error("   获取 Key: https://platform.deepseek.com/api_keys");
    process.exit(1);
  }

  const articles = await fetchAll();
  let deduped = deduplicateByUrl(articles);
  console.log(`📊 去重后: ${deduped.length} 条`);

  // 跨源同主题合并
  const beforeMerge = deduped.length;
  deduped = mergeSimilarArticles(deduped);
  console.log(`📰 主题合并: ${deduped.length} 条（${beforeMerge - deduped.length} 条因同主题合并）`);

  // 按覆盖源数降序→来源权重降序→同权重随机打乱
  deduped.sort((a, b) => {
    if (a.coverageCount !== b.coverageCount) return b.coverageCount - a.coverageCount;
    if (a.sourceWeight !== b.sourceWeight) return b.sourceWeight - a.sourceWeight;
    return Math.random() - 0.5;
  });

  // 保留最热门的 MAX_ARTICLES 条
  deduped.splice(MAX_ARTICLES);
  console.log(`🔥 热门精选: 取前 ${MAX_ARTICLES} 条`);

  console.log(`\n🤖 开始 AI 处理 (${DEEPSEEK_MODEL})...`);
  const toProcess = deduped;
  let aiProcessed = 0, filteredCount = 0, failedCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i];
    console.log(`   [${i + 1}/${toProcess.length}] ${article.title.slice(0, 30)}...`);

    if (hasSensitiveContent(article)) {
      console.log(`      ⚠️ 跳过（内容预检）`);
      article.aiSummary = article.contentSnippet.slice(0, 40);
      article.credibilityScore = Math.round(article.sourceWeight * 0.6);
      article.credibilityLevel =
        article.credibilityScore >= 80 ? "high" : article.credibilityScore >= 60 ? "medium" : "low";
      article.credibilityReason = "因内容合规限制，使用来源权重作为默认评分";
      filteredCount++;
      continue;
    }

    try {
      await aiProcess(article);
      console.log(`      ✅ 分数: ${article.credibilityScore}`);
      aiProcessed++;
    } catch (err) {
      console.error(`      ❌ AI 处理失败: ${err.message}`);
      article.aiSummary = article.contentSnippet.slice(0, 40);
      article.credibilityScore = Math.round(article.sourceWeight * 0.6);
      article.credibilityLevel =
        article.credibilityScore >= 80 ? "high" : article.credibilityScore >= 60 ? "medium" : "low";
      article.credibilityReason = "AI 处理失败，使用来源权重作为默认评分";
      failedCount++;
    }

    // 请求间隔 500ms，避免限流
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n📊 最终统计: 总计 ${deduped.length} 条 | AI 处理 ${aiProcessed} | 内容过滤 ${filteredCount} | API 失败 ${failedCount}`);

  // 多源覆盖可信度加成
  for (const article of toProcess) {
    applyCoverageBoost(article);
  }

  const output = JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalSources: RSS_SOURCES.length,
    totalArticles: deduped.length,
    articles: deduped,
  }, null, 2);
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
  console.log(`💾 已保存到 ${OUTPUT_FILE}（${deduped.length} 条）`);
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});

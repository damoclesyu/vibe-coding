const Parser = require("rss-parser");
const fs = require("fs");
const path = require("path");

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; RSSReader/1.0)" },
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const MAX_ARTICLES = 15;
const MAX_PER_SOURCE = 100;

const SENSITIVE_WORDS = [
  "台独", "西藏独立", "东突厥斯坦", "法轮功", "六四", "天安门事件",
  "新疆独立", "香港独立", "藏独", "疆独", "港独",
];

function hasSensitiveContent(article) {
  const text = `${article.title} ${article.contentSnippet}`.toLowerCase();
  return SENSITIVE_WORDS.some((word) => text.includes(word));
}

function isChinaRelated(article) {
  const text = `${article.title} ${article.contentSnippet}`;
  return /(?:习近平|李强|国务院|外交部|国防部|全国人大|中共中央|中央军委|国家主席|总理|委员长|中宣部|中纪委|最高人民法院|最高人民检察院|全国政协|中美|中俄|中日|中欧|中非|一带一路|高质量发展|海警|解放军|两岸|台海|金门|台湾|链博|供应链|立法|司法解释|世卫|APEC|联合国|G20|上合|金砖|东盟|港澳|大湾区|宏观调控|供给侧|自贸区|进博会|消博会|王毅|国防|裁军|军演)/.test(text);
}

function deduplicateByUrl(articles) {
  const seen = new Set();
  return articles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^一-龥a-zA-Z0-9]/g, '')
    .replace(/^(快讯|最新|独家|权威|重磅|突发|直播|视频|图)/, '');
}

function isSimilarTitle(t1, t2) {
  const a = normalizeTitle(t1);
  const b = normalizeTitle(t2);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
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

  let normalized = dateStr
    .replace(/[()]/g, '')
    .replace(/\bCST\b/, '+0800')
    .replace(/\bCDT\b/, '+0800');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return false;

  const now = Date.now();
  const start = now - 24 * 60 * 60 * 1000;
  return d.getTime() >= start && d.getTime() <= now;
}

async function fetchAll(sources) {
  const allArticles = [];

  for (const source of sources) {
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
      console.error(`   ❌ ${source.name}: ${err.message}`);
    }
  }

  console.log(`\n📊 抓取总计: ${allArticles.length} 条`);
  return allArticles;
}

async function aiProcess(article, systemPrompt) {
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
        { role: "system", content: systemPrompt },
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

function applyCoverageBoost(article) {
  if (article.coverageBoost > 0) {
    article.credibilityScore = Math.min(100, article.credibilityScore + article.coverageBoost);
    if (article.credibilityScore >= 80) article.credibilityLevel = "high";
    else if (article.credibilityScore >= 60) article.credibilityLevel = "medium";
    article.credibilityReason += `（多源覆盖 +${article.coverageBoost}）`;
  }
}

async function run(config) {
  const { sources, outputFile, category, systemPrompt } = config;

  if (!DEEPSEEK_API_KEY) {
    console.error("❌ 请设置 DEEPSEEK_API_KEY 环境变量");
    process.exit(1);
  }

  console.log(`\n🌐 [${category}] 开始抓取...`);
  const articles = await fetchAll(sources);
  let deduped = deduplicateByUrl(articles);
  console.log(`📊 去重后: ${deduped.length} 条`);

  const beforeMerge = deduped.length;
  deduped = mergeSimilarArticles(deduped);
  console.log(`📰 主题合并: ${deduped.length} 条（${beforeMerge - deduped.length} 条因同主题合并）`);

  deduped.sort((a, b) => {
    const aChina = isChinaRelated(a);
    const bChina = isChinaRelated(b);
    if (aChina !== bChina) return bChina - aChina;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  deduped.splice(MAX_ARTICLES);
  console.log(`🔥 热门精选: 取前 ${deduped.length} 条`);

  console.log(`\n🤖 开始 AI 处理 (${DEEPSEEK_MODEL})...`);
  let aiProcessed = 0, filteredCount = 0, failedCount = 0;

  for (let i = 0; i < deduped.length; i++) {
    const article = deduped[i];
    console.log(`   [${i + 1}/${deduped.length}] ${article.title.slice(0, 30)}...`);

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
      await aiProcess(article, systemPrompt);
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

    await new Promise((r) => setTimeout(r, 500));
  }

  for (const article of deduped) {
    applyCoverageBoost(article);
  }

  console.log(`\n📊 [${category}] 最终统计: 总计 ${deduped.length} 条 | AI 处理 ${aiProcessed} | 内容过滤 ${filteredCount} | API 失败 ${failedCount}`);

  const output = JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalSources: sources.length,
    totalArticles: deduped.length,
    category,
    articles: deduped,
  }, null, 2);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, output, "utf-8");
  console.log(`💾 已保存到 ${outputFile}（${deduped.length} 条）`);
}

module.exports = { run };

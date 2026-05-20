const Parser = require("rss-parser");
const Anthropic = require("@anthropic-ai/sdk");
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
  { name: "人民网国际", url: "http://www.people.com.cn/rss/world.xml", weight: 90 },
  { name: "新华网国际", url: "http://rss.xinhuanet.com/rss/world.xml", weight: 85 },
  { name: "新华网国内", url: "http://rss.xinhuanet.com/rss/native.xml", weight: 85 },
  { name: "央视网国际", url: "http://www.cctv.com/program/rss/02/02/index.xml", weight: 88 },
  { name: "央视网国内", url: "http://www.cctv.com/program/rss/02/01/index.xml", weight: 88 },
  { name: "中国日报英文", url: "https://www.chinadaily.com.cn/rss/world.xml", weight: 90 },
  { name: "凤凰网资讯", url: "http://news.ifeng.com/rss/", weight: 75 },
  { name: "中国新闻网", url: "http://www.chinanews.com/rss/scroll-news.xml", weight: 85 },
];

const MAX_PER_SOURCE = 5;
const AI_MAX_ARTICLES = 30;
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
      article.credibilityLevel =
        article.credibilityScore >= 80 ? "high" : article.credibilityScore >= 60 ? "medium" : "low";
      article.credibilityReason = "AI 处理失败，使用来源权重作为默认评分";
    }

    // 请求间隔 500ms，避免限流
    await new Promise((r) => setTimeout(r, 500));
  }

  const output = JSON.stringify(deduped, null, 2);
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
  console.log(`💾 已保存到 ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});

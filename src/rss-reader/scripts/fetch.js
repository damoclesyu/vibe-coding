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

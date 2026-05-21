const { run } = require("./fetch-core");
const path = require("path");

const TECH_SOURCES = [
  { name: "36氪", url: "https://36kr.com/feed", weight: 88 },
  { name: "IT之家", url: "https://www.ithome.com/rss/", weight: 85 },
  { name: "爱范儿", url: "https://www.ifanr.com/feed", weight: 82 },
  { name: "钛媒体", url: "https://www.tmtpost.com/rss", weight: 82 },
  { name: "量子位", url: "https://www.qbitai.com/feed", weight: 80 },
  { name: "少数派", url: "https://sspai.com/feed", weight: 78 },
  { name: "InfoQ中文", url: "https://www.infoq.cn/feed", weight: 78 },
  { name: "Solidot", url: "https://www.solidot.org/index.rss", weight: 75 },
];

const TECH_PROMPT = `你是一位科技新闻分析师，擅长评估科技报道的技术准确性和行业影响力。

请分析以下科技新闻文章，输出严格的 JSON 格式（不要输出其他内容）：

{
  "summary": "一句话中文摘要，不超过40字",
  "credibilityScore": 85,
  "credibilityLevel": "high",
  "credibilityReason": "简要说明评分依据（50字以内）"
}

评分标准（0-100 分）：
- 90-100：来自权威科技媒体、信息详实有数据支撑、有原始出处
- 70-89：知名科技媒体、内容具体、逻辑清晰
- 50-69：一般来源、内容较简略、缺少细节
- 30-49：来源不明、标题党倾向、缺少事实依据
- 0-29：明显谣言、虚假技术宣传、煽动性内容

评分时考虑：
1. 技术准确性和专业性（权重最高）
2. 信息具体程度（产品/技术/数据细节）
3. 是否有原始出处或引用
4. 报道的时效性和相关性
5. 是否客观中立`;

run({
  sources: TECH_SOURCES,
  outputFile: path.join(__dirname, "..", "public", "tech-articles.json"),
  category: "科技新闻",
  systemPrompt: TECH_PROMPT,
}).catch((err) => {
  console.error("科技新闻抓取失败:", err);
  process.exit(1);
});

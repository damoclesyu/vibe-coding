const { run } = require("./fetch-core");
const path = require("path");

const INTl_SOURCES = [
  { name: "环球网", url: "https://m.huanqiu.com/rss/", weight: 85 },
  { name: "中国新闻网", url: "http://www.chinanews.com/rss/scroll-news.xml", weight: 82 },
];

const INTl_PROMPT = `你是一位国际新闻分析师，擅长快速评估新闻可信度。

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

run({
  sources: INTl_SOURCES,
  outputFile: path.join(__dirname, "..", "public", "articles.json"),
  category: "国际新闻",
  systemPrompt: INTl_PROMPT,
}).catch((err) => {
  console.error("国际新闻抓取失败:", err);
  process.exit(1);
});

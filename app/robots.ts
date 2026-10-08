import type { MetadataRoute } from "next";

const BASE = "https://www.oi-stay.com";
const PRIVATE = ["/admin", "/vendor", "/account", "/me", "/login", "/api"];

// 明確放行主流 AI 爬蟲 —— 希望被 ChatGPT / Gemini / Perplexity / Claude 等引用推薦(GEO)。
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",   // OpenAI
  "Google-Extended",                            // Gemini / AI Overviews
  "PerplexityBot", "Perplexity-User",           // Perplexity
  "ClaudeBot", "anthropic-ai", "Claude-Web",    // Anthropic
  "Applebot-Extended",                          // Apple
  "CCBot",                                       // Common Crawl(多數模型的訓練來源)
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_BOTS.map((ua) => ({ userAgent: ua, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}

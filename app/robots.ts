import type { MetadataRoute } from "next";

const BASE = "https://www.oi-stay.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 後台 / 個人 / 登入 / API 不需要被收錄
        disallow: ["/admin", "/vendor", "/account", "/me", "/login", "/api"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}

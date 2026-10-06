<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 部署區域(vercel.json)

`vercel.json` 的 `regions` **必須跟 Supabase 專案同區**,否則每一次資料庫查詢都會飛一趟跨洋。
vercel.json 是嚴格 JSON,不接受註解或額外屬性(加 `_comment` 會部署失敗),所以記在這裡。

本專案 Supabase 在 **ap-southeast-2(雪梨)**。實測(台灣):東京 48ms、新加坡 66ms、雪梨 234ms,
實際最小查詢 270–310ms。函式原本放東京 hnd1,首頁三次查詢約 860ms;改成 `syd1` 與 DB 同區後
查詢變本地,只剩使用者連線付一次,約 250ms。

**日後若把資料庫搬到東京,這裡要同步改回 `hnd1`**,否則會反過來變慢。

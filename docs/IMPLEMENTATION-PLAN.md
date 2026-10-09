# 偶宿 oi-stay — 城市優先架構改造 實作計畫

> 目標:把現有「分類優先」結構改成 spec 的「城市優先」旅遊資料庫,建立大量長尾 entity SEO 資產。
> 對應:`docs/SEO-STRATEGY.json`、`docs/PRODUCT-SPEC.json`
> 原則:趁 Google 幾乎未收錄(0 頁)時把不可逆的網址架構一次定對;每階段可獨立上線、不弄壞現站。

## 鎖定決定
- **主機**:`www.oi-stay.com`(apex 已 308→www;維持,不動)。
- **城市層級**:縣市(宜蘭、花蓮…),中文 slug。鄉鎮(礁溪/羅東)留作更深長尾。
- **城市來源**:資料驅動 —— 以現有 published 資料裡出現過的 `region` 為準,不另建 enum。
- **舊網址**:全部 301(`permanentRedirect`)轉到新結構。

## 目標網址架構
```
/{city}/                              城市中心頁(hub)
/{city}/hotels|restaurants|attractions|parking|itineraries/   分類列表(複數)
/{city}/hotels/{theme}                住宿主題長尾(包棟/親子/寵物…,複數+主題)
/{city}/hotel/{slug}                  民宿個別頁(單數+slug)
/{city}/restaurant/{slug}             餐廳個別頁
/{city}/attraction/{slug}             景點個別頁
/{city}/parking/{slug}                停車場個別頁
```
Next 路由(一個動態名 `[seg]`,用複數/單數分流,無衝突):
```
app/(site)/[city]/page.tsx                 → hub
app/(site)/[city]/[seg]/page.tsx           → seg 複數=列表;否則 404
app/(site)/[city]/[seg]/[sub]/page.tsx     → seg 複數+sub=主題列表;seg 單數+sub=entity 詳情
```

## 資料模型現況 → 需要的改動
| 表 | 有 slug? | region/town | lat/lng | 要做 |
|---|---|---|---|---|
| stays | ✅ | ✅ | ✅ | 無(沿用),只改對外網址 |
| trips | ✅ | region ✅ | ✗ | itineraries 列表用 region 過濾;詳情維持 /trips/{slug}(跨區社群內容) |
| attractions | ✗ | ✅ | ✅ | **加 slug 欄 + unique index + make_slug trigger + 回填** |
| restaurants | ✗ | ✅ | ✅ | 同上 |
| parking_lots | ✗ | ✅ | ✅ | 同上 |

## 階段計畫

### P1 — 架構地基(不可逆,先做對)
1. **DB**(Management API 跑 migration):
   - `attractions/restaurants/parking_lots` 各加 `slug text`,建 `make_place_slug()`(SECURITY DEFINER,避 RLS)+ BEFORE INSERT/UPDATE trigger + `unique index`,回填現有列(名稱+鄉鎮去重)。
2. **路由骨架**:建 `[city]`、`[city]/[seg]`(先接 hotels/restaurants/attractions/parking/itineraries 列表,沿用現有 explore 元件)。
3. **301**:
   - `/stay/{slug}` → `/{region}/hotel/{slug}`(頁內查 region 後 `permanentRedirect`)
   - `/stays/{region}` → `/{region}/hotels`
   - `/stays/{region}/{theme}` → `/{region}/hotels/{theme}`
   - `/places/attraction|food|parking` → 保留為「全台」入口或 301 到導覽頁(二擇一,預設保留為跨縣市總覽)
4. **canonical / sitemap**:全部指向新結構(見 P2 完成後擴充 entity)。
5. **驗證**:build 過 + 新舊網址各測 200/301 + 既有頁不破,才進 P2。

### P2 — entity 金礦(景點/餐廳/停車場個別頁)
1. `[city]/[seg]/[sub]` 詳情分支:依單數 seg 對應表(hotel→stays, restaurant→restaurants, attraction→attractions, parking→parking_lots),以 `region+slug` 查詢,fallback uuid(沿用 decodeParam/extractUuid)。
2. 詳情頁區塊(照 PRODUCT-SPEC entity_pages):介紹/圖片/營業時間(week_hours)/地址/地圖占位/價位/附近(P3 接)。
3. **per-type Schema**:restaurant→`Restaurant`、attraction→`TouristAttraction`、parking→`ParkingFacility`、hotel→`LodgingBusiness`(沿用);皆配 `BreadcrumbList`。資料不足欄位不硬塞(不虛構評價/價格)。
4. **sitemap** 擴充:納入三類 entity(published)+ city×category。

### P3 — 連成網(internal linking + hub + 站級 schema)
1. **城市 hub `/{city}/`**:匯整該市熱門住宿/景點/餐廳/停車/行程 + 城市簡介(真實內容,避免薄頁)。
2. **附近關係**:helper 以同 region/town + 經緯度 haversine 排序,詳情頁下方「附近景點/餐廳/停車/住宿」互連(entity_relationship_network)。
3. **麵包屑**:UI breadcrumb + `BreadcrumbList` schema 全站。
4. **站級 schema**:root layout 加 `Organization` + `WebSite`(含 sitelinks SearchAction)。
5. **主題長尾**:`/{city}/hotels/{theme}` 用現有 STAY_THEMES 接。

### P4 — 地圖探索(產品大工程,SEO 不依賴它)
1. 導入 **Leaflet + OpenStreetMap**(免費、無金鑰;日後可換 Google Maps)。
2. 分類列表 **list + map split view**(桌機)/ 地圖切換(手機)。
3. marker / cluster / 依地圖範圍搜尋 / 附近搜尋。

### P5 — 體驗收尾
- 手機 bottom navigation(首頁/搜尋/地圖/收藏/我的)。
- 搜尋 autocomplete。
- GA4(可選,需用戶提供 `G-xxxx`;現已有自建後台流量)。

## 監控(對應 SEO-STRATEGY.seo_monitoring)
- 每週:GSC 收錄數 / 曝光 / 點擊 / 平均排名 / 404。
- 每月:自然流量 / 關鍵字成長 / 外部連結 / Core Web Vitals / 品牌搜尋。

## 風險與守則
- **不可逆的網址只在 P1 定一次**;之後只增不改。
- programmatic 頁必須有真實資料,**薄頁(無資料的 city×category)不產生、不進 sitemap**(沿用現有 sitemap 的防薄頁邏輯)。
- 每階段:`gitnexus_impact` 評估 → 改 → build/驗證 → commit → 推 origin + 個人備份。

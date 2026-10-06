// 偶宿 O! — 分類、地區與範例資料(範例來自島宿 JSON,可在無資料庫時運作)
import type { Stay, StayCategory } from "./types";

export const CATEGORIES: StayCategory[] = [
  "海景度假",
  "山林小屋",
  "設計旅宿",
  "親子友善",
  "寵物友善",
  "包棟民宿",
  "復古老宅",
  "一般民宿",
];

export const ALL_CATEGORY_LABEL = "全部民宿";

export const GEOGRAPHIC_AREAS: { name: string; regions: string[] }[] = [
  { name: "北部", regions: ["台北", "新北", "基隆", "桃園", "新竹市", "新竹縣"] },
  { name: "中部", regions: ["苗栗", "台中", "彰化", "南投", "雲林"] },
  { name: "南部", regions: ["嘉義市", "嘉義縣", "台南", "高雄", "屏東"] },
  { name: "東部", regions: ["宜蘭", "花蓮", "台東"] },
  { name: "離島", regions: ["澎湖", "金門", "連江"] },
];

// 民宿設施 / 服務標籤(勾選用;儲存為 amenities「、」分隔字串,前台照舊拆開顯示)
export const AMENITY_OPTIONS: string[] = [
  "包棟", "附早餐", "公用客廳", "公用冰箱", "咖啡機", "飲水機", "熱水壺", "電梯",
  "提供WiFi", "冷氣", "數位頻道", "遊戲機", "自助洗衣", "浴巾/盥洗用品",
  "寵物友善", "禁止吸菸", "兒童遊戲區", "寄放行李",
  "戶外庭園", "戶外戲水池", "烤肉場地", "借用廚房", "麻將出借",
  "方便停車", "停車場", "充電樁", "機場接送",
  "代訂烤肉食材", "代訂票券", "代訂船票", "租車資訊",
];

// 前台常用設施篩選(從 AMENITY_OPTIONS 挑熱門的當篩選器)
export const AMENITY_FILTERS: string[] = [
  "包棟", "附早餐", "寵物友善", "提供WiFi", "停車場", "充電樁", "戶外戲水池", "烤肉場地", "電梯", "機場接送",
];

// 租車車種 / 品牌標籤(上架複選 + 前台篩選)
export const RENTAL_TAGS: string[] = ["腳踏車", "機車", "汽車", "重機", "電動車", "Ubike", "WeMo", "GoShare", "iRent"];

// 房型標籤(單間上架複選 + 前台篩選)
export const ROOM_TAGS: string[] = ["有浴缸", "有陽台", "海景", "獨立衛浴", "可加床", "和室", "免治馬桶", "大床"];
// 包棟專屬特色(限包棟;與單間房型標籤分開)
export const WHOLE_HOUSE_TAGS: string[] = ["烤肉場地", "代訂烤肉食材", "借用庭園", "麻將出借", "可開伙", "獨立庭院", "附早餐"];

export const PRICE_RANGES = [
  { value: "all", label: "不限金額", min: 0, max: null as number | null },
  { value: "under3000", label: "NT$ 3,000 以下", min: 0, max: 3000 },
  { value: "3000to5000", label: "NT$ 3,000–5,000", min: 3000, max: 5000 },
  { value: "5000to10000", label: "NT$ 5,000–10,000", min: 5000, max: 10000 },
  { value: "over10000", label: "NT$ 10,000 以上", min: 10000, max: null as number | null },
];

// 範例民宿(sample=true)。有真實資料庫資料後,前台只顯示已上架的資料庫民宿。
export const SAMPLE_STAYS: Stay[] = [
  { id: "sample-1", name: "海邊的日子", region: "屏東", town: "恆春鎮", category: "海景度假", price: 3800, guests: 4, image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=85", description: "讓旅行慢下來,在明亮的空間與水光之間,留一段時間給自己。", amenities: "泳池、停車位、Wi-Fi", website: "", published: true, sample: true, featured: true },
  { id: "sample-2", name: "日光留白", region: "宜蘭", town: "五結鄉", category: "設計旅宿", price: 2600, guests: 2, image: "https://images.unsplash.com/photo-1519710889408-a67e1c7e0452?auto=format&fit=crop&w=1200&q=85", description: "自然光灑進房間,簡單的木質與留白,適合兩個人的悠閒週末。", amenities: "早餐、Wi-Fi、停車位", website: "", published: true, sample: true },
  { id: "sample-3", name: "森間小屋", region: "南投", town: "鹿谷鄉", category: "山林小屋", price: 3200, guests: 4, image: "https://images.unsplash.com/photo-1723663561534-9b129f182785?auto=format&fit=crop&w=1200&q=85", description: "走進山林,在木屋裡聽風,享受遠離城市的安靜時光。", amenities: "山景、停車位、廚房", website: "", published: true, sample: true },
  { id: "sample-4", name: "島嶼假期", region: "澎湖", town: "馬公市", category: "包棟民宿", price: 9800, guests: 10, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85", description: "與朋友共享泳池與寬敞的公共空間,為下一次相聚留下一段假期。", amenities: "包棟、泳池、廚房", website: "", published: true, sample: true, featured: true },
  { id: "sample-5", name: "小日子旅居", region: "花蓮", town: "壽豐鄉", category: "親子友善", price: 2900, guests: 4, image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=85", description: "寬敞舒適的房間,讓一家人的旅行多一點自在。", amenities: "親子設備、早餐、停車位", website: "", published: true, sample: true },
  { id: "sample-6", name: "一起住森林", region: "苗栗", town: "南庄鄉", category: "寵物友善", price: 3600, guests: 4, image: "https://images.unsplash.com/photo-1618767689160-da3fb810aad7?auto=format&fit=crop&w=1200&q=85", description: "帶毛孩一起走進綠意,享受山中步調與溫暖的木屋空間。", amenities: "寵物友善、庭院、停車位", website: "", published: true, sample: true },
  { id: "sample-7", name: "海線月光", region: "台東", town: "成功鎮", category: "海景度假", price: 4200, guests: 2, image: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=85", description: "推開窗就是太平洋,夜裡聽著海浪入睡。", amenities: "海景、陽台、早餐", website: "", published: true, sample: true },
  { id: "sample-8", name: "山中歲月", region: "南投", town: "仁愛鄉", category: "山林小屋", price: 5200, guests: 6, image: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=85", description: "清境高處的雲霧與星空,適合一場遠離塵囂的小旅行。", amenities: "山景、暖爐、停車位", website: "", published: true, sample: true },
  { id: "sample-9", name: "城中設計棧", region: "台南", town: "中西區", category: "設計旅宿", price: 2400, guests: 2, image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85", description: "老屋改造的設計旅宿,走出門就是府城巷弄與美食。", amenities: "設計裝潢、Wi-Fi、腳踏車", website: "", published: true, sample: true },
];

export function priceLabel(p: number) {
  return p > 0 ? `NT$ ${p.toLocaleString()}` : "洽詢";
}

"use server";

import { revalidatePath } from "next/cache";

// 後台存檔後呼叫,讓公開頁的讀取快取(unstable_cache)立即失效。
// revalidatePath 會清掉該路徑渲染時用到的 data cache 條目。
export async function revalidateStays() { revalidatePath("/"); }
export async function revalidatePois() { revalidatePath("/places/[kind]", "page"); }
export async function revalidateSettings() { revalidatePath("/", "layout"); }
export async function revalidateTrips() { revalidatePath("/trips"); }

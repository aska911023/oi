import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// 「檢視身分」(admin 專用的 UI 預覽,像 Discord 以角色查看)。
// 靠 cookie oi_view_as 覆蓋「有效身分」給伺服器端元件用;只有真正的 admin 才生效。
// 注意:這只改畫面/導覽,不改資料權限(資料仍由 RLS 用真帳號把關)。
export type ViewRole = "partner" | "user" | "guest";
const VALID: ViewRole[] = ["partner", "user", "guest"];

export interface Viewer {
  isRealAdmin: boolean;      // 真實是不是 admin(決定能否用檢視身分)
  viewAs: ViewRole | null;   // 目前預覽的身分(null = 以自己)
  loggedIn: boolean;         // 有效(預覽後)是否登入
  role: string;              // 有效角色
  userId: string | null;     // 真實 user id(資料查詢仍用真帳號)
  name: string;
  avatarUrl: string | null;
}

export async function getViewer(): Promise<Viewer> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  let name = "", realRole = "user", avatarUrl: string | null = null;
  if (user) {
    const { data } = await sb.from("profiles").select("display_name, role, avatar_url").eq("id", user.id).maybeSingle();
    name = data?.display_name || user.email?.split("@")[0] || "";
    realRole = data?.role || "user";
    avatarUrl = data?.avatar_url || null;
  }
  const isRealAdmin = realRole === "admin";
  const raw = (await cookies()).get("oi_view_as")?.value as ViewRole | undefined;
  const viewAs = isRealAdmin && raw && VALID.includes(raw) ? raw : null;

  const loggedIn = viewAs === "guest" ? false : !!user;
  const role = viewAs && viewAs !== "guest" ? viewAs : realRole;
  return { isRealAdmin, viewAs, loggedIn, role, userId: user?.id ?? null, name, avatarUrl };
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// getViewer() 的 client 版:讓 header/預覽橫幅在「靜態殼層」下也能顯示登入狀態,
// 這樣 (site)/layout 不必在伺服器端查 auth → 內容頁才能進 CDN(ISR)。
// 只影響畫面,不改資料權限(資料仍由 RLS 把關)。
export type ClientViewer = {
  loading: boolean;
  loggedIn: boolean;
  role: string;
  name: string;
  avatarUrl: string | null;
  isRealAdmin: boolean;
  viewAs: string | null;
};

const VALID = ["partner", "creator", "user", "guest"];

function readViewAs(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )oi_view_as=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : null;
  return v && VALID.includes(v) ? v : null;
}

const GUEST: ClientViewer = { loading: true, loggedIn: false, role: "guest", name: "", avatarUrl: null, isRealAdmin: false, viewAs: null };

export function useViewer(): ClientViewer {
  const [v, setV] = useState<ClientViewer>(GUEST);

  useEffect(() => {
    const sb = createClient();
    let alive = true;

    async function load() {
      const { data: { user } } = await sb.auth.getUser();
      let name = "", realRole = "user", avatarUrl: string | null = null;
      if (user) {
        const { data } = await sb.from("profiles").select("display_name, role, avatar_url").eq("id", user.id).maybeSingle();
        name = data?.display_name || user.email?.split("@")[0] || "";
        realRole = data?.role || "user";
        avatarUrl = data?.avatar_url || null;
      }
      const isRealAdmin = realRole === "admin";
      const viewAs = isRealAdmin ? readViewAs() : null;
      const loggedIn = viewAs === "guest" ? false : !!user;
      // guest 預覽:角色也降成訪客(不可留 realRole,否則 admin UI 會在訪客預覽漏出)
      const role = viewAs ? (viewAs === "guest" ? "guest" : viewAs) : realRole;
      if (alive) setV({ loading: false, loggedIn, role, name, avatarUrl, isRealAdmin, viewAs });
    }

    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return v;
}

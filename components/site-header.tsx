import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";

export default async function SiteHeader({ onGreen = false }: { onGreen?: boolean }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  let name = "";
  let role = "user";
  if (user) {
    const { data } = await sb.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle();
    name = data?.display_name || user.email?.split("@")[0] || "";
    role = data?.role || "user";
  }

  return (
    <header className={"topbar " + (onGreen ? "on-green" : "solid")}>
      <div className="shell">
        <Logo />
        <nav className="topnav">
          <Link href="/">探索民宿</Link>
          {user ? (
            <>
              <span className="greet">歡迎,{name}</span>
              {role === "admin" && <Link href="/admin">管理後台</Link>}
              <Link href="/account" className="cta">我的帳號</Link>
            </>
          ) : (
            <Link href="/login" className="cta">登入 / 註冊</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

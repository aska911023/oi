import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response; // 未設定 Supabase 時略過

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // 只用 getSession()(讀 cookie、不打網路);token 快過期時才呼叫 getUser() 刷新。
  // 避免每次導航都對 Auth 伺服器發一趟網路請求(那是導航變慢的主因)。
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt - now < 120) {
      await supabase.auth.getUser(); // 觸發刷新,並由上面的 setAll 寫回新 cookie
    }
  }

  return response;
}

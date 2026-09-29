import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";
import { Logo } from "@/components/logo";
import VendorApplyForm from "@/components/vendor-apply-form";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/apply");
  const settings = await getSiteSettings();

  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const { data: latest } = await sb
    .from("vendor_applications")
    .select("*")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPartner = profile?.role === "partner" || profile?.role === "admin";

  return (
    <>
      <header className="topbar solid">
        <div className="shell">
          <Logo src={settings.logo_image || undefined} size={settings.logo_size} />
          <nav className="topnav"><Link href="/">探索民宿</Link><Link href="/account">我的帳號</Link></nav>
        </div>
      </header>

      <div className="legal" style={{ maxWidth: 640 }}>
        <h1 style={{ marginBottom: 6 }}>申請成為業者</h1>
        <p style={{ color: "var(--text-2)", marginTop: 0 }}>
          填寫民宿 / 商家資料,送出後由偶宿團隊審核。通過後即可上架民宿、管理房況與導流曝光。
        </p>

        {isPartner ? (
          <div className="apply-state ok">
            你已是業者帳號,可直接
            {profile?.role === "admin" ? <Link href="/admin"> 前往後台</Link> : <Link href="/account"> 管理帳號</Link>}。
          </div>
        ) : latest && latest.status === "pending" ? (
          <div className="apply-state pending">
            你的申請(<b>{latest.business_name}</b>)正在審核中,請耐心等候。若需修改資料可重新送出。
          </div>
        ) : latest && latest.status === "rejected" ? (
          <div className="apply-state rejected">
            上次申請未通過。你可以補齊資料後重新送出。
          </div>
        ) : null}

        {!isPartner && (
          <VendorApplyForm
            userId={user.id}
            defaults={{
              business_name: latest?.business_name || "",
              address: latest?.address || profile?.address || "",
              phone: latest?.phone || profile?.phone || "",
              email: latest?.email || user.email || "",
              website: latest?.website || "",
              line_url: latest?.line_url || "",
              fb_url: latest?.fb_url || "",
              note: latest?.note || "",
            }}
          />
        )}
      </div>
    </>
  );
}

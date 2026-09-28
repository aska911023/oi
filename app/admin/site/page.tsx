import { getSiteSettings } from "@/lib/site-settings";
import SiteSettingsForm from "@/components/admin/site-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSite() {
  const settings = await getSiteSettings();
  return <SiteSettingsForm initial={settings} />;
}

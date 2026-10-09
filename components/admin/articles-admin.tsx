"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS } from "@/lib/data";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);
const TAGS = ["城市指南", "一日遊", "兩天一夜", "親子行程", "情侶行程", "季節限定", "美食攻略", "景點攻略"];

interface Article { id?: string; slug?: string; title: string; excerpt?: string; cover_image?: string; body?: string; region?: string; tag?: string; published?: boolean; created_at?: string; }
const EMPTY: Article = { title: "", excerpt: "", cover_image: "", body: "", region: "", tag: "", published: false };

export default function ArticlesAdmin() {
  const [list, setList] = useState<Article[]>([]);
  const [edit, setEdit] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.from("articles").select("id,slug,title,region,tag,published,created_at").order("created_at", { ascending: false });
    setList((data as Article[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit) return;
    if (!edit.title.trim()) { alert("請填標題"); return; }
    setSaving(true);
    const sb = createClient();
    const payload = { title: edit.title.trim(), excerpt: edit.excerpt || null, cover_image: edit.cover_image || null, body: edit.body || null, region: edit.region || null, tag: edit.tag || null, published: !!edit.published };
    const { error } = edit.id
      ? await sb.from("articles").update(payload).eq("id", edit.id)
      : await sb.from("articles").insert(payload);
    setSaving(false);
    if (error) { alert("儲存失敗:" + error.message); return; }
    setEdit(null); load();
  }
  async function remove(a: Article) {
    if (!a.id || !confirm(`刪除「${a.title}」?此動作無法復原。`)) return;
    const sb = createClient();
    const { error } = await sb.from("articles").delete().eq("id", a.id);
    if (error) { alert("刪除失敗:" + error.message); return; }
    load();
  }

  if (edit) {
    return (
      <div className="panel">
        <div className="pb-grid">
          <div className="wide"><label>標題</label><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="例:宜蘭兩天一夜這樣玩" /></div>
          <div><label>類型</label><select value={edit.tag || ""} onChange={(e) => setEdit({ ...edit, tag: e.target.value })}><option value="">不指定</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label>關聯城市(選填)</label><select value={edit.region || ""} onChange={(e) => setEdit({ ...edit, region: e.target.value })}><option value="">不指定</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="wide"><label>封面圖網址(選填)</label><input value={edit.cover_image || ""} onChange={(e) => setEdit({ ...edit, cover_image: e.target.value })} placeholder="https://…" /></div>
          <div className="wide"><label>摘要(列表 / 分享卡顯示)</label><textarea rows={2} value={edit.excerpt || ""} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} placeholder="一兩句介紹這篇攻略" /></div>
          <div className="wide"><label>內文(Markdown:## 小標、**粗體**、- 清單、[文字](網址)、![說明](圖片網址))</label>
            <textarea rows={16} value={edit.body || ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder={"## 第一天\n\n早上先到頭城老街逛逛…\n\n- 景點:蘭陽博物館\n- 午餐:阿宗芋冰城\n\n## 第二天\n\n…"} /></div>
          <div className="wide"><label className="check"><input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> 發布(勾選才會出現在前台 /guides)</label></div>
        </div>
        <div className="plan-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "儲存中…" : edit.id ? "更新攻略" : "建立攻略"}</button>
          <button className="btn btn-ghost" onClick={() => setEdit(null)}>取消</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="plan-actions" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setEdit({ ...EMPTY })}>＋ 新增攻略</button>
      </div>
      {loading ? <p style={{ color: "var(--muted)" }}>載入中…</p> : list.length === 0 ? (
        <div className="empty">還沒有攻略,點「＋ 新增攻略」開始寫。</div>
      ) : (
        <div className="art-list">
          {list.map((a) => (
            <div className="art-row" key={a.id}>
              <div className="art-main">
                <div className="art-title">{a.title}</div>
                <div className="art-meta">{a.tag || "未分類"}{a.region ? ` · ${a.region}` : ""} · {a.published ? <span className="pill live">已發布</span> : <span className="pill draft">草稿</span>}</div>
              </div>
              <div className="art-actions">
                {a.published && a.slug && <a className="lnk" href={`/guides/${a.slug}`} target="_blank" rel="noopener noreferrer">看</a>}
                <button className="lnk" onClick={() => setEdit(a)}>編輯</button>
                <button className="lnk danger" onClick={() => remove(a)}>刪</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

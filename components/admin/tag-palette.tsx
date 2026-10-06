"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 可編輯的標籤 chip 清單:讀 site_settings.<settingKey>(無則用程式預設 defaults);
// admin(canManage)可「＋新增」整個平台共用的標籤、按 × 刪除;寫入 site_settings(RLS 僅 admin)。
// 業者(canManage=false)只能點選套用,不能改全域清單。
export default function TagPalette({ settingKey, defaults, selected, onToggle, canManage = false }: {
  settingKey: "amenity_options" | "whole_house_options";
  defaults: string[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  canManage?: boolean;
}) {
  const [opts, setOpts] = useState<string[]>(defaults);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await createClient().from("site_settings").select(settingKey).eq("id", 1).maybeSingle();
      const stored = (data as Record<string, unknown> | null)?.[settingKey];
      if (alive && Array.isArray(stored) && stored.length) {
        setOpts(stored.filter((x): x is string => typeof x === "string" && !!x.trim()));
      }
    })();
    return () => { alive = false; };
  }, [settingKey]);

  async function persist(list: string[]) {
    setOpts(list);
    const { error } = await createClient().from("site_settings").update({ [settingKey]: list }).eq("id", 1);
    if (error) alert("標籤儲存失敗:" + error.message);
  }
  function add() {
    const t = newTag.trim();
    setNewTag("");
    if (!t || opts.includes(t)) return;
    persist([...opts, t]);
  }
  function del(t: string) {
    if (!confirm(`刪除標籤「${t}」?\n(選單不再出現;已勾選此標籤的民宿不受影響)`)) return;
    persist(opts.filter((x) => x !== t));
  }

  return (
    <div className="fac-grid">
      {opts.map((a) => (
        <span className="chip-wrap" key={a}>
          <button type="button" className={"chip" + (selected.has(a) ? " on" : "")} onClick={() => onToggle(a)}>{a}</button>
          {canManage && <button type="button" className="chip-del" title="刪除此標籤選項" onClick={() => del(a)}>×</button>}
        </span>
      ))}
      {canManage && (
        <span className="chip-add">
          <input value={newTag} placeholder="新增標籤…" aria-label="新增標籤"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="chip chip-add-btn" onClick={add}>＋ 新增</button>
        </span>
      )}
    </div>
  );
}

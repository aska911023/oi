"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RoomCard } from "@/lib/types";

const MAX = 4;
const KEY = "oi_compare";

interface Ctx {
  items: RoomCard[];
  max: number;
  has: (id: string) => boolean;
  toggle: (c: RoomCard) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CompareCtx = createContext<Ctx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RoomCard[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setItems(JSON.parse(s)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const has = (id: string) => items.some((x) => x.id === id);
  const toggle = (c: RoomCard) => setItems((p) => {
    if (p.some((x) => x.id === c.id)) return p.filter((x) => x.id !== c.id);
    if (p.length >= MAX) return p;
    return [...p, c];
  });
  const remove = (id: string) => setItems((p) => p.filter((x) => x.id !== id));
  const clear = () => setItems([]);

  return <CompareCtx.Provider value={{ items, max: MAX, has, toggle, remove, clear }}>{children}</CompareCtx.Provider>;
}

export function useCompare() {
  const c = useContext(CompareCtx);
  if (!c) throw new Error("useCompare 必須在 CompareProvider 內使用");
  return c;
}

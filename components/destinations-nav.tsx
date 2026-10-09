"use client";

import { useState } from "react";
import Link from "next/link";
import { GEOGRAPHIC_AREAS } from "@/lib/data";

// header 的「目的地」下拉:每頁都能點進各城市頁(含地圖/住宿/景點/美食)
export default function DestinationsNav() {
  const [open, setOpen] = useState(false);
  const enc = encodeURIComponent;
  return (
    <div className="destnav" onMouseLeave={() => setOpen(false)}>
      <button type="button" className="destnav-btn" onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} aria-expanded={open}>
        目的地 <span className="destnav-caret">▾</span>
      </button>
      {open && (
        <>
          <div className="destnav-backdrop" onClick={() => setOpen(false)} />
          <div className="destnav-menu" role="menu">
            {GEOGRAPHIC_AREAS.map((area) => (
              <div key={area.name} className="destnav-col">
                <div className="destnav-h">{area.name}</div>
                {area.regions.map((r) => (
                  <Link key={r} href={`/${enc(r)}`} className="destnav-link" onClick={() => setOpen(false)}>{r}</Link>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

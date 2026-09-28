"use client";

import { useState } from "react";

const EYE = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_OFF = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" />
  </svg>
);

export default function PasswordInput({
  value, onChange, placeholder, minLength,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minLength={minLength}
        required
      />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "隱藏密碼" : "顯示密碼"} tabIndex={-1}>
        {show ? EYE_OFF : EYE}
      </button>
    </div>
  );
}

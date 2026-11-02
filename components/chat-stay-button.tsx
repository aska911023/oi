"use client";

// 民宿頁「私訊民宿」:派 oi-chat-stay 事件給全站浮動收件匣(FloatingChat)開對話。
// 未登入時 FloatingChat 會自己跳登入;收件匣在全站常駐,離開此頁也看得到民宿回覆。
export default function ChatStayButton({ stayId, stayName }: { stayId: string; stayName: string }) {
  return (
    <button type="button" className="btn btn-ghost"
      onClick={() => window.dispatchEvent(new CustomEvent("oi-chat-stay", { detail: { stayId, stayName } }))}>
      💬 私訊民宿
    </button>
  );
}

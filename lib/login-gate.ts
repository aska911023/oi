// 全站共用的「登入才能用」彈窗觸發器(輕量發布/訂閱,不用 context 包全站)。
// 任何 client 元件要擋登入,呼叫 promptLogin(nextPath, { title, desc }) 即可跳出彈窗,
// 不再用整頁 router.push("/login") 的跳轉(體驗較差)。
type GateCopy = { title?: string; desc?: string };
type Listener = (nextPath: string, copy?: GateCopy) => void;

const listeners = new Set<Listener>();

export function promptLogin(nextPath = "/", copy?: GateCopy) {
  if (listeners.size === 0) {
    // 保底:萬一彈窗沒掛載,還是導去登入,不讓動作無聲失敗
    if (typeof window !== "undefined") window.location.href = "/login?next=" + encodeURIComponent(nextPath);
    return;
  }
  listeners.forEach((l) => l(nextPath, copy));
}

export function onPromptLogin(cb: Listener) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

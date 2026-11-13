/** 空いている時間に `task` を呼ぶ。`requestIdleCallback` の無いブラウザでは次のタスクで呼ぶ。戻り値は、呼ばれる前に取りやめる関数。 */
export function scheduleIdleTask(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task);
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
}

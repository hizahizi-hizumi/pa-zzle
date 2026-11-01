/** ページが画面に見えているか。裏のタブにある間や最小化している間は `false`。 */
export function isDocumentVisible(): boolean {
  return document.visibilityState === "visible";
}

/** ページが見えるか見えなくなるたびに `onChange` を呼ぶ。戻り値は購読をやめる関数。 */
export function subscribeDocumentVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return function unsubscribe() {
    document.removeEventListener("visibilitychange", onChange);
  };
}

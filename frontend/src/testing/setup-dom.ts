// jsdom does not yet implement the document-level Web Animations API.
// dnd-kit queries running animations when it measures sortable rows.
Object.defineProperty(document, "getAnimations", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Element.prototype, "getAnimations", {
  configurable: true,
  value: () => [],
});

// プレイ状態の永続化は実ブラウザの再読み込みと画面再訪で確認する。
// テストケースごとは独立したタブに相当するため、その状態は引き継がない。
afterEach(() => {
  for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith("pa-zzle.active-play.v1.")) {
      window.sessionStorage.removeItem(key);
    }
  }
});

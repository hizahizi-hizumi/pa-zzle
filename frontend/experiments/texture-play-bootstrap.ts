// この比較用の文書だけ保存先をメモリーに置き換える。普段の成績・設定を読み書きしない。
const values = new Map<string, string>([
  ["pa-zzle.sound-effects-volume.v1", '{"volume":0,"unmutedVolume":5}'],
  ["pa-zzle.background-music-volume.v1", '{"volume":0,"unmutedVolume":5}'],
]);
const storage: Storage = {
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => values.delete(key),
  setItem: (key, value) => values.set(key, value),
};
Object.defineProperty(window, "localStorage", { value: storage });
Object.defineProperty(window, "sessionStorage", { value: storage });
await import("./texture-play");

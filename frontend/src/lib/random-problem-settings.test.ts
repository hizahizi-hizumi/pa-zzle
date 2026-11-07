import {
  _private,
  randomProblemSettings,
  randomProblemStatuses,
} from "@/lib/random-problem-settings";

afterEach(() => {
  window.localStorage.clear();
  _private.reset();
});

describe("randomProblemSettings", () => {
  test("初期状態では全6種類を全ゲーム共通で出題すること", () => {
    const selected = randomProblemSettings.getEffective("nanpure");

    expect(selected).toEqual(randomProblemStatuses);
  });

  test("共通設定の変更は個別設定のないゲームだけに反映すること", () => {
    randomProblemSettings.setGlobal(["untouched", "great"]);
    randomProblemSettings.setGame("nanpure", ["good"]);
    randomProblemSettings.setGlobal(["perfect"]);

    expect(randomProblemSettings.getEffective("nanpure")).toEqual(["good"]);
    expect(randomProblemSettings.getEffective("water-sort")).toEqual([
      "perfect",
    ]);
  });

  test("個別設定の解除で現在の共通設定を継承すること", () => {
    randomProblemSettings.setGame("nanpure", ["great"]);
    randomProblemSettings.setGlobal(["clear"]);
    randomProblemSettings.clearGame("nanpure");

    expect(randomProblemSettings.getEffective("nanpure")).toEqual(["clear"]);
  });

  test("設定の変更を端末に保存して読み直せること", () => {
    randomProblemSettings.setGlobal(["untouched", "great"]);
    randomProblemSettings.setGame("nanpure", ["perfect"]);
    _private.reset();
    const snapshot = randomProblemSettings.getSnapshot();

    expect(snapshot).toEqual({
      global: ["untouched", "great"],
      overrides: { nanpure: ["perfect"] },
    });
  });

  test("空集合・重複・不明な状態への変更を受け付けないこと", () => {
    randomProblemSettings.setGlobal([]);
    randomProblemSettings.setGlobal(["great", "great"]);
    randomProblemSettings.setGame("nanpure", []);
    const snapshot = randomProblemSettings.getSnapshot();

    expect(snapshot).toEqual({ global: randomProblemStatuses, overrides: {} });
  });

  test("破損した保存値では共通設定の初期状態に戻ること", () => {
    window.localStorage.setItem(
      "pa-zzle.random-problem-statuses.v1",
      "{broken",
    );
    _private.reset();
    const selected = randomProblemSettings.getEffective("water-sort");

    expect(selected).toEqual(randomProblemStatuses);
  });
});

import {
  _private,
  gameSelectionOrderSetting,
} from "@/features/settings/game-selection-order-setting";

const storageKey = "pa-zzle.game-selection-order.v1";

afterEach(() => {
  window.localStorage.clear();
  _private.resetCache();
});

describe("gameSelectionOrderSetting", () => {
  test("初期値では利用可能なパズルを定義順に並べること", () => {
    const ordered = gameSelectionOrderSetting.sortGameIds(
      ["water-sort", "nanpure", "takuzu"],
      gameSelectionOrderSetting.getSnapshot(),
    );

    expect(ordered).toEqual(["water-sort", "nanpure", "takuzu"]);
  });

  test("並び替えを端末に保存し、次に読み直しても維持すること", () => {
    gameSelectionOrderSetting.setOrder(["nanpure", "water-sort"]);
    _private.resetCache();
    const ordered = gameSelectionOrderSetting.getSnapshot();

    expect(ordered).toEqual(["nanpure", "water-sort"]);
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
    ).toEqual(["nanpure", "water-sort"]);
  });

  test("後から追加されたパズルを保存済みの順番の末尾に並べること", () => {
    const ordered = gameSelectionOrderSetting.sortGameIds(
      ["water-sort", "nanpure", "takuzu"],
      ["nanpure", "water-sort"],
    );

    expect(ordered).toEqual(["nanpure", "water-sort", "takuzu"]);
  });

  test("提供終了したパズルを無視して利用可能なパズルだけ並べること", () => {
    const ordered = gameSelectionOrderSetting.sortGameIds(
      ["water-sort", "nanpure"],
      ["removed-game", "nanpure"],
    );

    expect(ordered).toEqual(["nanpure", "water-sort"]);
  });

  test("壊れた保存値では初期順を使うこと", () => {
    window.localStorage.setItem(storageKey, '["nanpure","nanpure"]');
    _private.resetCache();
    const ordered = gameSelectionOrderSetting.getSnapshot();

    expect(ordered).toEqual([]);
  });

  test("初期順に戻すと保存された順番を削除すること", () => {
    gameSelectionOrderSetting.setOrder(["nanpure", "water-sort"]);
    gameSelectionOrderSetting.restoreDefault();
    const ordered = gameSelectionOrderSetting.getSnapshot();

    expect(ordered).toEqual([]);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  test("別のタブから変更した順番を読み直して通知すること", () => {
    const listener = vi.fn();
    const unsubscribe = gameSelectionOrderSetting.subscribe(listener);
    window.localStorage.setItem(storageKey, '["nanpure","water-sort"]');
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
    const ordered = gameSelectionOrderSetting.getSnapshot();
    unsubscribe();

    expect(ordered).toEqual(["nanpure", "water-sort"]);
    expect(listener).toHaveBeenCalledExactlyOnceWith();
  });
});

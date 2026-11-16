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

describe("パズルの表示設定", () => {
  const available = ["water-sort", "nanpure", "takuzu"];
  const hiddenStorageKey = "pa-zzle.hidden-game-ids.v1";

  test("非表示にしたゲームだけを除外し、並び順は維持すること", () => {
    gameSelectionOrderSetting.setOrder(["nanpure", "water-sort", "takuzu"]);
    gameSelectionOrderSetting.setGameHidden("water-sort", true, available);
    _private.resetCache();

    expect(gameSelectionOrderSetting.getHiddenSnapshot()).toEqual([
      "water-sort",
    ]);
    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([
      "nanpure",
      "water-sort",
      "takuzu",
    ]);
    expect(
      gameSelectionOrderSetting.visibleGameIds(
        gameSelectionOrderSetting.sortGameIds(
          available,
          gameSelectionOrderSetting.getSnapshot(),
        ),
        gameSelectionOrderSetting.getHiddenSnapshot(),
      ),
    ).toEqual(["nanpure", "takuzu"]);
    expect(
      JSON.parse(window.localStorage.getItem(hiddenStorageKey) ?? "null"),
    ).toEqual(["water-sort"]);
  });

  test("最後の1ゲームは非表示にできず、すべて非表示の保存値でも表示できること", () => {
    gameSelectionOrderSetting.setGameHidden("water-sort", true, available);
    gameSelectionOrderSetting.setGameHidden("nanpure", true, available);
    gameSelectionOrderSetting.setGameHidden("takuzu", true, available);

    expect(gameSelectionOrderSetting.getHiddenSnapshot()).toEqual([
      "water-sort",
      "nanpure",
    ]);
    expect(
      gameSelectionOrderSetting.visibleGameIds(
        available,
        gameSelectionOrderSetting.getHiddenSnapshot(),
      ),
    ).toEqual(["takuzu"]);
    expect(
      gameSelectionOrderSetting.visibleGameIds(available, available),
    ).toEqual(["water-sort"]);
  });

  test("表示に戻せることと、新しいゲームは初期表示されること", () => {
    gameSelectionOrderSetting.setGameHidden("nanpure", true, available);
    expect(
      gameSelectionOrderSetting.visibleGameIds(
        [...available, "new-game"],
        gameSelectionOrderSetting.getHiddenSnapshot(),
      ),
    ).toEqual(["water-sort", "takuzu", "new-game"]);
    gameSelectionOrderSetting.setGameHidden("nanpure", false, available);
    expect(gameSelectionOrderSetting.getHiddenSnapshot()).toEqual([]);
    expect(window.localStorage.getItem(hiddenStorageKey)).toBeNull();
  });

  test("すべて表示へ戻しても並び順は保持すること", () => {
    gameSelectionOrderSetting.setOrder(["nanpure", "water-sort"]);
    gameSelectionOrderSetting.setGameHidden("nanpure", true, available);
    gameSelectionOrderSetting.showAllGames();

    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([
      "nanpure",
      "water-sort",
    ]);
    expect(gameSelectionOrderSetting.getHiddenSnapshot()).toEqual([]);
    expect(window.localStorage.getItem(hiddenStorageKey)).toBeNull();
  });

  test("壊れた保存値は初期表示に戻すこと", () => {
    window.localStorage.setItem(hiddenStorageKey, '["nanpure","nanpure"]');
    _private.resetCache();
    expect(gameSelectionOrderSetting.getHiddenSnapshot()).toEqual([]);
  });

  test("別のタブの表示変更を通知すること", () => {
    const listener = vi.fn();
    const unsubscribe = gameSelectionOrderSetting.subscribe(listener);
    window.localStorage.setItem(hiddenStorageKey, '["nanpure"]');
    window.dispatchEvent(
      new StorageEvent("storage", { key: hiddenStorageKey }),
    );
    expect(gameSelectionOrderSetting.getHiddenSnapshot()).toEqual(["nanpure"]);
    unsubscribe();
    expect(listener).toHaveBeenCalledExactlyOnceWith();
  });
});

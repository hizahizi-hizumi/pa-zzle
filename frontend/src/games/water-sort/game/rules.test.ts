import { describe, expect, test } from "vitest";

import {
  applyWaterSortMove,
  getWaterSortPourAmount,
  listWaterSortLegalMoves,
} from "./rules";
import {
  createWaterSortStateKey,
  isStandardWaterSortInitialState,
  isWaterSortCleared,
  type WaterSortState,
} from "./state";

describe("getWaterSortPourAmount", () => {
  test("最上段の連続した同色を空き容量までまとめて移せること", () => {
    const state: WaterSortState = [
      [0, 1, 1, 1],
      [2, 1],
    ];

    const result = getWaterSortPourAmount(state, {
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });

    expect(result).toBe(2);
  });

  test("注ぎ先の最上段が異なる色なら移せないこと", () => {
    const state: WaterSortState = [[0, 1], [2]];

    const result = getWaterSortPourAmount(state, {
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });

    expect(result).toBe(0);
  });
});

describe("applyWaterSortMove", () => {
  test("成立した注水を新しい盤面として返し入力盤面を変更しないこと", () => {
    const state: WaterSortState = [[0, 1, 1], [2, 1], []];

    const result = applyWaterSortMove(state, {
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });

    expect(result).toEqual([[0], [2, 1, 1, 1], []]);
    expect(state).toEqual([[0, 1, 1], [2, 1], []]);
  });

  test("成立しない注水では盤面を返さないこと", () => {
    const state: WaterSortState = [[0], [1]];

    const result = applyWaterSortMove(state, {
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });

    expect(result).toBeNull();
  });
});

describe("listWaterSortLegalMoves", () => {
  test("完成済みボトルから空ボトルへの注水もゲームルール上は合法とすること", () => {
    const state: WaterSortState = [[0, 0, 0, 0], []];

    const result = listWaterSortLegalMoves(state);

    expect(result).toContainEqual({
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });
  });

  test("盤面から成立する注水だけを列挙すること", () => {
    const state: WaterSortState = [[0, 1], [1], [], [2, 2, 2, 2]];

    const result = listWaterSortLegalMoves(state);

    expect(result).toContainEqual({
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });
    expect(result).toContainEqual({
      sourceBottleIndex: 0,
      destinationBottleIndex: 2,
    });
    expect(result).not.toContainEqual({
      sourceBottleIndex: 0,
      destinationBottleIndex: 3,
    });
  });
});

describe("isWaterSortCleared", () => {
  test("空または容量4の単色ボトルだけならクリアと判定すること", () => {
    const state: WaterSortState = [[0, 0, 0, 0], [1, 1, 1, 1], [], []];

    const result = isWaterSortCleared(state);

    expect(result).toBe(true);
  });

  test("未完成のボトルが残っていればクリアと判定しないこと", () => {
    const state: WaterSortState = [[0, 0, 0], [1, 1, 1, 1], []];

    const result = isWaterSortCleared(state);

    expect(result).toBe(false);
  });
});

describe("createWaterSortStateKey", () => {
  test("ボトルの並び順だけが異なる盤面を同じ状態として扱うこと", () => {
    const first: WaterSortState = [[0, 1], [], [2, 2]];
    const second: WaterSortState = [[2, 2], [0, 1], []];

    const firstKey = createWaterSortStateKey(first);
    const secondKey = createWaterSortStateKey(second);

    expect(firstKey).toBe(secondKey);
  });
});

describe("isStandardWaterSortInitialState", () => {
  test("各色4単位の満杯ボトルと空ボトル2本を受け入れること", () => {
    const state: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];

    const result = isStandardWaterSortInitialState(state, 2);

    expect(result).toBe(true);
  });

  test("色の個数が容量と一致しない盤面を拒否すること", () => {
    const state: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 1], [], []];

    const result = isStandardWaterSortInitialState(state, 2);

    expect(result).toBe(false);
  });
});

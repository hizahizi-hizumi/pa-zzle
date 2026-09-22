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
  const pourableState: WaterSortState = [
    [0, 1, 1, 1],
    [2, 1],
  ];
  const mismatchedColorState: WaterSortState = [[0, 1], [2]];
  const move = { sourceBottleIndex: 0, destinationBottleIndex: 1 } as const;

  test("最上段の連続した同色を空き容量までまとめて移せること", () => {
    const result = getWaterSortPourAmount(pourableState, move);

    expect(result).toBe(2);
  });

  test("注ぎ先の最上段が異なる色なら移せないこと", () => {
    const result = getWaterSortPourAmount(mismatchedColorState, move);

    expect(result).toBe(0);
  });
});

describe("applyWaterSortMove", () => {
  const pourableState: WaterSortState = [[0, 1, 1], [2, 1], []];
  const illegalState: WaterSortState = [[0], [1]];
  const move = { sourceBottleIndex: 0, destinationBottleIndex: 1 } as const;

  test("成立した注水を新しい盤面として返し入力盤面を変更しないこと", () => {
    const result = applyWaterSortMove(pourableState, move);

    expect(result).toEqual([[0], [2, 1, 1, 1], []]);
    expect(pourableState).toEqual([[0, 1, 1], [2, 1], []]);
  });

  test("成立しない注水では盤面を返さないこと", () => {
    const result = applyWaterSortMove(illegalState, move);

    expect(result).toBeNull();
  });
});

describe("listWaterSortLegalMoves", () => {
  const completedBottleState: WaterSortState = [[0, 0, 0, 0], []];
  const mixedState: WaterSortState = [[0, 1], [1], [], [2, 2, 2, 2]];

  test("完成済みボトルから空ボトルへの注水もゲームルール上は合法とすること", () => {
    const result = listWaterSortLegalMoves(completedBottleState);

    expect(result).toContainEqual({
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });
  });

  test("盤面から成立する注水だけを列挙すること", () => {
    const result = listWaterSortLegalMoves(mixedState);

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
  const clearedState: WaterSortState = [[0, 0, 0, 0], [1, 1, 1, 1], [], []];
  const unfinishedState: WaterSortState = [[0, 0, 0], [1, 1, 1, 1], []];

  test("空または容量4の単色ボトルだけならクリアと判定すること", () => {
    const result = isWaterSortCleared(clearedState);

    expect(result).toBe(true);
  });

  test("未完成のボトルが残っていればクリアと判定しないこと", () => {
    const result = isWaterSortCleared(unfinishedState);

    expect(result).toBe(false);
  });
});

describe("createWaterSortStateKey", () => {
  const first: WaterSortState = [[0, 1], [], [2, 2]];
  const second: WaterSortState = [[2, 2], [0, 1], []];

  test("ボトルの並び順だけが異なる盤面を同じ状態として扱うこと", () => {
    const firstKey = createWaterSortStateKey(first);
    const secondKey = createWaterSortStateKey(second);

    expect(firstKey).toBe(secondKey);
  });
});

describe("isStandardWaterSortInitialState", () => {
  const standardState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];
  const invalidColorCountState: WaterSortState = [
    [0, 1, 0, 1],
    [1, 0, 1, 1],
    [],
    [],
  ];
  const colorCount = 2;

  test("各色4単位の満杯ボトルと空ボトル2本を受け入れること", () => {
    const result = isStandardWaterSortInitialState(standardState, colorCount);

    expect(result).toBe(true);
  });

  test("色の個数が容量と一致しない盤面を拒否すること", () => {
    const result = isStandardWaterSortInitialState(
      invalidColorCountState,
      colorCount,
    );

    expect(result).toBe(false);
  });
});

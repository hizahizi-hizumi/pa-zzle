import type { CollectionGame } from "@/collection/collection";
import {
  getCollectionTowerScale,
  getCollectionTowerTiles,
} from "@/collection/ui/CollectionScreen/CollectionTowers/tower-tiles";

const fullGame: CollectionGame = {
  id: "alpha",
  total: 2,
  counts: { clear: 0, good: 1, great: 0, perfect: 1 },
  difficulties: [],
};
const singleGame: CollectionGame = {
  ...fullGame,
  total: 1,
  counts: { clear: 0, good: 0, great: 0, perfect: 1 },
};
const emptyGame: CollectionGame = {
  ...fullGame,
  total: 0,
  counts: { clear: 0, good: 0, great: 0, perfect: 0 },
};

describe("getCollectionTowerTiles", () => {
  test("小片数を固定してゲーム間の高さを比較できること", () => {
    const tiles = getCollectionTowerTiles(fullGame, 2, 28);

    expect(tiles).toHaveLength(28);
    expect(tiles.filter(({ level }) => level !== null)).toHaveLength(28);
    expect(tiles.some(({ level }) => level === "perfect")).toBe(true);
  });

  test("問題が無いときは塗らず1問のゲームは少なくとも1片を塗ること", () => {
    const emptyTiles = getCollectionTowerTiles(emptyGame, 200, 28);
    const singleTiles = getCollectionTowerTiles(singleGame, 200, 28);

    expect(emptyTiles.every(({ level }) => level === null)).toBe(true);
    expect(singleTiles.filter(({ level }) => level !== null)).toHaveLength(1);
  });
});

describe("getCollectionTowerScale", () => {
  const cases = [
    [1, 10],
    [10, 10],
    [26, 50],
  ] as const;

  test.each(cases)(
    "最も多いゲームが %i 問なら、上端を %i 問にすること",
    (maxCount, expected) => {
      const scale = getCollectionTowerScale(maxCount);

      expect(scale).toBe(expected);
    },
  );
});

describe("最も多いゲームが1問だけの場合", () => {
  const scale = getCollectionTowerScale(1);

  test("塔を満杯にせず、上端の節目に対する高さで塗ること", () => {
    const tiles = getCollectionTowerTiles(singleGame, scale, 28);

    expect(tiles.filter(({ level }) => level !== null)).toHaveLength(3);
  });
});

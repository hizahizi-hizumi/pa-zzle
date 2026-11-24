import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import {
  findMagicSquareReading,
  listMagicSquareAlternativeReadings,
  listMagicSquareReadingCombinations,
  magicSquareReadingParts,
} from "@/games/magic-square/problem/generation/reading-parts";
import { hashProblemSeed } from "@/games/problem-seed";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py（版 8）の AGREE と
// agree_combos(AGREE, 3, merge=True, dedupe=True)。組み合わせの並びは、名前を `,` でつないだ文字列の FNV-1a で持つ。

describe("magicSquareReadingParts", () => {
  test("調査コードと同じ34の部品が同じ並びであること", () => {
    const ids = magicSquareReadingParts.map(({ id }) => id);

    expect(ids).toEqual(reference.parts);
  });
});

describe("listMagicSquareReadingCombinations", () => {
  test("調査コードと同じ 5,473 通りの組み合わせが同じ並びであること", () => {
    const ids = listMagicSquareReadingCombinations().map(({ id }) => id);

    expect({
      count: ids.length,
      digest: hashProblemSeed(ids.join(",")).toString(16).padStart(8, "0"),
    }).toEqual(reference.combinations);
  });

  describe("除く組み合わせ", () => {
    const excluded = [
      // 列の上下限を段1からと、違反の上限を段2から: 同じ設定に違う値が入る。
      "range1+viol2",
      // strong は range1 を含むので、足しても設定が変わらない。
      "range1+strong",
      // 段1からと段2からのメモの上下限は低い方を採り、mrange1 と同じになる。
      "mrange2+mrange1",
    ];

    test("重ねられない組と、部品の1つと設定が変わらない組を含まないこと", () => {
      const ids = new Set(
        listMagicSquareReadingCombinations().map(({ id }) => id),
      );

      expect(excluded.filter((id) => ids.has(id))).toEqual([]);
    });
  });
});

describe("listMagicSquareAlternativeReadings", () => {
  test("部品の後に組み合わせが続くこと", () => {
    const readings = listMagicSquareAlternativeReadings();

    expect({
      count: readings.length,
      first: readings[0]?.id,
      afterParts: readings[magicSquareReadingParts.length]?.id,
    }).toEqual({
      count: magicSquareReadingParts.length + reference.combinations.count,
      first: "carry",
      afterParts: "carry+lock_all",
    });
  });
});

describe("findMagicSquareReading", () => {
  const cases = [
    [
      "組が K 通りまでの近道は大きい方を採ること",
      "short3_1+short3_3",
      { short3Sets: 3 },
    ],
    ["メモの上下限は低い段からを採ること", "mrange2+mrange1", { mrange: 1 }],
    [
      "同じ値の設定はそのまま重ねること",
      "strong+jointk2_s2",
      {
        bounds: "range",
        boundsTier: 1,
        short3Sets: 2,
        jointk: 2,
        count: "carry",
        lockScope: "all",
        shortJointSets: 2,
      },
    ],
  ] as const;

  test.each(cases)("%s", (_, id, expected) => {
    const result = findMagicSquareReading(id);

    expect(result).toEqual({ id, options: expected });
  });

  describe("同じ設定に違う値が入る組の場合", () => {
    const id = "range1+viol2";

    test("null を返すこと", () => {
      const result = findMagicSquareReading(id);

      expect(result).toBeNull();
    });
  });
});

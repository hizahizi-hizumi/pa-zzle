import { _private } from "@/games/tsume-shogi/ui/TsumeShogiPlay/sound-takes";

const { pickTakeIndex } = _private;

const RANDOM_VALUES = [0, 0.2, 0.34, 0.5, 0.67, 0.99];

describe("pickTakeIndex", () => {
  describe("直前のテイクが無い場合", () => {
    const takeCount = 3;

    test("すべてのテイクから選ぶこと", () => {
      const picked = RANDOM_VALUES.map(function pickFirstTake(random) {
        return pickTakeIndex(takeCount, null, random);
      });

      expect(new Set(picked)).toEqual(new Set([0, 1, 2]));
    });
  });

  describe("直前のテイクがある場合", () => {
    const cases = [
      [3, 0, [1, 2]],
      [3, 1, [0, 2]],
      [3, 2, [0, 1]],
      [2, 0, [1]],
      [2, 1, [0]],
    ] as const;

    test.each(cases)(
      "%i 本のうち %i 番を続けず、残りのテイクから選ぶこと",
      (takeCount, previousIndex, others) => {
        const picked = RANDOM_VALUES.map(function pickNextTake(random) {
          return pickTakeIndex(takeCount, previousIndex, random);
        });

        expect(new Set(picked)).toEqual(new Set(others));
      },
    );
  });

  describe("テイクが1本だけの場合", () => {
    const takeCount = 1;
    const previousIndex = 0;

    test("同じテイクを続けて選ぶこと", () => {
      const picked = pickTakeIndex(takeCount, previousIndex, 0.5);

      expect(picked).toBe(0);
    });
  });
});

import {
  createFukumenzanColumnModel,
  createInitialDomains,
} from "@/games/fukumenzan/problem/generation/column-model";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";

describe("createFukumenzanColumnModel", () => {
  describe("答えが足す数より1桁長い場合", () => {
    // 文字は B Y K T H の順。百の位は B＋K＋繰り上がり＝K＋10×T と読む。
    const model = createFukumenzanColumnModel(
      parseFukumenzanEquation("BYK+KTK=TKHH")!,
    );

    test("答えの先頭の文字を、最上位の足す桁の左への繰り上がりとして読むこと", () => {
      const top = model.columns.at(-1)!;

      expect({
        columnCount: model.columnCount,
        topCarryOut: top.carryOutVariable,
        topLetters: [...model.columnLetters.at(-1)!].toSorted(),
      }).toEqual({ columnCount: 3, topCarryOut: 3, topLetters: [0, 2, 3] });
    });

    test("一の位に入る繰り上がりを0に、途中の繰り上がりを0か1にすること", () => {
      const domains = createInitialDomains(model);

      expect(domains.slice(model.letterCount)).toEqual([0b1, 0b11, 0b11]);
    });

    test("2つの足し算では答えの先頭の文字を1から始めること", () => {
      const domains = createInitialDomains(model);

      expect(domains[3]).toBe(0b10);
    });
  });

  test("3つの足し算では答えの先頭の文字を1か2から始めること", () => {
    // 文字は N Y B C M の順。答えの先頭は C。
    const model = createFukumenzanColumnModel(
      parseFukumenzanEquation("NNY+YBC+NNY=CCMY")!,
    );

    expect(createInitialDomains(model)[3]).toBe(0b110);
  });

  describe("答えが足す数と同じ桁の場合", () => {
    const model = createFukumenzanColumnModel(
      parseFukumenzanEquation("AB+BA=CC")!,
    );

    test("最上位から出る繰り上がりを0に決めること", () => {
      const domains = createInitialDomains(model);
      const topCarryOut = model.columns.at(-1)!.carryOutVariable;

      expect(domains[topCarryOut]).toBe(0b1);
    });
  });
});

import {
  createFukumenzanColumnModel,
  createInitialDomains,
  digitsOfMask,
} from "@/games/fukumenzan/problem/generation/column-model";
import {
  createFukumenzanReader,
  type FukumenzanReaderSettings,
  readFukumenzanColumn,
} from "@/games/fukumenzan/problem/generation/column-readers";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";

const boundsSettings: FukumenzanReaderSettings = {
  column: { kind: "bounds-when-many", tupleLimit: 4 },
  hiddenSingles: false,
  nakedSubsets: false,
  adjacentPairs: null,
  adjacentTriples: null,
  sharedLetterPairs: null,
  separatedTriples: null,
  pairProductLimit: null,
  equations: null,
};

describe("readFukumenzanColumn", () => {
  describe("和の大きさで読む桁の場合", () => {
    // 文字は G M V Y U B X の順。最上位は G＋Y＋繰り上がり＝X＋10×U で、X は先頭でないので0にもなる。
    const model = createFukumenzanColumnModel(
      parseFukumenzanEquation("GMVG+YVUB+VUU=UXVBU")!,
    );
    const reader = createFukumenzanReader(model, boundsSettings);

    test("違う文字の和を違う数字で取り、9＋8＋2＝19 から答えの先頭を1に決めること", () => {
      const facts = readFukumenzanColumn(
        reader,
        model.columnCount - 1,
        createInitialDomains(model),
      );

      expect(digitsOfMask[facts![4]!]).toEqual([1]);
    });
  });
});

import {
  findTsumeShogiLongestResistance,
  findTsumeShogiRefutation,
  isTsumeShogiMateWithin,
  TsumeShogiMateSearch,
} from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  isTsumeShogiLegalMove,
  listTsumeShogiAttackerChecks,
  parseTsumeShogiMoveUsi,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  type TsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiSearchPosition } from "@/games/tsume-shogi/puzzle/search-position";

function play(position: TsumeShogiPosition, ...usiMoves: string[]) {
  return usiMoves.reduce(function applyUsi(current, usi) {
    return applyTsumeShogiMove(current, parseTsumeShogiMoveUsi(usi));
  }, position);
}

/** 3手詰: ▲3三銀打 △3一玉 ▲2二龍。 */
const threePly = createTsumeShogiPosition("5s3/6k2/9/5P1+R1/9/9/9/9/9", {
  silver: 1,
});

/** 5手詰: ▲3二銀成 △1一玉 ▲1二歩打 △同玉 ▲1三香打。 */
const fivePly = createTsumeShogiPosition("7k1/9/5S3/8+B/5P3/9/9/9/9", {
  lance: 1,
  pawn: 1,
});

describe("isTsumeShogiMateWithin", () => {
  const cases = [
    ["3手詰を1手以内", threePly, 1, false],
    ["3手詰を3手以内", threePly, 3, true],
    ["3手詰を5手以内", threePly, 5, true],
    ["5手詰を3手以内", fivePly, 3, false],
    ["5手詰を5手以内", fivePly, 5, true],
    ["正解の初手の後を残り4手以内", play(fivePly, "4c3b+"), 4, true],
    ["正解の初手の後を残り2手以内", play(fivePly, "4c3b+"), 2, false],
    ["詰め上がり", play(threePly, "S*3c", "3b3a", "2d2b"), 0, true],
  ] as const;

  test.each(cases)(
    "%sで詰むかを判定すること",
    (_, position, plies, expected) => {
      const mates = isTsumeShogiMateWithin(position, plies);

      expect(mates).toBe(expected);
    },
  );
});

describe("findTsumeShogiRefutation", () => {
  describe("正解ではない王手の後", () => {
    const wrongChecks = listTsumeShogiAttackerChecks(fivePly)
      .map(formatTsumeShogiMoveUsi)
      .filter(function isWrong(usi) {
        return usi !== "4c3b+";
      })
      .map(function toCase(usi) {
        return [usi, play(fivePly, usi)] as const;
      });

    test.each(wrongChecks)(
      "%s の後、残りの手数以内に詰まなくなる玉方の応手を返すこと",
      (_, afterCheck) => {
        const refutation = findTsumeShogiRefutation(afterCheck, 4);

        expect(refutation).not.toBeNull();
        expect(isTsumeShogiLegalMove(afterCheck, refutation!)).toBe(true);
        expect(
          isTsumeShogiMateWithin(
            applyTsumeShogiMove(afterCheck, refutation!),
            3,
          ),
        ).toBe(false);
      },
    );
  });

  describe("正解の王手の後", () => {
    const afterCheck = play(fivePly, "4c3b+");

    test("null を返すこと", () => {
      const refutation = findTsumeShogiRefutation(afterCheck, 4);

      expect(refutation).toBeNull();
    });
  });

  describe("攻方の手番", () => {
    test("RangeError を投げること", () => {
      const act = () => findTsumeShogiRefutation(fivePly, 4);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("findTsumeShogiLongestResistance", () => {
  describe("詰む王手の後", () => {
    const afterCheck = play(fivePly, "4c3b+");

    test("詰むまでの手数が最も長い玉方の応手を返すこと", () => {
      const response = findTsumeShogiLongestResistance(afterCheck, 4);

      expect(formatTsumeShogiMoveUsi(response!)).toBe("2a1a");
    });
  });

  describe("詰まない王手の後", () => {
    const afterCheck = play(fivePly, "4c3b");

    test("null を返すこと", () => {
      const response = findTsumeShogiLongestResistance(afterCheck, 4);

      expect(response).toBeNull();
    });
  });

  describe("詰め上がり", () => {
    const mated = play(threePly, "S*3c", "3b3a", "2d2b");

    test("応手が無いので null を返すこと", () => {
      const response = findTsumeShogiLongestResistance(mated, 0);

      expect(response).toBeNull();
    });
  });
});

describe("TsumeShogiMateSearch", () => {
  describe("合駒の扱い", () => {
    // 1一玉・1二歩（玉方）、3三桂・2三金（攻方）。▲3一飛打には2一への合駒があり、合駒は▲同飛で詰む無駄合。
    const position = createTsumeShogiPosition("8k/8p/6NG1/9/9/9/9/9/9", {
      rook: 1,
    });
    const afterDistantCheck = play(position, "R*3a");
    const cases = [
      ["counted", false],
      ["ignored", true],
    ] as const;

    test.each(cases)(
      "%s の規則で、合駒のある王手を1手詰とするかを決めること",
      (rule, expected) => {
        const search = new TsumeShogiMateSearch(rule);

        const mates = search.isMateWithin(
          new TsumeShogiSearchPosition(afterDistantCheck),
          0,
        );

        expect(mates).toBe(expected);
      },
    );
  });

  describe("findShortestMate", () => {
    const cases = [
      ["3手詰", threePly, 3],
      ["5手詰", fivePly, 5],
    ] as const;

    test.each(cases)("%sの最短手数を返すこと", (_, position, expected) => {
      const search = new TsumeShogiMateSearch();

      const plies = search.findShortestMate(
        new TsumeShogiSearchPosition(position),
        7,
      );

      expect(plies).toBe(expected);
    });
  });
});

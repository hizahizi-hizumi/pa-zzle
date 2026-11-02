import { validateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generation/validator";
import { createTsumeShogiPosition } from "@/games/tsume-shogi/puzzle/position";

/** 1手詰: ▲5二金打。 */
const onePly = createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", { gold: 1 });

/** 3手詰: ▲3三銀打 △3一玉 ▲2二龍。 */
const threePly = createTsumeShogiPosition("5s3/6k2/9/5P1+R1/9/9/9/9/9", {
  silver: 1,
});

/**
 * ▲3二飛打 △4一玉 ▲3一飛打 の3手詰。最終手は ▲4二飛打 など離れた飛打ちでも王手になり、合駒を逃れに数えなければ詰む。
 */
const threePlyWithDistantChecks = createTsumeShogiPosition(
  "6kS1/7L1/9/9/9/9/9/9/9",
  { rook: 2 },
);

/** 5手詰: ▲1二歩打 △同玉 ▲2四桂 △1三玉 ▲1二飛打。4手目は △1一玉でも同じ手数で詰む（変化同手数）。 */
const fivePly = createTsumeShogiPosition("8k/6S2/8B/7r1/6G2/8N/9/9/9", {
  pawn: 1,
});

/**
 * ▲3二銀成 △1一玉 ▲1二歩打 △同玉 ▲1三香打 の5手詰。初手の ▲3二馬・▲3二銀不成・▲2二歩打も、合駒を逃れに数えなければ5手以内に詰む。
 */
const fivePlyWithDistantChecks = createTsumeShogiPosition(
  "7k1/9/5S3/8+B/5P3/9/9/9/9",
  { lance: 1, pawn: 1 },
);

/** 金1枚だけでは詰まない。 */
const noMate = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", { gold: 1 });

/** 1手詰（▲5二金打）だが、持駒の銀が余る。 */
const leftover = createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", {
  gold: 1,
  silver: 1,
});

/** ▲1二金打でも、3四桂に支えられた ▲2二金打でも詰む。 */
const alternativeOnFirstTurn = createTsumeShogiPosition(
  "8k/9/8P/6N2/9/9/9/9/9",
  { gold: 1 },
);

/** ▲3一と △1一玉 の後、▲1二金打・▲2一金打・▲2二金打のどれでも詰む。 */
const alternativeOnLastTurn = createTsumeShogiPosition(
  "7k1/5+RP2/9/9/4G4/9/9/9/9",
  { gold: 1 },
);

/** ▲2一飛打で詰む。▲3一飛打も、2一への合駒を ▲同飛と取れば詰むので、無駄合を数えなければ詰む。 */
const futileInterposition = createTsumeShogiPosition("8k/8p/6NG1/9/9/9/9/9/9", {
  rook: 1,
});

/**
 * ▲6三角成 △5一玉 ▲4一飛打 の3手詰。2手目の △6一玉 も3手で詰むが、合駒を逃れに数えると駒余りになるので作意は △5一玉。
 * 合駒を逃れに数えなければ △6一玉 ▲8一飛打 も駒余りにならず、作意が入れ替わる。
 */
const mainLineSwapsIgnoringInterposition = createTsumeShogiPosition(
  "4B4/4k4/2Gr1g3/9/5B3/9/9/9/9",
  {},
);

/** ▲3三角打 △2二飛打 ▲同角成 の3手詰。作意に玉方の合駒が現れる。 */
const interpositionInMainLine = createTsumeShogiPosition(
  "8k/8s/9/7L1/9/9/9/9/9",
  { bishop: 1, knight: 1, lance: 1 },
);

describe("validateTsumeShogiProblem", () => {
  describe("判定と品質の状態", () => {
    const cases = [
      ["1手詰", onePly, 1, "accepted", []],
      ["3手詰", threePly, 3, "accepted", []],
      ["5手詰", fivePly, 5, "accepted", ["equalLengthVariation"]],
      ["不詰", noMate, 3, "invalid", ["noMate"]],
      ["1手で詰む局面を3手詰として", onePly, 3, "invalid", ["prematureMate"]],
      ["3手で詰む局面を5手詰として", threePly, 5, "invalid", ["prematureMate"]],
      ["駒余り", leftover, 1, "invalid", ["leftoverPieces"]],
      [
        "初手の余詰",
        alternativeOnFirstTurn,
        1,
        "invalid",
        ["mainLineAlternative"],
      ],
      [
        "最終手の余詰",
        alternativeOnLastTurn,
        3,
        "invalid",
        ["mainLineAlternative"],
      ],
      [
        "無駄合を数えないと余詰",
        futileInterposition,
        1,
        "unsupported",
        ["interpositionSensitive", "longerVariationSensitive"],
      ],
      [
        "合駒を数えないと最終手が余詰の3手詰",
        threePlyWithDistantChecks,
        3,
        "unsupported",
        ["interpositionSensitive"],
      ],
      [
        "合駒を数えないと初手が余詰の5手詰",
        fivePlyWithDistantChecks,
        5,
        "unsupported",
        ["interpositionSensitive"],
      ],
      [
        "合駒を数えないと作意が入れ替わる3手詰",
        mainLineSwapsIgnoringInterposition,
        3,
        "unsupported",
        ["interpositionSensitive", "equalLengthVariation"],
      ],
    ] as const;

    test.each(cases)(
      "%sを判定すること",
      (_, position, plies, expectedVerdict, expectedIssues) => {
        const validation = validateTsumeShogiProblem(position, plies);

        expect(validation.verdict).toBe(expectedVerdict);
        expect(validation.issues).toEqual(expectedIssues);
      },
    );
  });

  describe("作意線上の余詰の位置", () => {
    test("余詰のある攻方の手番で詰む王手の数を返すこと", () => {
      const validation = validateTsumeShogiProblem(alternativeOnLastTurn, 3);

      expect(validation.mainLine?.attackerTurns).toEqual([
        { matingCheckCount: 1 },
        { matingCheckCount: 3 },
      ]);
    });
  });

  describe("作意に玉方の合駒が現れる局面", () => {
    test("合駒の状態を返すこと", () => {
      const validation = validateTsumeShogiProblem(interpositionInMainLine, 3);

      expect(validation.issues).toContain("interpositionInMainLine");
      expect(validation.mainLine?.hasDefenderInterposition).toBe(true);
      expect(validation.verdict).not.toBe("accepted");
    });
  });

  describe("偶数の手数", () => {
    test("RangeError を投げること", () => {
      const act = () => validateTsumeShogiProblem(threePly, 4);

      expect(act).toThrow(RangeError);
    });
  });
});

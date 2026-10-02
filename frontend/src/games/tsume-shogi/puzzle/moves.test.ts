import {
  applyTsumeShogiMove,
  explainTsumeShogiIllegalMove,
  formatTsumeShogiMoveUsi,
  isTsumeShogiCheckmate,
  isTsumeShogiDefenderInCheck,
  isTsumeShogiLegalMove,
  listTsumeShogiAttackerChecks,
  listTsumeShogiDefenderResponses,
  listTsumeShogiLegalMoves,
  parseTsumeShogiMoveUsi,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  getTsumeShogiHand,
  getTsumeShogiSideToMove,
  type TsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";

function play(position: TsumeShogiPosition, ...usiMoves: string[]) {
  return usiMoves.reduce(function applyUsi(current, usi) {
    return applyTsumeShogiMove(current, parseTsumeShogiMoveUsi(usi));
  }, position);
}

function toSortedUsi(moves: readonly TsumeShogiMove[]): string[] {
  return moves.map(formatTsumeShogiMoveUsi).sort();
}

describe("parseTsumeShogiMoveUsi", () => {
  const validCases = [
    [
      "7g7f",
      {
        kind: "board",
        from: { file: 7, rank: 7 },
        to: { file: 7, rank: 6 },
        promote: false,
      },
    ],
    [
      "8h2b+",
      {
        kind: "board",
        from: { file: 8, rank: 8 },
        to: { file: 2, rank: 2 },
        promote: true,
      },
    ],
    ["G*5b", { kind: "drop", pieceType: "gold", to: { file: 5, rank: 2 } }],
  ] as const;
  const invalidCases = ["", "7g7", "0a1b", "K*5b", "G*5b+", "7g7f+x", "g*5b"];

  test.each(validCases)("%s を着手として読むこと", (usi, expected) => {
    const move = parseTsumeShogiMoveUsi(usi);

    expect(move).toEqual(expected);
    expect(formatTsumeShogiMoveUsi(move)).toBe(usi);
  });

  test.each(invalidCases)("%s を拒否すること", (usi) => {
    const act = () => parseTsumeShogiMoveUsi(usi);

    expect(act).toThrow(RangeError);
  });
});

describe("二歩", () => {
  // 攻方の歩が5筋、攻方のと金が3筋、玉方の歩が1筋にある。
  const position = createTsumeShogiPosition("4k4/9/8p/9/9/9/4P1+P2/9/9", {
    pawn: 1,
  });
  const defenderToMove = play(position, "5g5f");
  const cases = [
    ["攻方が歩のある筋に打つ", "P*5c", false, position],
    ["攻方がと金だけの筋に打つ", "P*3c", true, position],
    ["攻方が歩の無い筋に打つ", "P*4c", true, position],
    ["玉方が駒箱の歩を歩のある筋に打つ", "P*1e", false, defenderToMove],
    ["玉方が駒箱の歩を歩の無い筋に打つ", "P*2e", true, defenderToMove],
  ] as const;

  test.each(cases)(
    "%s手（%s）の合法性を判定すること",
    (_, usi, expected, current) => {
      const legal = isTsumeShogiLegalMove(current, parseTsumeShogiMoveUsi(usi));

      expect(legal).toBe(expected);
    },
  );
});

describe("行き所のない駒と成・不成", () => {
  const position = createTsumeShogiPosition(
    "4k4/P8/2N6/1L3S3/2N6/3G1S3/9/9/9",
    { pawn: 1, lance: 1, knight: 1 },
  );
  const cases = [
    ["歩が1段目へ成らずに進む", "9b9a", false],
    ["歩が1段目へ成って進む", "9b9a+", true],
    ["香が1段目へ成らずに進む", "8d8a", false],
    ["香が1段目へ成って進む", "8d8a+", true],
    ["香が2段目へ成らずに進む", "8d8b", true],
    ["香が2段目へ成って進む", "8d8b+", true],
    ["桂が1段目へ成らずに跳ぶ", "7c8a", false],
    ["桂が1段目へ成って跳ぶ", "7c8a+", true],
    ["桂が3段目へ成らずに跳ぶ", "7e8c", true],
    ["桂が3段目へ成って跳ぶ", "7e6c+", true],
    ["歩を1段目に打つ", "P*1a", false],
    ["香を1段目に打つ", "L*1a", false],
    ["桂を2段目に打つ", "N*1b", false],
    ["桂を3段目に打つ", "N*1c", true],
    ["歩を2段目に打つ", "P*1b", true],
    ["銀が敵陣へ成らずに入る", "4d4c", true],
    ["銀が敵陣へ成って入る", "4d4c+", true],
    ["銀が敵陣の外で成る", "4f4e+", false],
    ["金が敵陣の外で動く", "6f6e", true],
    ["金が成る", "6f5e+", false],
  ] as const;

  test.each(cases)("%s手（%s）の合法性を判定すること", (_, usi, expected) => {
    const legal = isTsumeShogiLegalMove(position, parseTsumeShogiMoveUsi(usi));

    expect(legal).toBe(expected);
  });

  test("listTsumeShogiLegalMoves は成れる手を成・不成の2手として並べること", () => {
    const moves = toSortedUsi(listTsumeShogiLegalMoves(position)).filter(
      function startsFromLance(usi) {
        return usi.startsWith("8d");
      },
    );

    expect(moves).toEqual(["8d8a+", "8d8b", "8d8b+", "8d8c", "8d8c+"]);
  });
});

describe("打歩詰", () => {
  describe("玉の逃げ道が無く、打った歩を取れない場合", () => {
    // 玉1一。2三の金が1二・2二を、3三の桂が2一を押さえる。
    const position = createTsumeShogiPosition("8k/9/6NG1/9/9/9/9/9/9", {
      pawn: 1,
    });

    test("歩を打って詰ませる手を合法手にしないこと", () => {
      const legal = isTsumeShogiLegalMove(
        position,
        parseTsumeShogiMoveUsi("P*1b"),
      );

      expect(legal).toBe(false);
    });

    test("王手の一覧に歩を打って詰ませる手を含めないこと", () => {
      const checks = toSortedUsi(listTsumeShogiAttackerChecks(position));

      expect(checks).not.toContain("P*1b");
    });
  });

  describe("玉に逃げ道がある場合", () => {
    // 桂が無いので、玉は2一へ逃げられる。
    const position = createTsumeShogiPosition("8k/9/7G1/9/9/9/9/9/9", {
      pawn: 1,
    });

    test("歩を打つ王手を合法手にすること", () => {
      const checks = toSortedUsi(listTsumeShogiAttackerChecks(position));

      expect(checks).toContain("P*1b");
    });
  });

  describe("盤上の歩を突いて詰ませる場合", () => {
    const position = createTsumeShogiPosition("8k/9/6NGP/9/9/9/9/9/9", {});

    test("突き歩詰は合法手で、詰みになること", () => {
      const mated = play(position, "1c1b");
      const checkmate = isTsumeShogiCheckmate(mated);

      expect(checkmate).toBe(true);
    });
  });
});

describe("explainTsumeShogiIllegalMove", () => {
  // 玉1一、攻方の金2三・桂3三・歩5七・香8四・桂7五・銀4六。持駒は歩・香・桂。
  const position = createTsumeShogiPosition("8k/9/6NG1/1L7/2N6/5S3/4P4/9/9", {
    pawn: 1,
    lance: 1,
    knight: 1,
  });
  const cases = [
    ["合法手", "4f4e", null],
    ["歩のある筋に歩を打つ", "P*5c", "double-pawn"],
    ["歩を打って詰ませる", "P*1b", "pawn-drop-mate"],
    ["桂を2段目に打つ", "N*5b", "dead-piece"],
    ["香を1段目に打つ", "L*5a", "dead-piece"],
    ["香が1段目へ成らずに進む", "8d8a", "dead-piece"],
    ["桂が駒の動きで届かない升へ動く", "7e7d", "unreachable"],
    ["駒のある升に打つ", "P*2c", "unreachable"],
    ["銀が敵陣の外で成る", "4f4e+", "unreachable"],
  ] as const;

  test.each(cases)("%s手（%s）の理由を返すこと", (_, usi, expected) => {
    const reason = explainTsumeShogiIllegalMove(
      position,
      parseTsumeShogiMoveUsi(usi),
    );

    expect(reason).toBe(expected);
  });

  describe("持駒に無い駒を打つ場合", () => {
    const withoutHand = createTsumeShogiPosition(
      "8k/9/6NG1/1L7/2N6/5S3/4P4/9/9",
      {},
    );
    const dropCases = [
      ["歩のある筋への歩", "P*5c"],
      ["2段目への桂", "N*5b"],
    ] as const;

    test.each(dropCases)(
      "%s（%s）も、駒が無いので打てない理由を返すこと",
      (_, usi) => {
        const reason = explainTsumeShogiIllegalMove(
          withoutHand,
          parseTsumeShogiMoveUsi(usi),
        );

        expect(reason).toBe("unreachable");
      },
    );
  });
});

describe("listTsumeShogiAttackerChecks", () => {
  describe("玉5一だけの盤面で攻方が金を持つ場合", () => {
    const position = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", {
      gold: 1,
    });

    test("玉に利く5か所への金打ちだけを王手として返すこと", () => {
      const checks = toSortedUsi(listTsumeShogiAttackerChecks(position));

      expect(checks).toEqual(["G*4a", "G*4b", "G*5b", "G*6a", "G*6b"]);
    });
  });

  describe("開き王手", () => {
    // 5九の飛の利きを5五の銀が遮っている。
    const position = createTsumeShogiPosition("4k4/9/9/9/4S4/9/9/9/4R4", {});

    test("飛の筋から外れる銀の手だけを王手として返すこと", () => {
      const checks = toSortedUsi(listTsumeShogiAttackerChecks(position));

      expect(checks).toEqual(["5e4d", "5e4f", "5e6d", "5e6f"]);
    });
  });

  describe("玉方の手番", () => {
    const position = play(
      createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", { gold: 1 }),
      "G*5b",
    );

    test("攻方の手番でないことを拒否すること", () => {
      const act = () => listTsumeShogiAttackerChecks(position);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("listTsumeShogiDefenderResponses", () => {
  describe("両王手", () => {
    // 5五の桂が4三へ跳ぶと、桂の王手と5九の飛の開き王手が同時にかかる。4二の金は桂を取れるが、飛の王手が残る。
    const position = play(
      createTsumeShogiPosition("4k4/5g3/9/9/4N4/9/9/9/4R4", {}),
      "5e4c",
    );

    test("玉が逃げる手だけを応手として返すこと", () => {
      const responses = toSortedUsi(listTsumeShogiDefenderResponses(position));

      expect(responses).toEqual(["5a4a", "5a6a", "5a6b"]);
    });
  });

  describe("飛の王手を合駒・駒取り・逃げで受けられる場合", () => {
    // 攻方が金を4枚持つので、駒箱に金は無い。4四の玉方の銀は5五の飛を取れる。
    const position = play(
      createTsumeShogiPosition("4k4/9/9/5s3/3R5/9/9/9/9", { gold: 4 }),
      "6e5e",
    );
    const expectedResponses = [
      ["玉の逃げ", "5a4a"],
      ["玉の逃げ", "5a4b"],
      ["玉の逃げ", "5a6a"],
      ["玉の逃げ", "5a6b"],
      ["王手した飛を取る手", "4d5e"],
      ["盤上の銀の合駒", "4d5c"],
      ["駒箱の歩の合駒", "P*5d"],
      ["駒箱の飛の合駒", "R*5b"],
      ["駒箱の銀の合駒", "S*5c"],
    ] as const;

    test.each(expectedResponses)("%s（%s）を含むこと", (_, usi) => {
      const responses = toSortedUsi(listTsumeShogiDefenderResponses(position));

      const included = responses.includes(usi);

      expect(included).toBe(true);
    });

    test("駒箱に無い金の合駒を含まないこと", () => {
      const responses = toSortedUsi(listTsumeShogiDefenderResponses(position));

      const goldDrops = responses.filter(function isGoldDrop(usi) {
        return usi.startsWith("G*");
      });

      expect(goldDrops).toEqual([]);
    });

    test("王手を受けない手と玉が飛の筋へ逃げる手を含まないこと", () => {
      const responses = toSortedUsi(listTsumeShogiDefenderResponses(position));

      expect(responses).not.toContain("4d4e");
      expect(responses).not.toContain("5a5b");
    });
  });

  describe("攻方の手番", () => {
    const position = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", {});

    test("玉方の手番でないことを拒否すること", () => {
      const act = () => listTsumeShogiDefenderResponses(position);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("自玉への王手の放置", () => {
  // 5二の玉方の金は、5五へ出た飛と玉の間に挟まって動けない筋がある。
  const position = play(
    createTsumeShogiPosition("4k4/4g4/9/9/9/9/9/9/4R4", {}),
    "5i5e",
  );
  const cases = [
    ["ピンされた金が筋を外れる", "5b4b", false],
    ["ピンされた金が斜めに外れる", "5b4c", false],
    ["ピンされた金が筋に沿って進む", "5b5c", true],
    ["玉が利きの無いマスへ動く", "5a4a", true],
  ] as const;

  test.each(cases)("%s手（%s）の合法性を判定すること", (_, usi, expected) => {
    const legal = isTsumeShogiLegalMove(position, parseTsumeShogiMoveUsi(usi));

    expect(legal).toBe(expected);
  });
});

describe("applyTsumeShogiMove", () => {
  describe("玉方が王手した金を取る場合", () => {
    const position = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", {
      gold: 1,
    });

    test("取った金を玉方の持駒（駒箱）へ加えること", () => {
      const next = play(position, "G*5b", "5a5b");

      expect(getTsumeShogiHand(next, "defender").gold).toBe(4);
      expect(getTsumeShogiHand(next, "attacker").gold).toBe(0);
      expect(getTsumeShogiSideToMove(next)).toBe("attacker");
    });
  });

  describe("攻方が成駒を取る場合", () => {
    const position = createTsumeShogiPosition("4k4/9/9/9/5+s3/9/9/9/5R3", {});

    test("取った成駒を元の駒として攻方の持駒へ加えること", () => {
      const next = play(position, "4i4e");

      expect(getTsumeShogiHand(next, "attacker").silver).toBe(1);
      expect(getTsumeShogiHand(next, "defender").silver).toBe(3);
    });
  });

  describe("合法手でない手", () => {
    const position = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", {
      gold: 1,
    });

    test("着手を拒否すること", () => {
      const act = () =>
        applyTsumeShogiMove(position, parseTsumeShogiMoveUsi("S*5b"));

      expect(act).toThrow(RangeError);
    });
  });
});

describe("isTsumeShogiCheckmate", () => {
  const withPawn = createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", {
    gold: 1,
  });
  const withoutPawn = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", {
    gold: 1,
  });
  const pinned = play(
    createTsumeShogiPosition("4k4/4g4/9/9/9/9/9/9/4R4", {}),
    "5i5e",
  );
  const cases = [
    ["歩に支えられた頭金", play(withPawn, "G*5b"), true],
    ["玉が取れる頭金", play(withoutPawn, "G*5b"), false],
    ["攻方の手番", withPawn, false],
    ["王手がかかっていない玉方の手番", pinned, false],
  ] as const;

  test.each(cases)("%s の詰みを判定すること", (_, position, expected) => {
    const mated = isTsumeShogiCheckmate(position);

    expect(mated).toBe(expected);
  });
});

describe("isTsumeShogiDefenderInCheck", () => {
  const position = createTsumeShogiPosition("4k4/9/9/9/9/9/9/9/9", {
    gold: 1,
  });
  const cases = [
    ["王手の後", play(position, "G*5b"), true],
    ["王手でない手の後", play(position, "G*5c"), false],
  ] as const;

  test.each(cases)("%s の王手を判定すること", (_, current, expected) => {
    const checked = isTsumeShogiDefenderInCheck(current);

    expect(checked).toBe(expected);
  });
});

import {
  createTsumeShogiPosition,
  findTsumeShogiDefenderKing,
  formatTsumeShogiPosition,
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  getTsumeShogiSideToMove,
  listTsumeShogiBoardPieces,
  parseTsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";

describe("createTsumeShogiPosition", () => {
  describe("玉と歩が盤上にあり、攻方が金を持つ場合", () => {
    const board = "4k4/9/4P4/9/9/9/9/9/9";
    const attackerHand = { gold: 1 };

    test("盤上と攻方の持駒以外の全駒を玉方の持駒（駒箱）にすること", () => {
      const position = createTsumeShogiPosition(board, attackerHand);

      expect(getTsumeShogiHand(position, "defender")).toEqual({
        rook: 2,
        bishop: 2,
        gold: 3,
        silver: 4,
        knight: 4,
        lance: 4,
        pawn: 17,
      });
    });

    test("攻方の手番の局面を作ること", () => {
      const position = createTsumeShogiPosition(board, attackerHand);

      expect(formatTsumeShogiPosition(position)).toBe(
        "4k4/9/4P4/9/9/9/9/9/9 b G2r2b3g4s4n4l17p 1",
      );
    });
  });

  describe("成駒がある場合", () => {
    const board = "4k4/9/9/9/9/9/9/+R8/+P8";

    test("成駒を元の駒として駒箱から除くこと", () => {
      const position = createTsumeShogiPosition(board, {});

      expect(getTsumeShogiHand(position, "defender")).toMatchObject({
        rook: 1,
        pawn: 17,
      });
    });
  });

  describe("成り立たない入力", () => {
    const cases = [
      ["一揃いより多い駒", "4k4/9/9/9/9/9/9/9/9", { rook: 3 }],
      ["負の枚数の持駒", "4k4/9/9/9/9/9/9/9/9", { pawn: -1 }],
      ["玉方の玉が無い盤面", "9/9/9/9/9/9/9/9/9", {}],
      ["攻方の玉がある盤面", "4k4/9/9/9/9/9/9/9/4K4", {}],
      ["二歩の盤面", "4k4/9/9/9/9/9/4P4/4P4/9", {}],
      ["行き所のない桂がある盤面", "4k4/N8/9/9/9/9/9/9/9", {}],
      ["玉方の玉に王手がかかっている盤面", "4k4/9/9/9/4R4/9/9/9/9", {}],
      ["SFEN として読めない盤面", "4k4", {}],
    ] as const;

    test.each(cases)("%s を拒否すること", (_, board, attackerHand) => {
      const act = () => createTsumeShogiPosition(board, attackerHand);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("parseTsumeShogiPosition", () => {
  describe("玉方の手番の局面", () => {
    const sfen = "4k4/4G4/4P4/9/9/9/9/9/9 w 2r2b3g4s4n4l17p 1";
    const sfenAtPly7 = "4k4/4G4/4P4/9/9/9/9/9/9 w 2r2b3g4s4n4l17p 7";

    test("SFEN を読み、同じ SFEN へ書き戻せること", () => {
      const position = parseTsumeShogiPosition(sfen);
      const side = getTsumeShogiSideToMove(position);
      const formatted = formatTsumeShogiPosition(position);

      expect(side).toBe("defender");
      expect(formatted).toBe(sfen);
    });

    test("手数を 1 にそろえて書き戻すこと", () => {
      const position = parseTsumeShogiPosition(sfenAtPly7);
      const formatted = formatTsumeShogiPosition(position);

      expect(formatted).toBe(sfen);
    });
  });

  describe("成り立たない入力", () => {
    const cases = [
      ["駒箱が玉方の持駒にない局面", "4k4/9/9/9/9/9/9/9/9 b - 1"],
      [
        "行き所のない玉方の歩がある局面",
        "4k4/9/9/9/9/9/9/9/p8 b 2r2b4g4s4n4l17p 1",
      ],
      ["SFEN として読めない文字列", "abc"],
    ] as const;

    test.each(cases)("%s を拒否すること", (_, sfen) => {
      const act = () => parseTsumeShogiPosition(sfen);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("局面の読み取り", () => {
  const position = createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", {
    gold: 1,
  });

  test("getTsumeShogiPieceAt はマスの駒と持ち主を返すこと", () => {
    const king = getTsumeShogiPieceAt(position, { file: 5, rank: 1 });
    const empty = getTsumeShogiPieceAt(position, { file: 5, rank: 2 });

    expect(king).toEqual({ side: "defender", type: "king" });
    expect(empty).toBeNull();
  });

  test("listTsumeShogiBoardPieces は盤上の全駒を返すこと", () => {
    const pieces = listTsumeShogiBoardPieces(position);

    expect(pieces).toEqual([
      {
        square: { file: 5, rank: 1 },
        piece: { side: "defender", type: "king" },
      },
      {
        square: { file: 5, rank: 3 },
        piece: { side: "attacker", type: "pawn" },
      },
    ]);
  });

  test("getTsumeShogiHand は攻方の持駒を返すこと", () => {
    const hand = getTsumeShogiHand(position, "attacker");

    expect(hand).toEqual({
      rook: 0,
      bishop: 0,
      gold: 1,
      silver: 0,
      knight: 0,
      lance: 0,
      pawn: 0,
    });
  });

  test("findTsumeShogiDefenderKing は玉方の玉のマスを返すこと", () => {
    const square = findTsumeShogiDefenderKing(position);

    expect(square).toEqual({ file: 5, rank: 1 });
  });
});

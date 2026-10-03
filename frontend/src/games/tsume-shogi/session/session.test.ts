import { parseTsumeShogiProblemText } from "@/games/tsume-shogi/problem/problem";
import { formatTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import {
  formatTsumeShogiPosition,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  cancelTsumeShogiSessionPromotion,
  canUndoTsumeShogiSession,
  chooseTsumeShogiSessionPromotion,
  createTsumeShogiSession,
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionPosition,
  getTsumeShogiSessionRemainingPlies,
  getTsumeShogiSessionResult,
  isTsumeShogiSessionOnWrongLine,
  playTsumeShogiSessionDefenderReply,
  replayTsumeShogiSession,
  restartTsumeShogiSession,
  returnTsumeShogiSessionToDecision,
  type TsumeShogiSession,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";

/** 3手詰: ▲2二銀打 △1二玉 ▲1三龍。2一玉・1一銀（攻方）・4三龍、攻方の持駒は銀。 */
const threePly = parseTsumeShogiProblemText({
  sfen: "7kS/9/5+R3/9/9/9/9/9/9 b Sr2b4g2s4n4l18p 1",
  mainLine: ["S*2b", "2a1b", "4c1c"],
});

/** `threePly` に、成・不成のどちらも指せる移動を持つ攻方の桂（4五）を足したもの。 */
const threePlyWithKnight = parseTsumeShogiProblemText({
  sfen: "7kS/9/5+R3/9/5N3/9/9/9/9 b Sr2b4g2s3n4l18p 1",
  mainLine: ["S*2b", "2a1b", "4c1c"],
});

const startedAt = 1_000;

function square(file: number, rank: number): TsumeShogiSquare {
  return { file, rank };
}

/** 盤上の駒を選んで移動先を押す。 */
function moveOnBoard(
  session: TsumeShogiSession,
  from: TsumeShogiSquare,
  to: TsumeShogiSquare,
  operatedAt: number,
): TsumeShogiSession {
  return tapTsumeShogiSessionSquare(
    tapTsumeShogiSessionSquare(session, from, operatedAt),
    to,
    operatedAt,
  );
}

function dropSilverOn2b(session: TsumeShogiSession): TsumeShogiSession {
  return tapTsumeShogiSessionSquare(
    tapTsumeShogiSessionHand(session, "silver"),
    square(2, 2),
    2_000,
  );
}

const initial = createTsumeShogiSession(threePly, startedAt);
const initialWithKnight = createTsumeShogiSession(
  threePlyWithKnight,
  startedAt,
);
const afterCorrectCheck = dropSilverOn2b(initial);
const afterCorrectReply = playTsumeShogiSessionDefenderReply(afterCorrectCheck);
const afterWrongCheck = moveOnBoard(initial, square(4, 3), square(4, 1), 2_000);
const afterRefutation = playTsumeShogiSessionDefenderReply(afterWrongCheck);

describe("createTsumeShogiSession", () => {
  test("問題の初期局面で攻方の手番から始めること", () => {
    const session = createTsumeShogiSession(threePly, startedAt);

    expect(getTsumeShogiSessionPhase(session)).toBe("attacker");
    expect(
      formatTsumeShogiPosition(getTsumeShogiSessionPosition(session)),
    ).toBe(formatTsumeShogiPosition(threePly.initialPosition));
    expect(getTsumeShogiSessionRemainingPlies(session)).toBe(3);
  });
});

describe("tapTsumeShogiSessionSquare", () => {
  describe("作意どおりの王手", () => {
    test("玉方の作意の応手を決め、盤面に指すまで攻方の入力を待たないこと", () => {
      const session = dropSilverOn2b(initial);

      expect(getTsumeShogiSessionPhase(session)).toBe("defender");
      expect(session.turns[0]?.line).toBe("main");
      expect(formatTsumeShogiMoveUsi(session.turns[0]!.defenderMove!)).toBe(
        "2a1b",
      );
      expect(formatTsumeShogiMoveUsi(session.turns[0]!.attackerMove)).toBe(
        "S*2b",
      );
      expect(getTsumeShogiSessionRemainingPlies(session)).toBe(2);
    });
  });

  describe("玉方の応手を待っている間", () => {
    test("盤の升を押しても何もしないこと", () => {
      const session = tapTsumeShogiSessionSquare(
        afterCorrectCheck,
        square(4, 3),
        2_500,
      );

      expect(session).toBe(afterCorrectCheck);
    });
  });

  describe("最後の作意の王手", () => {
    const beforeMate = tapTsumeShogiSessionSquare(
      afterCorrectReply,
      square(4, 3),
      3_000,
    );

    test("詰めてクリアにし、プレイ事実を返すこと", () => {
      const session = tapTsumeShogiSessionSquare(
        beforeMate,
        square(1, 3),
        4_000,
      );
      const result = getTsumeShogiSessionResult(session);

      expect(getTsumeShogiSessionPhase(session)).toBe("cleared");
      expect(session.turns.at(-1)?.line).toBe("main");
      expect(getTsumeShogiSessionRemainingPlies(session)).toBe(0);
      expect(result).toMatchObject({
        elapsedMs: 3_000,
        wrongCheckCount: 0,
        refutationViewCount: 0,
        illegalInputCount: 0,
      });
    });
  });

  describe("残りの手数以内に詰まない王手", () => {
    test("誤王手として数え、玉方の反証の応手を決めること", () => {
      const session = moveOnBoard(initial, square(4, 3), square(4, 1), 2_000);

      expect(session.wrongCheckCount).toBe(1);
      expect(session.turns[0]?.line).toBe("wrong");
      expect(getTsumeShogiSessionPhase(session)).toBe("defender");
      expect(isTsumeShogiSessionOnWrongLine(session)).toBe(true);
    });
  });

  describe("同じ判断地点で指し直した同じ誤王手", () => {
    test.each([
      ["待った", undoTsumeShogiSession],
      ["戻る", returnTsumeShogiSessionToDecision],
      ["盤面を戻す", restartTsumeShogiSession],
    ])("%sで戻しても、誤王手を数え直さないこと", (_, rewind) => {
      const session = playTsumeShogiSessionDefenderReply(
        moveOnBoard(rewind(afterRefutation), square(4, 3), square(4, 1), 3_000),
      );

      expect(session.wrongCheckCount).toBe(1);
      expect(session.refutationViewCount).toBe(2);
    });

    test("別の誤王手は数えること", () => {
      const session = moveOnBoard(
        undoTsumeShogiSession(afterRefutation),
        square(4, 3),
        square(2, 3),
        3_000,
      );

      expect(session.turns[0]?.line).toBe("wrong");
      expect(session.wrongCheckCount).toBe(2);
    });

    test("新しいプレイとしてやり直せば、また数えること", () => {
      const session = moveOnBoard(
        replayTsumeShogiSession(afterRefutation, 3_000),
        square(4, 3),
        square(4, 1),
        3_500,
      );

      expect(session.wrongCheckCount).toBe(1);
      expect(session.refutationViewCount).toBe(0);
    });
  });

  describe("誤王手の筋を続けた王手", () => {
    test("誤王手に数えず、残りの手数が尽きたら続けられないこと", () => {
      const session = playTsumeShogiSessionDefenderReply(
        moveOnBoard(afterRefutation, square(4, 1), square(4, 2), 3_000),
      );

      expect(session.wrongCheckCount).toBe(1);
      expect(session.refutationViewCount).toBe(2);
      expect(getTsumeShogiSessionPhase(session)).toBe("refuted");
      expect(getTsumeShogiSessionRemainingPlies(session)).toBe(0);
    });
  });

  describe("王手にならない手", () => {
    const selected = tapTsumeShogiSessionSquare(initial, square(4, 3), 2_000);

    test("着手させず、理由を残して非合法入力に数えること", () => {
      const session = tapTsumeShogiSessionSquare(selected, square(4, 4), 2_000);

      expect(session.turns).toHaveLength(0);
      expect(session.rejection).toEqual({
        reason: "not-check",
        to: square(4, 4),
      });
      expect(session.illegalInputCount).toBe(1);
      expect(session.selection).toEqual({
        type: "board",
        square: square(4, 3),
      });
    });
  });

  describe("駒が動けない升", () => {
    const selected = tapTsumeShogiSessionSquare(initial, square(4, 3), 2_000);

    test("ルールで指せない手として着手させないこと", () => {
      const session = tapTsumeShogiSessionSquare(selected, square(6, 5), 2_000);

      expect(session.turns).toHaveLength(0);
      expect(session.rejection?.reason).toBe("unreachable");
      expect(session.illegalInputCount).toBe(1);
    });
  });

  describe("成・不成のどちらも王手になる移動", () => {
    const selected = tapTsumeShogiSessionSquare(initial, square(1, 1), 2_000);

    test("指さずに成・不成の選択を待つこと", () => {
      const session = tapTsumeShogiSessionSquare(selected, square(2, 2), 2_000);

      expect(session.turns).toHaveLength(0);
      expect(session.promotionChoice).toEqual({
        from: square(1, 1),
        to: square(2, 2),
      });
    });
  });

  describe.each([
    ["片方だけが王手になる移動", square(3, 3)],
    ["どちらも王手にならない移動", square(5, 3)],
  ])("成・不成のどちらも指せて%s", (_, to) => {
    const selected = tapTsumeShogiSessionSquare(
      initialWithKnight,
      square(4, 5),
      2_000,
    );

    test("王手になるかどうかを明かさず、成・不成の選択を待つこと", () => {
      const session = tapTsumeShogiSessionSquare(selected, to, 2_000);

      expect(session.turns).toHaveLength(0);
      expect(session.rejection).toBeNull();
      expect(session.illegalInputCount).toBe(0);
      expect(session.promotionChoice).toEqual({ from: square(4, 5), to });
    });
  });

  describe("選んでいる駒の升", () => {
    const selected = tapTsumeShogiSessionSquare(initial, square(4, 3), 2_000);

    test("選択を解除すること", () => {
      const session = tapTsumeShogiSessionSquare(selected, square(4, 3), 2_000);

      expect(session.selection).toBeNull();
    });
  });

  describe("玉方の駒の升", () => {
    test("駒を選んでいなければ何もしないこと", () => {
      const session = tapTsumeShogiSessionSquare(initial, square(2, 1), 2_000);

      expect(session).toBe(initial);
    });
  });
});

describe("chooseTsumeShogiSessionPromotion", () => {
  const choosing = moveOnBoard(initial, square(1, 1), square(2, 2), 2_000);

  test("選んだ方で指すこと", () => {
    const session = chooseTsumeShogiSessionPromotion(choosing, true, 2_500);

    expect(formatTsumeShogiMoveUsi(session.turns[0]!.attackerMove)).toBe(
      "1a2b+",
    );
    expect(session.promotionChoice).toBeNull();
  });

  describe("選んだ方が王手にならない移動", () => {
    const choosingKnight = moveOnBoard(
      initialWithKnight,
      square(4, 5),
      square(3, 3),
      2_000,
    );

    test("着手させず、理由を残して非合法入力に数えること", () => {
      const session = chooseTsumeShogiSessionPromotion(
        choosingKnight,
        true,
        2_500,
      );

      expect(session.turns).toHaveLength(0);
      expect(session.promotionChoice).toBeNull();
      expect(session.rejection).toEqual({
        reason: "not-check",
        to: square(3, 3),
      });
      expect(session.illegalInputCount).toBe(1);
      expect(session.selection).toEqual({
        type: "board",
        square: square(4, 5),
      });
    });

    test("王手になる方を選べば指すこと", () => {
      const session = chooseTsumeShogiSessionPromotion(
        choosingKnight,
        false,
        2_500,
      );

      expect(formatTsumeShogiMoveUsi(session.turns[0]!.attackerMove)).toBe(
        "4e3c",
      );
      expect(session.illegalInputCount).toBe(0);
    });
  });
});

describe("cancelTsumeShogiSessionPromotion", () => {
  const choosing = moveOnBoard(initial, square(1, 1), square(2, 2), 2_000);

  test("駒の選択を残して選ぶのをやめ、操作回数に数えること", () => {
    const session = cancelTsumeShogiSessionPromotion(choosing);

    expect(session.promotionChoice).toBeNull();
    expect(session.selection).toEqual({ type: "board", square: square(1, 1) });
    expect(session.inputCount).toBe(choosing.inputCount + 1);
  });
});

describe("tapTsumeShogiSessionHand", () => {
  test("持っている種類を選ぶこと", () => {
    const session = tapTsumeShogiSessionHand(initial, "silver");

    expect(session.selection).toEqual({ type: "hand", pieceType: "silver" });
  });

  test("持っていない種類は選べないこと", () => {
    const session = tapTsumeShogiSessionHand(initial, "gold");

    expect(session).toBe(initial);
  });
});

describe("playTsumeShogiSessionDefenderReply", () => {
  describe("作意の応手", () => {
    test("盤面に指して攻方の手番に戻し、反証には数えないこと", () => {
      const session = playTsumeShogiSessionDefenderReply(afterCorrectCheck);

      expect(getTsumeShogiSessionPhase(session)).toBe("attacker");
      expect(
        formatTsumeShogiPosition(getTsumeShogiSessionPosition(session)),
      ).toBe(
        formatTsumeShogiPosition(
          afterCorrectCheck.turns[0]!.positionAfterDefense,
        ),
      );
      expect(session.refutationViewCount).toBe(0);
      expect(getTsumeShogiSessionRemainingPlies(session)).toBe(1);
    });
  });

  describe("反証の応手", () => {
    test("反証を見た回数に数えること", () => {
      const session = playTsumeShogiSessionDefenderReply(afterWrongCheck);

      expect(session.refutationViewCount).toBe(1);
      expect(getTsumeShogiSessionPhase(session)).toBe("attacker");
    });
  });
});

describe("returnTsumeShogiSessionToDecision", () => {
  test("誤王手を指す前の局面へ戻り、戻った回数を数えること", () => {
    const session = returnTsumeShogiSessionToDecision(afterRefutation);

    expect(session.turns).toHaveLength(0);
    expect(session.returnCount).toBe(1);
    expect(session.wrongCheckCount).toBe(1);
    expect(isTsumeShogiSessionOnWrongLine(session)).toBe(false);
  });

  test("作意の筋では何もしないこと", () => {
    const session = returnTsumeShogiSessionToDecision(afterCorrectReply);

    expect(session).toBe(afterCorrectReply);
  });
});

describe("undoTsumeShogiSession", () => {
  test("攻方の1手と玉方の応手を取り消すこと", () => {
    const session = undoTsumeShogiSession(afterCorrectReply);

    expect(session.turns).toHaveLength(0);
    expect(session.undoCount).toBe(1);
    expect(canUndoTsumeShogiSession(session)).toBe(false);
  });
});

describe("restartTsumeShogiSession", () => {
  test("同じプレイのまま初期局面へ戻し、回数を引き継ぐこと", () => {
    const session = restartTsumeShogiSession(afterRefutation);

    expect(session.turns).toHaveLength(0);
    expect(session.restartCount).toBe(1);
    expect(session.wrongCheckCount).toBe(1);
    expect(session.startedAt).toBe(startedAt);
  });
});

describe("replayTsumeShogiSession", () => {
  test("同じ問題を新しいプレイとして始めること", () => {
    const session = replayTsumeShogiSession(afterRefutation, 9_000);

    expect(session.turns).toHaveLength(0);
    expect(session.wrongCheckCount).toBe(0);
    expect(session.startedAt).toBe(9_000);
  });
});

describe("作意ではない詰み", () => {
  // 1一玉、2三金・1三歩（攻方）、攻方の持駒は金。▲1二金打と▲2二金打のどちらでも詰む。
  const problemWithAlternative = parseTsumeShogiProblemText({
    sfen: "8k/9/7GP/9/9/9/9/9/9 b G2r2b2g4s4n4l17p 1",
    mainLine: ["G*1b"],
  });
  const session = createTsumeShogiSession(problemWithAlternative, startedAt);

  test("詰めた手として受けてクリアにすること", () => {
    const cleared = tapTsumeShogiSessionSquare(
      tapTsumeShogiSessionHand(session, "gold"),
      square(2, 2),
      2_000,
    );

    expect(getTsumeShogiSessionPhase(cleared)).toBe("cleared");
    expect(cleared.turns[0]?.line).toBe("alternative");
    expect(cleared.wrongCheckCount).toBe(0);
  });
});

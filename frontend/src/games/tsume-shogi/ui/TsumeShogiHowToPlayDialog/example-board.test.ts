import {
  applyTsumeShogiMove,
  isSameTsumeShogiMove,
  isTsumeShogiCheckmate,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiPieceAt,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  playTsumeShogiSessionDefenderReply,
  type TsumeShogiSession,
  tapTsumeShogiSessionSquare,
} from "@/games/tsume-shogi/session/session";
import {
  createTsumeShogiExampleBoard,
  findTsumeShogiExampleRejectionReason,
  getTsumeShogiExampleHint,
  hasTsumeShogiExampleChanged,
  listTsumeShogiCandidateMarks,
  performTsumeShogiExampleAction,
  replyTsumeShogiExampleDefender,
  type TsumeShogiExampleAction,
  type TsumeShogiExampleBoard,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import {
  checkRuleExample,
  doublePawnRuleExamples,
  dropOperationExample,
  forcedPromotionRuleExamples,
  interpositionExample,
  mateCountExample,
  mateRuleExample,
  moveOperationExample,
  pawnDropMateRuleExamples,
  promotionOperationExample,
  type TsumeShogiHowToPlayExample,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";

/** 例の盤面に、操作を順に行う。玉方の応手を待つ手は、本番と同じく間を置いた後の応手まで進める。 */
function performAll(
  board: TsumeShogiExampleBoard,
  actions: readonly TsumeShogiExampleAction[],
): TsumeShogiExampleBoard {
  return actions.reduce((current, action) => {
    const performed = performTsumeShogiExampleAction(current, action).board;
    return replyTsumeShogiExampleDefender(performed).board;
  }, board);
}

/** 手がかりに従って押す操作。 */
function toAction(
  hint: NonNullable<ReturnType<typeof getTsumeShogiExampleHint>>,
): TsumeShogiExampleAction {
  return hint;
}

/** 本番の session で、選んでいる駒を `to` へ指したときに、着手させるか（成るかを選ばせる手も含む）。 */
function acceptsByProduction(
  session: TsumeShogiSession,
  to: TsumeShogiSquare,
): boolean {
  const next = tapTsumeShogiSessionSquare(session, to, 0);
  return next.rejection === null && next !== session;
}

const allExamples = [
  ["王手だけを指せるルール", checkRuleExample],
  ["詰ませるルール", mateRuleExample],
  ["手数のルール", mateCountExample],
  ["玉方の持駒のルール", interpositionExample],
  ["二歩のルールの左", doublePawnRuleExamples[0]],
  ["二歩のルールの右", doublePawnRuleExamples[1]],
  ["打歩詰のルールの左", pawnDropMateRuleExamples[0]],
  ["打歩詰のルールの右", pawnDropMateRuleExamples[1]],
  ["行き所の無い駒のルールの左", forcedPromotionRuleExamples[0]],
  ["行き所の無い駒のルールの右", forcedPromotionRuleExamples[1]],
  ["動かし方", moveOperationExample],
  ["打ち方", dropOperationExample],
  ["成・不成", promotionOperationExample],
] as const satisfies readonly (readonly [string, TsumeShogiHowToPlayExample])[];

describe("createTsumeShogiExampleBoard", () => {
  test.each(allExamples)(
    "本番の session で遊べる詰将棋の1問から、攻方の番で始めること: %s",
    (_, example) => {
      const board = createTsumeShogiExampleBoard(example);

      expect(board.session.turns).toHaveLength(example.preludeTurns);
      expect(board.session.defenderReplyPending).toBe(false);
      expect(board.attempt).toBeNull();
    },
  );

  describe("詰ませるルールの例の場合", () => {
    test("作意の1組を指した後で、持駒の金を選んだ姿から始めること", () => {
      const board = createTsumeShogiExampleBoard(mateRuleExample);

      expect(board.session.selection).toEqual({
        type: "hand",
        pieceType: "gold",
      });
    });
  });
});

describe("getTsumeShogiExampleHint", () => {
  test.each(allExamples)(
    "手がかりどおりに押すと、例が見せる手を本番と同じ順に指し、指し終えると手がかりを消すこと: %s",
    (_, example) => {
      let board = createTsumeShogiExampleBoard(example);
      const played: TsumeShogiMove[] = [];
      for (let step = 0; step < 10; step += 1) {
        const hint = getTsumeShogiExampleHint(board, example);
        if (hint === null) break;
        const before = board.session.turns.length;
        board = performAll(board, [toAction(hint)]);
        const move = board.session.turns[before]?.attackerMove;
        if (move) played.push(move);
        if (board.session.rejection !== null) break;
      }

      const rejected = board.session.rejection !== null;
      const finalHint = getTsumeShogiExampleHint(board, example);

      expect(
        played.every((move, index) => {
          const shown = example.shownAttacks[index];
          return shown !== undefined && isSameTsumeShogiMove(move, shown);
        }),
      ).toBe(true);
      expect(played.length + (rejected ? 1 : 0)).toBe(
        example.shownAttacks.length,
      );
      expect(finalHint).toBeNull();
    },
  );

  describe("着手させなかった後の場合", () => {
    const rejected = performAll(
      createTsumeShogiExampleBoard(checkRuleExample),
      [{ type: "square", square: { file: 3, rank: 4 } }],
    );

    test("選び直すまで手がかりを出さないこと", () => {
      const hint = getTsumeShogiExampleHint(rejected, checkRuleExample);

      expect(hint).toBeNull();
    });

    describe("選んだ駒を押して選ぶのをやめた場合", () => {
      const deselected = performAll(rejected, [
        { type: "square", square: { file: 3, rank: 3 } },
      ]);

      test("その駒にまた手がかりを出すこと", () => {
        const hint = getTsumeShogiExampleHint(deselected, checkRuleExample);

        expect(hint).toEqual({
          type: "square",
          square: { file: 3, rank: 3 },
        });
      });
    });
  });

  describe("例が見せる手と違う手を指した場合", () => {
    const deviated = performAll(
      createTsumeShogiExampleBoard(mateCountExample),
      [
        { type: "hand", pieceType: "silver" },
        { type: "square", square: { file: 1, rank: 3 } },
      ],
    );

    test("手がかりを消すこと", () => {
      const hint = getTsumeShogiExampleHint(deviated, mateCountExample);

      expect(hint).toBeNull();
    });
  });
});

describe("listTsumeShogiCandidateMarks", () => {
  describe("王手だけを指せるルールの例の場合", () => {
    const board = createTsumeShogiExampleBoard(checkRuleExample);

    test("金の行き先ごとに、本番が着手させる升だけを指せる升にすること", () => {
      const marks = listTsumeShogiCandidateMarks(
        board,
        "check",
        checkRuleExample.crop,
      );

      expect(marks.length).toBe(6);
      for (const { square, allowed } of marks) {
        expect(allowed).toBe(acceptsByProduction(board.session, square));
      }
    });
  });

  describe("詰ませるルールの例の場合", () => {
    const board = createTsumeShogiExampleBoard(mateRuleExample);

    test("金を打てる王手の升ごとに、本番の判定で詰む升だけを詰む升にすること", () => {
      const marks = listTsumeShogiCandidateMarks(
        board,
        "mate",
        mateRuleExample.crop,
      );

      expect(marks.map(({ allowed }) => allowed).filter(Boolean)).toHaveLength(
        1,
      );
      for (const { square, allowed } of marks) {
        const after = applyTsumeShogiMove(board.session.puzzleState, {
          kind: "drop",
          pieceType: "gold",
          to: square,
        });
        expect(allowed).toBe(isTsumeShogiCheckmate(after));
      }
    });
  });

  describe("玉方の応手を待つ間の場合", () => {
    const pending = performTsumeShogiExampleAction(
      createTsumeShogiExampleBoard(checkRuleExample),
      { type: "square", square: { file: 2, rank: 2 } },
    ).board;

    test("札を付けないこと", () => {
      const marks = listTsumeShogiCandidateMarks(
        pending,
        "check",
        checkRuleExample.crop,
      );

      expect(marks).toEqual([]);
    });
  });
});

describe("performTsumeShogiExampleAction", () => {
  describe("王手にならない升を押した場合", () => {
    const board = createTsumeShogiExampleBoard(checkRuleExample);

    test("本番と同じく着手させず、着手させない操作の知らせを返すこと", () => {
      const { board: next, operation } = performTsumeShogiExampleAction(board, {
        type: "square",
        square: { file: 3, rank: 4 },
      });

      expect(next.session.rejection?.reason).toBe("not-check");
      expect(next.attempt?.result).toBe("rejected");
      expect(operation).toBe("rejected");
    });
  });

  describe("詰む升に金を打った場合", () => {
    const board = createTsumeShogiExampleBoard(mateRuleExample);

    test("本番と同じく詰ませてクリアにし、指した操作の知らせを返すこと", () => {
      const { board: next, operation } = performTsumeShogiExampleAction(board, {
        type: "square",
        square: { file: 3, rank: 2 },
      });

      expect(next.session.status).toBe("cleared");
      expect(next.attempt?.result).toBe("played");
      expect(operation).toBe("moved");
    });
  });

  describe("行き所の無い段へ桂が跳ぶ場合", () => {
    const board = performAll(
      createTsumeShogiExampleBoard(forcedPromotionRuleExamples[0]),
      [{ type: "square", square: { file: 2, rank: 4 } }],
    );

    test("成るかを選ばせず、成桂で指すこと", () => {
      const { board: next } = performTsumeShogiExampleAction(board, {
        type: "square",
        square: { file: 1, rank: 2 },
      });

      expect(next.session.promotionChoice).toBeNull();
      expect(
        getTsumeShogiPieceAt(next.session.puzzleState, { file: 1, rank: 2 }),
      ).toEqual({ side: "attacker", type: "promKnight" });
    });
  });
});

describe("replyTsumeShogiExampleDefender", () => {
  describe("玉方の持駒のルールの例で香を打った場合", () => {
    const pending = performAll(
      createTsumeShogiExampleBoard(interpositionExample),
      [{ type: "hand", pieceType: "lance" }],
    );
    const dropped = performTsumeShogiExampleAction(pending, {
      type: "square",
      square: { file: 1, rank: 3 },
    }).board;

    test("本番と同じ応手として、玉方が持駒を間に打つこと", () => {
      const { board, operation } = replyTsumeShogiExampleDefender(dropped);

      expect(board.session).toEqual(
        playTsumeShogiSessionDefenderReply(dropped.session),
      );
      expect(board.session.turns.at(-1)?.defenderMove?.kind).toBe("drop");
      expect(operation).toBe("replied");
    });
  });
});

describe("hasTsumeShogiExampleChanged", () => {
  const cases = [
    ["何もしていない", mateCountExample, [], false],
    [
      "駒を選んだ",
      mateCountExample,
      [{ type: "hand", pieceType: "silver" }],
      true,
    ],
    [
      "手を指した",
      mateCountExample,
      [
        { type: "hand", pieceType: "silver" },
        { type: "square", square: { file: 2, rank: 3 } },
      ],
      true,
    ],
    [
      "最初から選んでおいた駒を外した",
      checkRuleExample,
      [{ type: "square", square: { file: 3, rank: 3 } }],
      true,
    ],
    [
      "着手させなかった",
      checkRuleExample,
      [{ type: "square", square: { file: 3, rank: 4 } }],
      true,
    ],
  ] as const satisfies readonly (readonly [
    string,
    TsumeShogiHowToPlayExample,
    readonly TsumeShogiExampleAction[],
    boolean,
  ])[];

  test.each(cases)(
    "%s姿で、変わったかを返すこと",
    (_, example, actions, expected) => {
      const changed = hasTsumeShogiExampleChanged(
        performAll(createTsumeShogiExampleBoard(example), actions),
        example,
      );

      expect(changed).toBe(expected);
    },
  );
});

describe("findTsumeShogiExampleRejectionReason", () => {
  const cases = [
    [
      "歩のある筋に歩を打つ手",
      doublePawnRuleExamples[1],
      { kind: "drop", pieceType: "pawn", to: { file: 1, rank: 2 } },
      "double-pawn",
    ],
    [
      "歩を打って詰ませる手",
      pawnDropMateRuleExamples[1],
      { kind: "drop", pieceType: "pawn", to: { file: 1, rank: 2 } },
      "pawn-drop-mate",
    ],
    [
      "玉のいる升に桂馬を打つ手",
      forcedPromotionRuleExamples[1],
      { kind: "drop", pieceType: "knight", to: { file: 1, rank: 1 } },
      "unreachable",
    ],
    [
      "二段目に桂馬を打つ手",
      forcedPromotionRuleExamples[1],
      { kind: "drop", pieceType: "knight", to: { file: 1, rank: 2 } },
      "dead-piece",
    ],
    [
      "一段目に歩を打つ手",
      doublePawnRuleExamples[0],
      { kind: "drop", pieceType: "pawn", to: { file: 2, rank: 1 } },
      "dead-piece",
    ],
    [
      "王手にならない手",
      checkRuleExample,
      {
        kind: "board",
        from: { file: 3, rank: 3 },
        to: { file: 3, rank: 4 },
        promote: false,
      },
      "not-check",
    ],
    [
      "駒が動けない升への手",
      checkRuleExample,
      {
        kind: "board",
        from: { file: 3, rank: 3 },
        to: { file: 1, rank: 4 },
        promote: false,
      },
      "unreachable",
    ],
  ] as const satisfies readonly (readonly [
    string,
    TsumeShogiHowToPlayExample,
    TsumeShogiMove,
    string,
  ])[];

  test.each(cases)("%sのわけを返すこと", (_, example, move, expected) => {
    const reason = findTsumeShogiExampleRejectionReason(
      example.problem.initialPosition,
      move,
    );

    expect(reason).toBe(expected);
  });
});

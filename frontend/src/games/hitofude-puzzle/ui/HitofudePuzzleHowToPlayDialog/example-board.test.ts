import { listHitofudePuzzleCells } from "@/games/hitofude-puzzle/puzzle/board";
import type {
  HitofudePuzzleExtensionRejection,
  HitofudePuzzleTraceStep,
} from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  beginHitofudePuzzleSessionStroke,
  createHitofudePuzzleSession,
  endHitofudePuzzleSessionStroke,
  type HitofudePuzzleSession,
  traceHitofudePuzzleSessionStroke,
} from "@/games/hitofude-puzzle/session/session";
import {
  createHitofudePuzzleExampleBoard,
  findHitofudePuzzleExampleHintCell,
  getHitofudePuzzleExamplePath,
  type HitofudePuzzleExampleBoard,
  isHitofudePuzzleExampleChanged,
  judgeHitofudePuzzleExampleMove,
  judgeHitofudePuzzleExampleShape,
  listHitofudePuzzleExampleCandidates,
  listHitofudePuzzleExampleRemainingCells,
  pressHitofudePuzzleExampleCell,
  releaseHitofudePuzzleExample,
  traceHitofudePuzzleExample,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/example-board";
import {
  allCellsRuleExamples,
  extendOperationExample,
  type HitofudePuzzleHowToPlayExample,
  holeRuleExample,
  onceRuleExample,
  rewindOperationExample,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";

/**
 * 例の盤面のマス番号（3×3）
 * 0 1 2
 * 3 4 5
 * 6 7 8
 */
const [allCellsAllowed, allCellsDisallowed] = allCellsRuleExamples;
/** どの例も、本番の指の操作とまったく同じに動く。 */
const allExamples = [
  ["onceRuleExample", onceRuleExample],
  ["holeRuleExample", holeRuleExample],
  ["allCellsRuleExamples[0]", allCellsAllowed],
  ["allCellsRuleExamples[1]", allCellsDisallowed],
  ["extendOperationExample", extendOperationExample],
  ["rewindOperationExample", rewindOperationExample],
] as const;

/**
 * 指の操作1つ。
 * - `press`: マスを押す（なぞり始める）。
 * - `trace`: なぞる指が `from` から `to` へ移る。
 * - `release`: 指を離す。
 */
type FingerOperation =
  | { kind: "press"; cell: number }
  | { kind: "trace"; from: number; to: number }
  | { kind: "release" };

/** 操作1つの後の道と、弾かれたときの理由。 */
type OperationOutcome = {
  path: readonly number[];
  rejection: HitofudePuzzleExtensionRejection | null;
};

function toTraceStep(from: number, to: number): HitofudePuzzleTraceStep {
  return { from, to, horizontalFirst: true };
}

/** 例の触る前の道を、本番の session で1回のなぞりで引いた姿。 */
function createSessionAt({
  board,
  path,
}: HitofudePuzzleHowToPlayExample): HitofudePuzzleSession {
  let session = beginHitofudePuzzleSessionStroke(
    createHitofudePuzzleSession(board, 0),
    board.start,
    0,
  ).session;
  for (const [index, to] of path.slice(1).entries()) {
    session = traceHitofudePuzzleSessionStroke(
      session,
      toTraceStep(path[index]!, to),
      0,
    ).session;
  }
  return endHitofudePuzzleSessionStroke(session);
}

/** 本番の session で、触る前の道から操作を順に打ったときの、操作ごとの道と理由。 */
function playOnSession(
  definition: HitofudePuzzleHowToPlayExample,
  operations: readonly FingerOperation[],
): OperationOutcome[] {
  let session = createSessionAt(definition);
  return operations.map((operation) => {
    if (operation.kind === "release") {
      session = endHitofudePuzzleSessionStroke(session);
      return { path: session.puzzleState.path, rejection: null };
    }
    const change =
      operation.kind === "press"
        ? beginHitofudePuzzleSessionStroke(session, operation.cell, 0)
        : traceHitofudePuzzleSessionStroke(
            session,
            toTraceStep(operation.from, operation.to),
            0,
          );
    session = change.session;
    return { path: session.puzzleState.path, rejection: change.rejection };
  });
}

/** 例で、触る前の姿から操作を順に打ったときの、操作ごとの道と理由。 */
function playOnExample(
  initial: HitofudePuzzleExampleBoard,
  operations: readonly FingerOperation[],
): OperationOutcome[] {
  let example = initial;
  return operations.map((operation) => {
    const before = example.lastMove;
    switch (operation.kind) {
      case "press":
        example = pressHitofudePuzzleExampleCell(example, operation.cell);
        break;
      case "trace":
        example = traceHitofudePuzzleExample(
          example,
          toTraceStep(operation.from, operation.to),
        );
        break;
      case "release":
        example = releaseHitofudePuzzleExample(example);
        break;
    }
    const move = example.lastMove;
    return {
      path: getHitofudePuzzleExamplePath(example),
      rejection:
        move !== before && move?.change === "blocked" ? move.reason : null,
    };
  });
}

/** マスを順に押して離す。 */
function pressAll(
  example: HitofudePuzzleExampleBoard,
  cells: readonly number[],
): HitofudePuzzleExampleBoard {
  return cells.reduce(
    (current, cell) =>
      releaseHitofudePuzzleExample(
        pressHitofudePuzzleExampleCell(current, cell),
      ),
    example,
  );
}

function press(cell: number): FingerOperation {
  return { kind: "press", cell };
}

function trace(from: number, to: number): FingerOperation {
  return { kind: "trace", from, to };
}

const release: FingerOperation = { kind: "release" };

describe("createHitofudePuzzleExampleBoard", () => {
  test.each(allExamples)(
    "%s は、触る前の道を本番の session で引いた姿で始まること",
    (_, definition) => {
      const example = createHitofudePuzzleExampleBoard(definition);

      expect(getHitofudePuzzleExamplePath(example)).toEqual(definition.path);
    },
  );
});

describe("pressHitofudePuzzleExampleCell", () => {
  describe.each(allExamples)("%s", (_, definition) => {
    const initial = createHitofudePuzzleExampleBoard(definition);
    const cases = listHitofudePuzzleCells(definition.board.size).map(
      (cell) => [cell, playOnSession(definition, [press(cell)])] as const,
    );

    test.each(cases)(
      "マス %i を押すと、本番の session でなぞり始めたときと同じ道と、延ばせなかった理由になること",
      (cell, expected) => {
        const pressed = playOnExample(initial, [press(cell)]);

        expect(pressed).toEqual(expected);
      },
    );
  });

  describe("穴を押した場合", () => {
    const initial = createHitofudePuzzleExampleBoard(holeRuleExample);

    test("穴で弾き、進もうとした向きを残すこと", () => {
      const pressed = pressHitofudePuzzleExampleCell(initial, 4);

      expect(getHitofudePuzzleExamplePath(pressed)).toEqual(
        holeRuleExample.path,
      );
      expect(pressed.lastMove).toEqual({
        change: "blocked",
        cell: 4,
        direction: "up",
        reason: "hole",
      });
    });
  });

  describe("完成した例の場合", () => {
    const solved = createHitofudePuzzleExampleBoard(allCellsAllowed);

    test("本番と同じく受け付けず、道も直前の手も変えないこと", () => {
      const pressed = pressHitofudePuzzleExampleCell(solved, 0);

      expect(getHitofudePuzzleExamplePath(pressed)).toEqual(
        allCellsAllowed.path,
      );
      expect(pressed.lastMove).toBeNull();
    });
  });
});

describe("traceHitofudePuzzleExample", () => {
  describe.each(allExamples)("%s", (_, definition) => {
    const initial = createHitofudePuzzleExampleBoard(definition);
    const head = definition.path.at(-1)!;
    const cases = listHitofudePuzzleCells(definition.board.size)
      .filter((cell) => cell !== head)
      .map((to) => {
        const operations = [press(head), trace(head, to)];
        return [to, operations, playOnSession(definition, operations)] as const;
      });

    test.each(cases)(
      "先端を押してマス %i へなぞると、本番の session のなぞりと同じ道と、延ばせなかった理由になること",
      (_to, operations, expected) => {
        const traced = playOnExample(initial, operations);

        expect(traced).toEqual(expected);
      },
    );
  });
});

describe("触る前の姿から続けて操作した場合", () => {
  const sequences = [
    [
      "押して延ばす → 道のマスを押して戻す → また延ばす",
      rewindOperationExample,
      [
        press(1),
        release,
        press(4),
        release,
        press(3),
        release,
        press(0),
        release,
        press(6),
        release,
      ],
    ],
    [
      "延ばしてから、来た道をなぞって縮め、そのまま別の向きへなぞる",
      extendOperationExample,
      [
        press(4),
        trace(4, 1),
        trace(1, 0),
        trace(0, 3),
        trace(3, 0),
        trace(0, 1),
        trace(1, 2),
        release,
      ],
    ],
    [
      "道の途中を押したまま、別の道をなぞり、穴へなぞって弾かれ、離してから続ける",
      holeRuleExample,
      [
        press(5),
        trace(5, 4),
        trace(5, 8),
        trace(8, 7),
        trace(7, 6),
        release,
        press(6),
        trace(6, 3),
        release,
        press(3),
      ],
    ],
    [
      "通ったマスを押して戻し、延ばし直してから、離れたマスと通ったマスへ手を打つ",
      onceRuleExample,
      [
        press(7),
        release,
        press(8),
        trace(8, 5),
        trace(5, 4),
        release,
        press(2),
        release,
        press(4),
        trace(4, 7),
        release,
      ],
    ],
  ] as const satisfies readonly (readonly [
    string,
    HitofudePuzzleHowToPlayExample,
    readonly FingerOperation[],
  ])[];

  describe.each(sequences)("%s", (_, definition, operations) => {
    const initial = createHitofudePuzzleExampleBoard(definition);
    const expected = playOnSession(definition, operations);

    test("どの操作の後も、本番の session と同じ道と、延ばせなかった理由になること", () => {
      const outcomes = playOnExample(initial, operations);

      expect(outcomes).toEqual(expected);
    });
  });
});

describe("findHitofudePuzzleExampleHintCell", () => {
  describe("extendOperationExample（3マス延ばしてから、来た道を1マス戻る）", () => {
    const initial = createHitofudePuzzleExampleBoard(extendOperationExample);
    const tracedBack = releaseHitofudePuzzleExample(
      traceHitofudePuzzleExample(
        pressHitofudePuzzleExampleCell(pressAll(initial, [1, 0, 3]), 3),
        toTraceStep(3, 0),
      ),
    );
    const cases = [
      ["触る前は、最初の手のマス", initial, 1],
      [
        "手がかりどおりに1手押した後は、次の手のマス",
        pressAll(initial, [1]),
        0,
      ],
      [
        "3マス延ばした後は、来た道を戻る手のマス",
        pressAll(initial, [1, 0, 3]),
        0,
      ],
      ["来た道を指でなぞって戻って手を打ち終えた後は、無し", tracedBack, null],
      [
        "来た道を指でなぞって戻ってから、また延ばした後も、無し",
        pressAll(tracedBack, [3]),
        null,
      ],
      [
        "来た道のマスを押して縮めた後は、なぞる手を打っていないので、無し",
        pressAll(initial, [1, 0, 3, 0]),
        null,
      ],
      [
        "来た道のマスを押して縮めてから、また延ばした後は、なぞって戻る手のマス",
        pressAll(initial, [1, 0, 3, 0, 3]),
        0,
      ],
      ["手がかりと違う手を打った後は、無し", pressAll(initial, [5]), null],
      [
        "戻して触る前の道に戻った後は、最初の手のマス",
        pressAll(initial, [1, 4]),
        1,
      ],
    ] as const;

    test.each(cases)("%sを返すこと", (_, example, expected) => {
      const hint = findHitofudePuzzleExampleHintCell(example);

      expect(hint).toBe(expected);
    });
  });

  describe("rewindOperationExample で、道の途中を押して縮めた場合", () => {
    const example = pressAll(
      createHitofudePuzzleExampleBoard(rewindOperationExample),
      [1, 4],
    );

    test("引き直す手のマスへ手がかりを続けること", () => {
      const hint = findHitofudePuzzleExampleHintCell(example);

      expect(hint).toBe(3);
    });
  });

  describe("弾かれた場合", () => {
    const rejected = pressHitofudePuzzleExampleCell(
      createHitofudePuzzleExampleBoard(holeRuleExample),
      4,
    );

    test("道が変わるまで返さないこと", () => {
      const hint = findHitofudePuzzleExampleHintCell(rejected);

      expect(hint).toBeNull();
    });
  });
});

describe("isHitofudePuzzleExampleChanged", () => {
  const rewind = createHitofudePuzzleExampleBoard(rewindOperationExample);
  const hole = createHitofudePuzzleExampleBoard(holeRuleExample);
  const cases = [
    ["触る前", rewind, false],
    ["道を戻した後", pressAll(rewind, [1]), true],
    [
      "戻してから、触る前の道へ延ばし直した後",
      pressAll(rewind, [1, 2, 5, 4, 3]),
      false,
    ],
    ["穴に弾かれただけの後", pressAll(hole, [4]), false],
    ["離れたマスで弾かれただけの後", pressAll(hole, [3]), false],
  ] as const;

  test.each(cases)("%sは %s を返すこと", (_, example, expected) => {
    const changed = isHitofudePuzzleExampleChanged(example);

    expect(changed).toBe(expected);
  });
});

describe("listHitofudePuzzleExampleCandidates", () => {
  const once = createHitofudePuzzleExampleBoard(onceRuleExample);
  const hole = createHitofudePuzzleExampleBoard(holeRuleExample);
  const cases = [
    [
      "同じマスの例の触る前は、下のまっすぐ通った道のマスを通れないとし、上と左の空いたマスを通れるとする",
      once,
      "visited",
      [
        { cell: 1, rejection: null },
        { cell: 7, rejection: "visited" },
        { cell: 3, rejection: null },
      ],
    ],
    [
      "穴の例の触る前は、上の内側の穴を通れないとし、左の空いたマスを通れるとする",
      hole,
      "hole",
      [
        { cell: 4, rejection: "hole" },
        { cell: 6, rejection: null },
      ],
    ],
    [
      "弾かれても道が変わらない間は、同じ印にする",
      pressAll(hole, [4]),
      "hole",
      [
        { cell: 4, rejection: "hole" },
        { cell: 6, rejection: null },
      ],
    ],
    [
      "通れるマスへ延ばした後は、新しい先端の隣に付け直す",
      pressAll(once, [3]),
      "visited",
      [
        { cell: 0, rejection: null },
        { cell: 6, rejection: "visited" },
      ],
    ],
    [
      "通ったマスを押して戻した後は、戻した先端の隣に付け直す",
      pressAll(once, [7]),
      "visited",
      [
        { cell: 4, rejection: null },
        { cell: 8, rejection: null },
      ],
    ],
    ["完成した盤面には付けない", pressAll(hole, [6, 3]), "hole", []],
    ["行き止まりの盤面には付けない", pressAll(once, [1, 0, 3]), "visited", []],
  ] as const;

  test.each(cases)("%sこと", (_, example, rule, expected) => {
    const candidates = listHitofudePuzzleExampleCandidates(example, rule);

    expect(candidates).toEqual(expected);
  });
});

describe("judgeHitofudePuzzleExampleShape", () => {
  const disallowed = createHitofudePuzzleExampleBoard(allCellsDisallowed);
  const cases = [
    [
      "完成した姿は allowed",
      createHitofudePuzzleExampleBoard(allCellsAllowed),
      "allowed",
      0,
    ],
    ["マスを残した行き止まりは disallowed", disallowed, "disallowed", 1],
    [
      "道を戻して延ばせる姿は incomplete",
      pressAll(disallowed, [3]),
      "incomplete",
      3,
    ],
    [
      "戻してから別のマスを残して行き止まりにした姿は disallowed",
      pressAll(disallowed, [3, 6]),
      "disallowed",
      2,
    ],
  ] as const;

  test.each(cases)(
    "%sとし、残りのマスを数えること",
    (_, example, verdict, remaining) => {
      const judged = {
        verdict: judgeHitofudePuzzleExampleShape(example),
        remaining: listHitofudePuzzleExampleRemainingCells(example).length,
      };

      expect(judged).toEqual({ verdict, remaining });
    },
  );
});

describe("judgeHitofudePuzzleExampleMove", () => {
  const once = createHitofudePuzzleExampleBoard(onceRuleExample);
  const hole = createHitofudePuzzleExampleBoard(holeRuleExample);

  describe("×が点いているとして判定した場合", () => {
    const cases = [
      ["触る前は、手ごとの印の凡例", once, { kind: "candidates" }],
      [
        "例が教えるルールで弾かれたら、その理由",
        pressAll(hole, [4]),
        { kind: "rejected", reason: "hole" },
      ],
      [
        "通れるマスへ延ばした後も、新しい先端の印の凡例",
        pressAll(once, [3]),
        { kind: "candidates" },
      ],
      [
        "別の理由で弾かれたら、その理由",
        pressAll(hole, [3]),
        { kind: "rejected", reason: "not-adjacent" },
      ],
      [
        "同じマスの例で通ったマスを押すと、道が戻ったこと",
        pressAll(once, [7]),
        { kind: "rewound" },
      ],
      [
        "穴の例で道の始点を押すと、道が戻ったこと",
        pressAll(hole, [0]),
        { kind: "rewound" },
      ],
      [
        "穴の例で道のマスを押して縮めると、道が戻ったこと",
        pressAll(hole, [5]),
        { kind: "rewound" },
      ],
      [
        "同じマスの例で延ばしてから来た道をなぞって縮めると、先端は印の無い来たマスへ戻るだけなので、凡例",
        releaseHitofudePuzzleExample(
          traceHitofudePuzzleExample(
            pressHitofudePuzzleExampleCell(pressAll(once, [3, 0]), 0),
            toTraceStep(0, 3),
          ),
        ),
        { kind: "candidates" },
      ],
      [
        "同じマスの例で戻した後に延ばすと、凡例",
        pressAll(once, [7, 4]),
        { kind: "candidates" },
      ],
      [
        "同じマスの例で延ばしてから押して触る前の道に戻ると、凡例",
        pressAll(once, [3, 4]),
        { kind: "candidates" },
      ],
      [
        "すべてのマスを通ると、完成",
        pressAll(hole, [6, 3]),
        { kind: "solved" },
      ],
      [
        "マスを残して行き止まりになると、行き止まりと残りのマスの数",
        pressAll(once, [1, 0, 3]),
        { kind: "deadEnd", remaining: 1 },
      ],
    ] as const;

    test.each(cases)("%sを返すこと", (_, example, expected) => {
      const caption = judgeHitofudePuzzleExampleMove(example, {
        blockedMarkShown: true,
      });

      expect(caption).toEqual(expected);
    });
  });

  describe("弾かれた手の×が消えた後", () => {
    const cases = [
      [
        "触る前の姿で弾かれたら、凡例",
        pressAll(hole, [4]),
        { kind: "candidates" },
      ],
      [
        "道を戻した後に弾かれたら、道が戻ったこと",
        pressAll(once, [7, 2]),
        { kind: "rewound" },
      ],
    ] as const;

    test.each(cases)("%sを返すこと", (_, example, expected) => {
      const caption = judgeHitofudePuzzleExampleMove(example, {
        blockedMarkShown: false,
      });

      expect(caption).toEqual(expected);
    });
  });
});

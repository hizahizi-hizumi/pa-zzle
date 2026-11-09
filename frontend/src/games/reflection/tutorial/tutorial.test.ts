import {
  createEmptyReflectionBoard,
  type ReflectionBoard,
  type ReflectionCell,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
  isSameReflectionClue,
  listReflectionEntries,
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  isReflectionSolved,
  listReflectionClueMatches,
} from "@/games/reflection/puzzle/rules";
import {
  _private,
  findReflectionTutorialHint,
  getReflectionTutorialLaserEntry,
  getReflectionTutorialStepTarget,
  listReflectionTutorialSpotlitTargets,
  type ReflectionTutorialAction,
  type ReflectionTutorialBoardState,
  type ReflectionTutorialRuleId,
  type ReflectionTutorialStep,
  reflectionTutorial,
} from "@/games/reflection/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { solution, steps, freePlacements, cellAt } = _private;

type Progress = TutorialProgress<
  ReflectionTutorialRuleId,
  ReflectionTutorialBoardState
>;

type PlaceStep = Extract<ReflectionTutorialStep, { type: "place" }>;

const size = solution.size;
const entries = listReflectionEntries(size);
const { clues, inventory } = reflectionTutorial.start().session.problem;

/** ピースごとに、その働きを示すルール。向きの違う斜め鏡・両面鏡は同じ働き。 */
const ruleByPiece = {
  slash: "mirror",
  backslash: "mirror",
  "vertical-double": "double",
  "horizontal-double": "double",
  reflector: "reflector",
  "black-hole": "black-hole",
} as const satisfies Record<ReflectionPiece, ReflectionTutorialRuleId>;

const placeSteps = steps.filter(
  (step): step is PlaceStep => step.type === "place",
);

function entryIndex(entry: ReflectionEntry): number {
  return entries.findIndex(
    (candidate) =>
      candidate.side === entry.side && candidate.index === entry.index,
  );
}

function withPieces(
  base: ReflectionBoard,
  pieces: readonly (readonly [number, ReflectionCell])[],
): ReflectionBoard {
  const cells = [...base.cells];
  for (const [cellIndex, cell] of pieces) {
    cells[cellIndex] = cell;
  }
  return { size, cells };
}

function performAll(
  progress: Progress,
  actions: readonly ReflectionTutorialAction[],
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(reflectionTutorial, current, action),
    progress,
  );
}

function stepActions(step: ReflectionTutorialStep): ReflectionTutorialAction[] {
  return step.type === "light"
    ? [{ type: "clue", entry: step.entry }]
    : [
        { type: "stock", piece: step.piece },
        { type: "cell", cellIndex: step.cellIndex },
      ];
}

/** 最初の `count` 個の手順を、印の所へ手順どおりの操作をして終える。 */
function finishSteps(count: number): Progress {
  return performAll(
    finishTutorialIntro(startTutorial(reflectionTutorial)),
    steps.slice(0, count).flatMap(stepActions),
  );
}

/** 手を引く間の、導入を終えた時点から手を離すまでの各手の後の進行。手順どおりの操作だけを順に打つ。 */
function listGuidedProgresses(): Progress[] {
  const progresses = [finishTutorialIntro(startTutorial(reflectionTutorial))];
  for (const action of steps.flatMap(stepActions)) {
    const last = progresses[progresses.length - 1];
    if (last) {
      progresses.push(performTutorialAction(reflectionTutorial, last, action));
    }
  }
  return progresses.filter(
    (progress) =>
      getTutorialSituation(reflectionTutorial, progress).step !== null,
  );
}

/** 手を引いた手順で置いた盤面。 */
function boardAfterPlaceSteps(count: number): ReflectionBoard {
  return withPieces(
    createEmptyReflectionBoard(size),
    placeSteps.slice(0, count).map((step) => [step.cellIndex, step.piece]),
  );
}

/**
 * 外周ヒントと手持ちに合う配置の数を、`limit` まで数える。
 * マスを行優先に決めていき、決めたマスだけで光の行き先が決まる外周ヒントが合わなければ打ち切る。
 */
function countSolutions(limit: number): number {
  const cells: (ReflectionCell | undefined)[] = new Array(size * size).fill(
    undefined,
  );
  const remaining = { ...inventory };
  const total = reflectionPieces.reduce(
    (sum, piece) => sum + inventory[piece],
    0,
  );
  let count = 0;

  function isConsistent(): boolean {
    return entries.every(function checkEntry(entry, index) {
      if (cells.some((cell) => cell === undefined)) {
        const decided = cells.map((cell) => cell ?? null);
        const trace = traceReflectionLaser({ size, cells: decided }, entry);
        if (trace.path.some((step) => cells[step.cellIndex] === undefined)) {
          return true;
        }
        const clue = clues[index];
        return clue !== undefined && isSameReflectionClue(trace, clue);
      }
      return true;
    });
  }

  function search(cellIndex: number, placed: number): void {
    if (count >= limit) {
      return;
    }
    if (cellIndex === size * size) {
      const board = { size, cells: cells.map((cell) => cell ?? null) };
      if (placed === total && isReflectionSolved(board, { inventory, clues })) {
        count += 1;
      }
      return;
    }
    if (total - placed < size * size - cellIndex) {
      cells[cellIndex] = null;
      if (isConsistent()) {
        search(cellIndex + 1, placed);
      }
    }
    for (const piece of reflectionPieces) {
      if (remaining[piece] <= 0) {
        continue;
      }
      remaining[piece] -= 1;
      cells[cellIndex] = piece;
      if (isConsistent()) {
        search(cellIndex + 1, placed + 1);
      }
      remaining[piece] += 1;
    }
    cells[cellIndex] = undefined;
  }

  search(0, 0);
  return count;
}

/** `base` の空きマスに `pieces` をすべて置く置き方。 */
function listCompletions(
  base: ReflectionBoard,
  pieces: readonly ReflectionPiece[],
): ReflectionBoard[] {
  const empty = base.cells.flatMap((cell, cellIndex) =>
    cell === null ? [cellIndex] : [],
  );
  const boards: ReflectionBoard[] = [];
  function place(index: number, puts: (readonly [number, ReflectionPiece])[]) {
    const piece = pieces[index];
    if (piece === undefined) {
      boards.push(withPieces(base, puts));
      return;
    }
    for (const cellIndex of empty) {
      if (!puts.some(([used]) => used === cellIndex)) {
        place(index + 1, [...puts, [cellIndex, piece]]);
      }
    }
  }
  place(0, []);
  return boards;
}

/**
 * 伝えたルールで読んで、外周ヒント `entry` から入れた光が、その数字と記号のとおりに進むか。
 * `readsNumber` が偽なら数字を読まず、記号の行き先だけを比べる（数字のルールが決め手かを確かめるのに使う）。
 * 光が出た先の数字との突き合わせは緑の地の出し方として伝え、置く場所を決めるのには使わないので、ここでは比べない。
 */
function followsClue(
  board: ReflectionBoard,
  entry: ReflectionEntry,
  readsNumber: boolean,
): boolean {
  const trace = traceReflectionLaser(board, entry);
  const clue = clues[entryIndex(entry)];
  return (
    clue !== undefined &&
    trace.outcome === clue.outcome &&
    (!readsNumber || trace.distance === clue.distance)
  );
}

/** 置く手順の外周ヒントと、そこまでに置いたピースだけで、手順の種類を置くと外周ヒントのとおりに光が進むマス。 */
function listStepCandidates(
  step: PlaceStep,
  before: ReflectionBoard,
  readsNumber: boolean,
): number[] {
  return before.cells.flatMap((cell, cellIndex) => {
    if (cell !== null) {
      return [];
    }
    const board = withPieces(before, [[cellIndex, step.piece]]);
    return step.reasonEntries.every((entry) =>
      followsClue(board, entry, readsNumber),
    )
      ? [cellIndex]
      : [];
  });
}

/** 外周ヒントの光が通るマスに置いたピース。 */
function listPiecesOnLight(
  board: ReflectionBoard,
  lightEntries: readonly ReflectionEntry[],
): ReflectionPiece[] {
  return lightEntries.flatMap((entry) =>
    traceReflectionLaser(board, entry).path.flatMap((laserStep) => {
      const cell = board.cells[laserStep.cellIndex];
      return cell ? [cell] : [];
    }),
  );
}

/** 残りのピースをどう置いても、外周ヒント `entry` のとおりに光が進むなら `cellIndex` に `piece` があるか。 */
function isDecidedByClue(
  completions: readonly ReflectionBoard[],
  entry: ReflectionEntry,
  { cellIndex, piece }: { cellIndex: number; piece: ReflectionPiece },
  readsNumber: boolean,
): boolean {
  const consistent = completions.filter((board) =>
    followsClue(board, entry, readsNumber),
  );
  return (
    consistent.length > 0 &&
    consistent.every((board) => board.cells[cellIndex] === piece)
  );
}

/** 手がかりに従って押し続けると、解けるまでの手数。解けなければ `null`。 */
function followHints(progress: Progress, limit: number): number | null {
  let current = progress;
  for (let move = 0; move < limit; move += 1) {
    if (current.phase === "solved") {
      return move;
    }
    const hint = findReflectionTutorialHint(current.boardState);
    if (hint === null || hint.type === "clue") {
      return null;
    }
    const action: ReflectionTutorialAction =
      hint.type === "stock"
        ? { type: "stock", piece: hint.piece }
        : { type: "cell", cellIndex: hint.cellIndex };
    const next = performTutorialAction(reflectionTutorial, current, action);
    if (next === current) {
      return null;
    }
    current = next;
  }
  return current.phase === "solved" ? limit : null;
}

describe("reflectionTutorial の盤面", () => {
  const emptyBoard = createEmptyReflectionBoard(size);
  const lightStep = steps.find((step) => step.type === "light");
  const doubleStep = placeSteps.find(
    (step) => ruleByPiece[step.piece] === "double",
  );

  test("外周ヒントと手持ちに合う配置が、解き終えた盤面ただ1つであること", () => {
    const result = countSolutions(2);

    expect(result).toBe(1);
  });

  test("どのピースも、取り除くと外周ヒントのどれかが変わること", () => {
    const result = solution.cells.flatMap((cell, cellIndex) =>
      cell === null
        ? []
        : [
            areSameReflectionClues(
              computeReflectionClues(withPieces(solution, [[cellIndex, null]])),
              clues,
            ),
          ],
    );

    expect(result).toEqual([false, false, false, false, false, false]);
  });

  test("ピースは6種類を1つずつ使い、ストックに全種類が並ぶこと", () => {
    const result = reflectionPieces.map((piece) => inventory[piece]);

    expect(result).toEqual([1, 1, 1, 1, 1, 1]);
  });

  test("最初に光を出す外周ヒントは、何も置いていない盤面で合っていて、解き終えた盤面では両面鏡に沿って通ること", () => {
    const entry = lightStep?.entry ?? { side: "top", index: 0 };
    const matchedAtStart = listReflectionClueMatches(emptyBoard, clues)[
      entryIndex(entry)
    ];
    const solvedTrace = traceReflectionLaser(solution, entry);

    expect(matchedAtStart).toBe(true);
    expect(solvedTrace.path.map((laserStep) => laserStep.cellIndex)).toContain(
      doubleStep?.cellIndex,
    );
    expect(
      isSameReflectionClue(solvedTrace, { outcome: "exit", distance: size }),
    ).toBe(true);
  });

  describe("光が出た先を押させる手順", () => {
    const [firstLightStep, exitLightStep] = steps.filter(
      (step) => step.type === "light",
    );
    const firstEntry = firstLightStep?.entry ?? { side: "top", index: 0 };
    const exitEntry = exitLightStep?.entry ?? { side: "top", index: 0 };

    test("最初の光が何も置いていない盤面で出る所の外周ヒントを押させ、そこは最初の外周ヒントと同じ数字の退出であること", () => {
      const firstTrace = traceReflectionLaser(emptyBoard, firstEntry);

      expect(firstTrace.exit).toEqual(exitEntry);
      expect(clues[entryIndex(exitEntry)]).toEqual(
        clues[entryIndex(firstEntry)],
      );
      expect(clues[entryIndex(exitEntry)]?.outcome).toBe("exit");
    });

    test("数字のルールの続きとして、最初の手順のすぐ後に置くこと", () => {
      const result = steps
        .slice(0, 2)
        .map((step) => [step.type, step.introducedRuleId]);

      expect(result).toEqual([
        ["light", "number"],
        ["light", "number"],
      ]);
    });
  });
});

describe("reflectionTutorial の手順", () => {
  const placeStepCases = placeSteps.map(
    (step, index) =>
      [
        step.piece,
        {
          step,
          before: boardAfterPlaceSteps(index),
          after: boardAfterPlaceSteps(index + 1),
          earnedRuleIds: finishSteps(steps.indexOf(step)).earnedRuleIds,
        },
      ] as const,
  );
  const released = boardAfterPlaceSteps(placeSteps.length);
  const completions = listCompletions(
    released,
    freePlacements.map((placement) => placement.piece),
  );

  test.each(placeStepCases)(
    "%s を置く手順は、その外周ヒントとそこまでに置いたピースだけで、伝えたルールで読むと置く場所が1つに決まること",
    (_, { step, before }) => {
      const result = listStepCandidates(step, before, true);

      expect(result).toEqual([step.cellIndex]);
    },
  );

  test.each(placeStepCases)(
    "%s を置く手順は、その働きのルールを示し、外周ヒントの光はそこまでに示したルールのピースだけを通ること",
    (_, { step, after, earnedRuleIds }) => {
      const result = listPiecesOnLight(after, step.reasonEntries).map(
        (piece) => ruleByPiece[piece],
      );

      expect(step.introducedRuleId).toBe(ruleByPiece[step.piece]);
      expect(result.every((ruleId) => earnedRuleIds.includes(ruleId))).toBe(
        true,
      );
    },
  );

  test.each(placeStepCases)(
    "%s を置くと、その手順の外周ヒントが合い、合っていた外周ヒントは合ったままであること",
    (_, { step, before, after }) => {
      const beforeMatches = listReflectionClueMatches(before, clues);
      const afterMatches = listReflectionClueMatches(after, clues);

      expect(
        step.reasonEntries.map((entry) => afterMatches[entryIndex(entry)]),
      ).toEqual(step.reasonEntries.map(() => true));
      expect(
        beforeMatches.every(
          (matched, clueIndex) => !matched || afterMatches[clueIndex],
        ),
      ).toBe(true);
    },
  );

  test.each(placeStepCases)(
    "%s を置く手順は、ゴールの盤面と同じマスに同じピースを置かせること",
    (_, { step }) => {
      const result = solution.cells[step.cellIndex];

      expect(result).toBe(step.piece);
    },
  );

  describe("手を引く間のどの途中の盤面も", () => {
    const guidedProgresses = listGuidedProgresses();

    test("示したルールのピースだけを、ゴールの盤面と同じマスに置いていること", () => {
      const result = guidedProgresses.flatMap((progress) =>
        progress.boardState.session.puzzleState.cells.flatMap(
          (cell, cellIndex) =>
            cell === null ||
            (solution.cells[cellIndex] === cell &&
              progress.earnedRuleIds.includes(ruleByPiece[cell]))
              ? []
              : [{ stepIndex: progress.stepIndex, cellIndex, cell }],
        ),
      );

      expect(result).toEqual([]);
    });

    test("見せる光は、示したルールのピースだけを通ること", () => {
      const result = guidedProgresses.flatMap((progress) => {
        const entry = getReflectionTutorialLaserEntry(
          getTutorialSituation(reflectionTutorial, progress),
          progress.boardState,
        );
        const pieces =
          entry === null
            ? []
            : listPiecesOnLight(progress.boardState.session.puzzleState, [
                entry,
              ]);
        return pieces.filter(
          (piece) => !progress.earnedRuleIds.includes(ruleByPiece[piece]),
        );
      });

      expect(result).toEqual([]);
    });
  });

  describe("置く手の決め手", () => {
    /** 置く手ごとに、置いた後の盤面と、置く場所を決める外周ヒント。手を離した後の手は解き終えた盤面で見る。 */
    const decisions = [
      ...placeStepCases.map(([, { step, after }]) => ({
        board: after,
        reasonEntries: step.reasonEntries,
      })),
      ...freePlacements.map((placement) => ({
        board: solution,
        reasonEntries: placement.reasonEntries,
      })),
    ];
    const pieceRuleIds = reflectionTutorial.rules.flatMap((rule) =>
      rule.id === "number" ? [] : [rule.id],
    );

    test("数字のルールは、数字を読まなければ置く場所が1つに決まらない手の決め手になること", () => {
      const result = [
        ...placeStepCases.flatMap(([piece, { step, before }]) =>
          listStepCandidates(step, before, false).length > 1 ? [piece] : [],
        ),
        ...freePlacements.flatMap((placement) =>
          placement.reasonEntries.some(
            (entry) => !isDecidedByClue(completions, entry, placement, false),
          )
            ? [placement.piece]
            : [],
        ),
      ];

      expect(result).not.toEqual([]);
    });

    test("ピースの働きのルールのそれぞれが、1つ以上の置く手で、置く場所を決める外周ヒントの光が通るピースとして決め手になること", () => {
      const decidingRuleIds = decisions.flatMap(({ board, reasonEntries }) =>
        listPiecesOnLight(board, reasonEntries).map(
          (piece) => ruleByPiece[piece],
        ),
      );

      const result = pieceRuleIds.filter(
        (ruleId) => !decidingRuleIds.includes(ruleId),
      );

      expect(result).toEqual([]);
    });
  });

  test("手を離す前に、すべてのピースの働きのルールを示していること", () => {
    const { earnedRuleIds } = finishSteps(steps.length);

    const result = reflectionPieces.filter(
      (piece) => !earnedRuleIds.includes(ruleByPiece[piece]),
    );

    expect(result).toEqual([]);
  });

  test.each(
    freePlacements.map((placement) => [placement.piece, placement] as const),
  )(
    "手を離した後に置く %s は、手を離した時点で合っていない外周ヒント1本を伝えたルールで読むと、残りのピースをどう置いても置く場所と種類が決まること",
    (_, placement) => {
      const releasedMatches = listReflectionClueMatches(released, clues);

      const result = placement.reasonEntries.map((entry) => ({
        matched: releasedMatches[entryIndex(entry)],
        decided: isDecidedByClue(completions, entry, placement, true),
      }));

      expect(result).toEqual(
        placement.reasonEntries.map(() => ({ matched: false, decided: true })),
      );
    },
  );
});

describe("reflectionTutorial の進行", () => {
  const started = finishTutorialIntro(startTutorial(reflectionTutorial));
  const lit = finishSteps(1);
  const exitLit = finishSteps(2);
  const selected = performAll(exitLit, [
    { type: "stock", piece: "black-hole" },
  ]);
  const placed = finishSteps(3);
  const released = finishSteps(steps.length);

  test("最初の手順は、印の外周ヒントを押させること", () => {
    const result = getReflectionTutorialStepTarget(
      getTutorialSituation(reflectionTutorial, started),
      started.boardState,
    );

    expect(result).toEqual({ type: "clue", entry: { side: "left", index: 1 } });
  });

  test("最初の手順で別の外周ヒントやストックやマスを押しても、何も起きないこと", () => {
    const result = performAll(started, [
      { type: "clue", entry: { side: "top", index: 0 } },
      { type: "stock", piece: "black-hole" },
      { type: "cell", cellIndex: 0 },
    ]);

    expect(result).toBe(started);
  });

  test("印の外周ヒントを押すと次の手順へ進み、押した光を次の手まで見せること", () => {
    const result = getReflectionTutorialLaserEntry(
      getTutorialSituation(reflectionTutorial, lit),
      lit.boardState,
    );

    expect(lit.stepIndex).toBe(1);
    expect(result).toEqual({ side: "left", index: 1 });
  });

  test("光を出すと、その光が出た先の外周ヒントに印を移し、出した光の外周ヒントとその光が通るマスを覆いから抜いたまま見せること", () => {
    const result = listReflectionTutorialSpotlitTargets(
      getTutorialSituation(reflectionTutorial, lit),
      lit.boardState,
    );

    expect(result).toEqual([
      { type: "clue", entry: { side: "right", index: 1 } },
      { type: "clue", entry: { side: "left", index: 1 } },
      ...[1, 2, 3, 4, 5].map((column) => ({
        type: "cell",
        cellIndex: cellAt(2, column),
      })),
    ]);
  });

  test("光が出た先の外周ヒントを押すと、そこから入れた光を見せること", () => {
    const result = getReflectionTutorialLaserEntry(
      getTutorialSituation(reflectionTutorial, exitLit),
      exitLit.boardState,
    );

    expect(exitLit.stepIndex).toBe(2);
    expect(result).toEqual({ side: "right", index: 1 });
  });

  test("置く手順では、まず印の種類を選ばせること", () => {
    const result = getReflectionTutorialStepTarget(
      getTutorialSituation(reflectionTutorial, exitLit),
      exitLit.boardState,
    );

    expect(result).toEqual({ type: "stock", piece: "black-hole" });
  });

  test("種類を選んだ後は印のマスを押させ、その手順の外周ヒントの今の光を見せること", () => {
    const situation = getTutorialSituation(reflectionTutorial, selected);

    const target = getReflectionTutorialStepTarget(
      situation,
      selected.boardState,
    );
    const light = getReflectionTutorialLaserEntry(
      situation,
      selected.boardState,
    );

    expect(target).toEqual({ type: "cell", cellIndex: cellAt(3, 3) });
    expect(light).toEqual({ side: "top", index: 2 });
  });

  test("種類を選ぶ前は、選ぶ種類と、置く場所を決める外周ヒントだけを覆いから抜き、前の手順の結果として残している光は抜かないこと", () => {
    const result = listReflectionTutorialSpotlitTargets(
      getTutorialSituation(reflectionTutorial, exitLit),
      exitLit.boardState,
    );

    expect(result).toEqual([
      { type: "stock", piece: "black-hole" },
      { type: "clue", entry: { side: "top", index: 2 } },
    ]);
  });

  test("置いて次の手順へ進むと、置いた手の結果の光ではなく、次の手順の選ぶ種類と決め手だけを覆いから抜くこと", () => {
    const result = listReflectionTutorialSpotlitTargets(
      getTutorialSituation(reflectionTutorial, placed),
      placed.boardState,
    );

    expect(result).toEqual([
      { type: "stock", piece: "slash" },
      { type: "clue", entry: { side: "bottom", index: 4 } },
      { type: "clue", entry: { side: "right", index: 3 } },
    ]);
  });

  test("種類を選んだ後は、置くマスと、置く場所を決める外周ヒントと、その外周ヒントから見せている光が通るマスを、覆いから抜くこと", () => {
    const result = listReflectionTutorialSpotlitTargets(
      getTutorialSituation(reflectionTutorial, selected),
      selected.boardState,
    );

    expect(result).toEqual([
      { type: "cell", cellIndex: cellAt(3, 3) },
      { type: "clue", entry: { side: "top", index: 2 } },
      ...[1, 2, 4, 5].map((row) => ({
        type: "cell",
        cellIndex: cellAt(row, 3),
      })),
    ]);
  });

  test("置く手順で、印の無い種類やマスや外周ヒントを押しても、選び直しても、何も起きないこと", () => {
    const result = performAll(selected, [
      { type: "stock", piece: "reflector" },
      { type: "stock", piece: "black-hole" },
      { type: "cell", cellIndex: cellAt(1, 3) },
      { type: "clue", entry: { side: "top", index: 2 } },
    ]);

    expect(result).toBe(selected);
  });

  test("印のマスに置くと次の手順へ進み、置いたマスと、その外周ヒントの今の光で手を返すこと", () => {
    const result = getReflectionTutorialLaserEntry(
      getTutorialSituation(reflectionTutorial, placed),
      placed.boardState,
    );

    expect(placed.stepIndex).toBe(3);
    expect(placed.boardState.lastMove?.fittedCellIndex).toBe(cellAt(3, 3));
    expect(result).toEqual({ side: "top", index: 2 });
  });

  test("手順を終えると手を離し、残りを置かせる一言を出すこと", () => {
    const result = getTutorialMessage(reflectionTutorial, released, {
      entry: "home",
      violationSettled: true,
    });

    expect(released.stepIndex).toBe(steps.length);
    expect(result).toBe(reflectionTutorial.freePlay);
  });

  test("手を離した後は、覆いから抜く所が無いこと", () => {
    const result = listReflectionTutorialSpotlitTargets(
      getTutorialSituation(reflectionTutorial, released),
      released.boardState,
    );

    expect(result).toEqual([]);
  });

  test("手を離した後、残りを置くと解けること", () => {
    const result = performAll(
      released,
      freePlacements.flatMap((placement): ReflectionTutorialAction[] => [
        { type: "stock", piece: placement.piece },
        { type: "cell", cellIndex: placement.cellIndex },
      ]),
    );

    expect(result.phase).toBe("solved");
  });

  test("手を離した後は本番と同じく、違う所に置いても止めずに続けられること", () => {
    const result = performAll(released, [
      { type: "stock", piece: "backslash" },
      { type: "cell", cellIndex: cellAt(1, 1) },
    ]);

    expect(result.phase).toBe("playing");
    expect(result.violated).toBe(false);
    expect(result.boardState.session.puzzleState.cells[cellAt(1, 1)]).toBe(
      "backslash",
    );
  });

  test("手を離した直後は、最後の手順の結果の光を、押して出した光として見せること", () => {
    const shown = getReflectionTutorialLaserEntry(
      getTutorialSituation(reflectionTutorial, released),
      released.boardState,
    );
    const closed = performAll(released, [
      { type: "clue", entry: { side: "left", index: 1 } },
    ]);

    expect(shown).toEqual({ side: "left", index: 1 });
    expect(closed.boardState.session.laserEntry).toBeNull();
  });

  test("手を離した後は、外周ヒントを押すと本番と同じくその光を見せること", () => {
    const progress = performAll(released, [
      { type: "clue", entry: { side: "left", index: 4 } },
    ]);

    const result = getReflectionTutorialLaserEntry(
      getTutorialSituation(reflectionTutorial, progress),
      progress.boardState,
    );

    expect(result).toEqual({ side: "left", index: 4 });
  });
});

describe("findReflectionTutorialHint", () => {
  const released = finishSteps(steps.length);
  const strayCases = [
    [
      "違う所に置いた",
      [
        { type: "stock", piece: "backslash" },
        { type: "cell", cellIndex: cellAt(1, 1) },
      ],
    ],
    [
      "置いてあったピースを違う所へ移した",
      [
        { type: "cell", cellIndex: cellAt(3, 3) },
        { type: "cell", cellIndex: cellAt(5, 5) },
      ],
    ],
    [
      "ピースを入れ替えた",
      [
        { type: "cell", cellIndex: cellAt(3, 3) },
        { type: "cell", cellIndex: cellAt(4, 4) },
      ],
    ],
    [
      "ピースをストックへ戻した",
      [
        { type: "cell", cellIndex: cellAt(4, 5) },
        { type: "stock", piece: "slash" },
      ],
    ],
    ["正しい所のピースを選んだ", [{ type: "cell", cellIndex: cellAt(2, 4) }]],
  ] as const satisfies readonly (readonly [
    string,
    readonly ReflectionTutorialAction[],
  ])[];
  const goal = reflectionTutorial.goal();

  test("手を離した直後は、次に置く種類を示すこと", () => {
    const result = findReflectionTutorialHint(released.boardState);

    expect(result).toEqual({ type: "stock", piece: freePlacements[0]?.piece });
  });

  describe("解と違う所に置いたピースがある場合", () => {
    const strayed = performAll(released, [
      { type: "stock", piece: "backslash" },
      { type: "cell", cellIndex: cellAt(1, 1) },
    ]);
    const blocked = performAll(strayed, [
      { type: "stock", piece: "vertical-double" },
      { type: "cell", cellIndex: cellAt(5, 1) },
    ]);

    test("ストックに残るピースを空いている正解のマスへ置ける間は、違うことを明かさず、置く種類を示すこと", () => {
      const result = findReflectionTutorialHint(strayed.boardState);

      expect(result).toEqual({ type: "stock", piece: "vertical-double" });
    });

    test("そう置ける手が無くなったら、違う所に置いたピースを示すこと", () => {
      const result = findReflectionTutorialHint(blocked.boardState);

      expect(result).toEqual({ type: "cell", cellIndex: cellAt(1, 1) });
    });
  });

  test("手を離した直後から、手がかりに従って押すと解けること", () => {
    const result = followHints(released, 20);

    expect(result).not.toBeNull();
  });

  test.each(strayCases)(
    "%s盤面からでも、手がかりに従って押すと解けること",
    (_, actions) => {
      const result = followHints(performAll(released, actions), 30);

      expect(result).not.toBeNull();
    },
  );

  test("解き終えた盤面では示さないこと", () => {
    const result = findReflectionTutorialHint(goal);

    expect(result).toBeNull();
  });
});

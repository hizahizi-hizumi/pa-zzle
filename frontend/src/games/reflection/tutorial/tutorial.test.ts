import { describe, expect, test } from "vitest";

import { doAllReflectionPiecesInfluenceClues } from "@/games/reflection/problem/generation/piece-influence";
import { countReflectionSolutions } from "@/games/reflection/problem/generation/solver";
import {
  type ReflectionBoard,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import {
  isSameReflectionEntry,
  listReflectionEntries,
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  isReflectionSolved,
  listReflectionClueMatches,
} from "@/games/reflection/puzzle/rules";
import { getReflectionSessionStock } from "@/games/reflection/session/session";
import {
  _private,
  describeReflectionTutorialMessage,
  findReflectionTutorialHint,
  getReflectionTutorialLaserEntry,
  getReflectionTutorialProgressRatio,
  getReflectionTutorialStepSpotlight,
  listReflectionTutorialStepMarks,
  REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT,
  type ReflectionTutorialAction,
  type ReflectionTutorialBoardState,
  type ReflectionTutorialRuleId,
  type ReflectionTutorialStep,
  reflectionTutorial,
} from "@/games/reflection/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { solution, problem, steps, freePlacements, cellAt, getStepStartBoard } =
  _private;

type Progress = TutorialProgress<
  ReflectionTutorialRuleId,
  ReflectionTutorialBoardState
>;

type Placement = { piece: ReflectionPiece; cellIndex: number };

const size = solution.size;
const entries = listReflectionEntries(size);

/** ピースごとに、その働きを伝えるルール。向きの違う斜め鏡・両面鏡は同じ働き。 */
const ruleByPiece = {
  slash: "mirror",
  backslash: "mirror",
  "vertical-double": "double",
  "horizontal-double": "double",
  reflector: "reflector",
  "black-hole": "black-hole",
} as const satisfies Record<ReflectionPiece, ReflectionTutorialRuleId>;

function getStep(index: number): ReflectionTutorialStep {
  const step = steps[index];
  if (!step) {
    throw new RangeError(`no tutorial step at ${index}`);
  }
  return step;
}

const operationStep = getStep(0);
const countingStep = getStep(1);
const choosingPieceStepIndex = steps.findIndex(
  (step) => step.choice === "piece",
);
const choosingPieceStep = getStep(choosingPieceStepIndex);
const readingStep = getStep(steps.length - 1);
const ruleSteps = steps.slice(1).map((step) => [step.cellIndex, step] as const);

type FreePlacement = Placement & { reasonEntries: readonly ReflectionEntry[] };

function getFreePlacement(index: number): FreePlacement {
  const placement = freePlacements[index];
  if (!placement) {
    throw new RangeError(`no free placement at ${index}`);
  }
  return placement;
}

const freePlacement = getFreePlacement(0);
const otherFreePlacement = getFreePlacement(1);

function entryIndex(entry: ReflectionEntry): number {
  return entries.findIndex((candidate) =>
    isSameReflectionEntry(candidate, entry),
  );
}

function withPiece(
  board: ReflectionBoard,
  { piece, cellIndex }: Placement,
): ReflectionBoard {
  const cells = [...board.cells];
  cells[cellIndex] = piece;
  return { size, cells };
}

function isClueMatched(board: ReflectionBoard, entry: ReflectionEntry) {
  return listReflectionClueMatches(board, problem.clues)[entryIndex(entry)];
}

function stockAt(board: ReflectionBoard): Record<ReflectionPiece, number> {
  return getReflectionSessionStock({
    ...reflectionTutorial.start().session,
    puzzleState: board,
  });
}

/** 盤面の空きマスに、ストックに残るピースのどれかを1つ置く手。 */
function listPlacements(
  board: ReflectionBoard,
  pieces: readonly ReflectionPiece[],
  cellIndices: readonly number[],
): Placement[] {
  return pieces.flatMap((piece) =>
    cellIndices
      .filter((cellIndex) => board.cells[cellIndex] === null)
      .map((cellIndex) => ({ piece, cellIndex })),
  );
}

function listEmptyCellIndices(board: ReflectionBoard): number[] {
  return board.cells.flatMap((cell, cellIndex) =>
    cell === null ? [cellIndex] : [],
  );
}

/** 問題の手持ちの種類すべて。置く物の候補は、人間向け解法器のレベル1と同じく、今の残り数ではなくこれで数える。 */
const inventoryPieces = reflectionPieces.filter(
  (piece) => problem.inventory[piece] > 0,
);

function listStockPieces(board: ReflectionBoard): ReflectionPiece[] {
  const stock = stockAt(board);
  return reflectionPieces.filter((piece) => stock[piece] > 0);
}

/** 手順の始めの盤面で、手順で選べる置き方。選ばせないマスとピースは手順のものに限る。 */
function listStepOptions(step: ReflectionTutorialStep): Placement[] {
  const start = getStepStartBoard(step);
  const choosesPiece = step.choice === "piece" || step.choice === "both";
  const choosesCell = step.choice === "cell" || step.choice === "both";
  return listPlacements(
    start,
    choosesPiece ? inventoryPieces : [step.piece],
    choosesCell ? listEmptyCellIndices(start) : [step.cellIndex],
  );
}

/** 置き方のうち、外周ヒント `entry` を一致させるもの。 */
function filterMatching(
  board: ReflectionBoard,
  placements: readonly Placement[],
  entry: ReflectionEntry,
): Placement[] {
  return placements.filter((placement) =>
    isClueMatched(withPiece(board, placement), entry),
  );
}

/** 手順の決め手の外周ヒントのうち、光を見せる最初のもの。 */
function lightEntryOf(step: ReflectionTutorialStep): ReflectionEntry {
  const [entry] = step.reasonEntries;
  if (!entry) {
    throw new RangeError("step has no reason entry");
  }
  return entry;
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

/** ストックで種類を選んでからマスに置く。前の手で同じ種類を選んだままなら、選び直さない。 */
function place(progress: Progress, { piece, cellIndex }: Placement): Progress {
  const { selection } = progress.boardState.session;
  const selected = selection?.type === "stock" && selection.piece === piece;
  return performAll(progress, [
    ...(selected ? [] : [{ type: "stock", piece } as const]),
    { type: "cell", cellIndex },
  ]);
}

function startPlaying(): Progress {
  return finishTutorialIntro(startTutorial(reflectionTutorial));
}

/** 最初の `count` 個の手順を、手順どおりに置いて終える。 */
function finishSteps(count: number): Progress {
  return steps.slice(0, count).reduce(place, startPlaying());
}

function situationOf(progress: Progress) {
  return getTutorialSituation(reflectionTutorial, progress);
}

function messageOf(progress: Progress) {
  return describeReflectionTutorialMessage(
    situationOf(progress),
    progress.boardState,
  );
}

function marksOf(progress: Progress) {
  return listReflectionTutorialStepMarks(
    situationOf(progress),
    progress.boardState,
  );
}

const afterStepsBoard = steps.reduce(
  (board, step) => withPiece(board, step),
  getStepStartBoard(operationStep),
);

describe("盤面", () => {
  test("解が手持ちと外周ヒントに合うただ1つの配置であること", () => {
    const result = countReflectionSolutions(problem, {
      searchStepLimit: 4_000_000,
    });

    expect(isReflectionSolved(solution, problem)).toBe(true);
    expect(result).toMatchObject({ solutionCount: 1 });
  });

  test("どのピースも外周ヒントを変えること", () => {
    const result = doAllReflectionPiecesInfluenceClues(solution);

    expect(result).toBe(true);
  });

  test("本番のレベル1と同じ大きさで4つの働きのピースをすべて使うこと", () => {
    const rules = new Set(inventoryPieces.map((piece) => ruleByPiece[piece]));

    expect(size).toBe(5);
    expect(rules).toEqual(
      new Set(["black-hole", "mirror", "reflector", "double"]),
    );
  });

  test("手順と手を離した後で解のピースをちょうど1回ずつ置くこと", () => {
    const placed = [...steps, ...freePlacements]
      .map(({ cellIndex, piece }) => `${cellIndex}:${piece}`)
      .sort();

    expect(placed).toEqual(
      solution.cells
        .flatMap((cell, cellIndex) =>
          cell === null ? [] : [`${cellIndex}:${cell}`],
        )
        .sort(),
    );
  });
});

describe("手を引く間の盤面", () => {
  test("操作を教える手順がゴールの盤面と同じ所に置き置いた結果の外周ヒントを緑にすること", () => {
    const before = getStepStartBoard(operationStep);
    const after = withPiece(before, operationStep);

    expect(operationStep.choice).toBe("none");
    expect(solution.cells[operationStep.cellIndex]).toBe(operationStep.piece);
    expect(isClueMatched(before, operationStep.resultEntry)).toBe(false);
    expect(isClueMatched(after, operationStep.resultEntry)).toBe(true);
  });

  test.each(ruleSteps)(
    "決め手の外周ヒントとそれまでのピースだけで選べる置き方から1つに決まること: マス %i",
    (_, step) => {
      const start = getStepStartBoard(step);
      const entry = lightEntryOf(step);

      const matching = step.reasonEntries.reduce(
        (options, reason) => filterMatching(start, options, reason),
        listStepOptions(step),
      );

      expect(isClueMatched(start, entry)).toBe(false);
      expect(matching).toEqual([
        { piece: step.piece, cellIndex: step.cellIndex },
      ]);
    },
  );

  test.each(ruleSteps)(
    "選べる置き方が2つ以上あり考えずに印を押すだけでは通れないこと: マス %i",
    (_, step) => {
      const options = listStepOptions(step);

      expect(step.choice).not.toBe("none");
      expect(options.length).toBeGreaterThanOrEqual(2);
    },
  );

  test.each(steps.map((step) => [step.cellIndex, step] as const))(
    "決め手と結果の外周ヒントが置いた後の盤面で一致すること: マス %i",
    (_, step) => {
      const after = withPiece(getStepStartBoard(step), step);

      const matched = [...step.reasonEntries, step.resultEntry].map((entry) =>
        isClueMatched(after, entry),
      );

      expect(matched.every(Boolean)).toBe(true);
    },
  );

  test.each(steps.map((step, index) => [index, step] as const))(
    "手順どおりに置く手でそれまで緑だった外周ヒントが緑でなくならないこと: 手順 %i",
    (_, step) => {
      const before = getStepStartBoard(step);

      const after = withPiece(before, step);

      const lost = entries.filter(
        (entry) => isClueMatched(before, entry) && !isClueMatched(after, entry),
      );
      expect(lost).toEqual([]);
    },
  );

  test.each(ruleSteps)(
    "決め手の光が置くマスのほかは空きマスだけを通りまだ伝えていないピースの働きを要らないこと: マス %i",
    (_, step) => {
      const after = withPiece(getStepStartBoard(step), step);

      const path = traceReflectionLaser(after, lightEntryOf(step)).path.map(
        ({ cellIndex }) => cellIndex,
      );

      expect(
        path.filter(
          (cellIndex) =>
            cellIndex !== step.cellIndex && after.cells[cellIndex] !== null,
        ),
      ).toEqual([]);
    },
  );

  test("ピースの働きのルールがどれもそのピースを選んで置く手順の手を決めること", () => {
    const decidingRules = new Set(
      steps.flatMap((step) =>
        step.choice === "none" ? [] : [ruleByPiece[step.piece]],
      ),
    );

    for (const { id } of reflectionTutorial.rules) {
      if (id !== "number") {
        expect(decidingRules.has(id)).toBe(true);
      }
    }
  });

  test("数字のルールがブラックホールを置くマスを数えて選ぶ手順の手を決めること", () => {
    const numberStep = steps.find((step) => step.introducedRuleId === "number");

    expect(numberStep).toBe(countingStep);
    expect(countingStep).toMatchObject({ piece: "black-hole", choice: "cell" });
  });

  test("ピースの働きを伝える手順がそのピースを置かせること", () => {
    const pieceRuleSteps = steps.filter(
      (step) =>
        step.introducedRuleId !== null && step.introducedRuleId !== "number",
    );

    for (const step of pieceRuleSteps) {
      expect(ruleByPiece[step.piece]).toBe(step.introducedRuleId);
    }
  });

  test("最後の手順が置くマスとピースの両方を1本の外周ヒントから選ばせること", () => {
    const options = listStepOptions(readingStep);

    expect(readingStep.choice).toBe("both");
    expect(new Set(options.map(({ piece }) => piece)).size).toBeGreaterThan(1);
  });
});

describe("performTutorialAction", () => {
  describe("手順で指していない所への手", () => {
    const progress = startPlaying();
    const ignoredActions = [
      { type: "stock", piece: "reflector" },
      { type: "cell", cellIndex: cellAt(1, 1) },
      { type: "clue", entry: { side: "left", index: 0 } },
    ] as const;

    test.each(ignoredActions)("受け付けないこと: %o", (action) => {
      const result = performTutorialAction(
        reflectionTutorial,
        progress,
        action,
      );

      expect(result).toBe(progress);
    });
  });

  describe("操作を教える手順で印でないマスへ置く手", () => {
    const selected = performTutorialAction(reflectionTutorial, startPlaying(), {
      type: "stock",
      piece: operationStep.piece,
    });

    test("受け付けないこと", () => {
      const result = performTutorialAction(reflectionTutorial, selected, {
        type: "cell",
        cellIndex: cellAt(1, 1),
      });

      expect(result).toBe(selected);
    });
  });

  describe("前の手順で置いたピースを選ぶ手", () => {
    const progress = finishSteps(2);

    test("受け付けないこと", () => {
      const result = performTutorialAction(reflectionTutorial, progress, {
        type: "cell",
        cellIndex: operationStep.cellIndex,
      });

      expect(result).toBe(progress);
    });
  });

  describe("手順どおりに置く手", () => {
    const cases = steps.map(
      (step, index) => [index, step, finishSteps(index)] as const,
    );

    test.each(cases)(
      "次の手順へ進み置いた結果の光を見せること: 手順 %i",
      (index, step, before) => {
        const after = place(before, step);

        expect(situationOf(before).step).toBe(step);
        expect(after.stepIndex).toBe(index + 1);
        expect(after.boardState.lastMove).toMatchObject({
          fittedCellIndex: step.cellIndex,
          litEntry: step.resultEntry,
        });
      },
    );

    test("すべての手順を終えると手を離すこと", () => {
      const result = finishSteps(steps.length);

      expect(situationOf(result).step).toBeNull();
    });
  });

  describe("マスを選ばせる手順で違うマスに置く手", () => {
    const wrongCellIndex = cellAt(3, 1);
    const before = finishSteps(1);

    test("ルールに合わない手として手順に留まること", () => {
      const result = place(before, {
        piece: countingStep.piece,
        cellIndex: wrongCellIndex,
      });

      expect(result.violated).toBe(true);
      expect(result.stepIndex).toBe(1);
    });

    test("置いたピースを選んで正しいマスを押すと動いて次へ進むこと", () => {
      const wrong = place(before, {
        piece: countingStep.piece,
        cellIndex: wrongCellIndex,
      });

      const result = performAll(wrong, [
        { type: "cell", cellIndex: wrongCellIndex },
        { type: "cell", cellIndex: countingStep.cellIndex },
      ]);

      expect(result.stepIndex).toBe(2);
    });
  });

  describe("ピースを選ばせる手順で違う向きを置く手", () => {
    const wrong = place(finishSteps(choosingPieceStepIndex), {
      piece: "slash",
      cellIndex: choosingPieceStep.cellIndex,
    });

    test("置いたピースを選んで別のピースを押すと置き換わって次へ進むこと", () => {
      const result = performAll(wrong, [
        { type: "cell", cellIndex: choosingPieceStep.cellIndex },
        { type: "stock", piece: choosingPieceStep.piece },
      ]);

      expect(wrong.violated).toBe(true);
      expect(result.stepIndex).toBe(choosingPieceStepIndex + 1);
    });
  });

  describe("手を離した後", () => {
    const freePlaying = finishSteps(steps.length);

    test("本番と同じく外周ヒントを押して光を出せること", () => {
      const result = performTutorialAction(reflectionTutorial, freePlaying, {
        type: "clue",
        entry: { side: "left", index: 0 },
      });

      expect(result.boardState.session.laserEntry).toEqual({
        side: "left",
        index: 0,
      });
    });

    test("本番と同じく置いたピースを動かせること", () => {
      const result = performAll(freePlaying, [
        { type: "cell", cellIndex: operationStep.cellIndex },
        { type: "cell", cellIndex: cellAt(1, 1) },
      ]);

      expect(result.boardState.session.puzzleState.cells[cellAt(1, 1)]).toBe(
        operationStep.piece,
      );
    });

    test("残りをどちらから置いても解けること", () => {
      const results = [
        [freePlacement, otherFreePlacement],
        [otherFreePlacement, freePlacement],
      ].map((order) => order.reduce(place, freePlaying));

      expect(results.map(({ phase }) => phase)).toEqual(["solved", "solved"]);
    });

    test("本番と同じくピースごとの正誤を示さず手持ちをすべて置いても揃わない手をルールに合わない手としないこと", () => {
      const result = [
        { piece: freePlacement.piece, cellIndex: cellAt(4, 4) },
        otherFreePlacement,
      ].reduce(place, freePlaying);

      expect(result.phase).toBe("playing");
      expect(result.violated).toBe(false);
    });
  });
});

describe("手を離した後の盤面", () => {
  /** 残りのピースごとに、手を離した直後の盤面と、もう一方を先に置いた盤面。どちらから置いても読みが要るか確かめる。 */
  const freeCases = freePlacements.flatMap((placement) => {
    const others = freePlacements.filter((other) => other !== placement);
    return [
      [placement.piece, "手を離した直後", placement, afterStepsBoard] as const,
      [
        placement.piece,
        "もう一方を先に置いた後",
        placement,
        others.reduce(withPiece, afterStepsBoard),
      ] as const,
    ];
  });

  test("残りのピースが2種類あり種類も選ばせること", () => {
    const pieces = listStockPieces(afterStepsBoard);

    expect(pieces).toHaveLength(2);
  });

  test.each(freeCases)(
    "残りのピースが1本の外周ヒントで置く場所と種類まで決まること: %s（%s）",
    (_, __, placement, board) => {
      const options = listPlacements(
        board,
        inventoryPieces,
        listEmptyCellIndices(board),
      );

      const matching = placement.reasonEntries.map((entry) =>
        filterMatching(board, options, entry),
      );

      for (const entry of placement.reasonEntries) {
        expect(isClueMatched(board, entry)).toBe(false);
      }
      expect(matching).toEqual(
        placement.reasonEntries.map(() => [
          { piece: placement.piece, cellIndex: placement.cellIndex },
        ]),
      );
    },
  );

  test("残りのピースを置くと解けること", () => {
    const result = freePlacements.reduce(withPiece, afterStepsBoard);

    expect(isReflectionSolved(result, problem)).toBe(true);
  });
});

describe("describeReflectionTutorialMessage", () => {
  describe("操作を教える手順で印のピースを選んだ盤面", () => {
    const selected = performTutorialAction(reflectionTutorial, startPlaying(), {
      type: "stock",
      piece: operationStep.piece,
    });

    test("置く操作の一言に替わること", () => {
      const result = messageOf(selected);

      expect(result).toEqual(operationStep.midwayMessage);
    });
  });

  describe("マスを選ばせる手順で違うマスに置いた盤面", () => {
    const wrongCellIndex = cellAt(3, 1);
    const wrong = place(finishSteps(1), {
      piece: countingStep.piece,
      cellIndex: wrongCellIndex,
    });
    const selected = performTutorialAction(reflectionTutorial, wrong, {
      type: "cell",
      cellIndex: wrongCellIndex,
    });

    test("決め手の光が今どう進むかと直し方を言うこと", () => {
      const result = messageOf(wrong);

      expect(result).toEqual({
        headline: "光が3マス目で止まります",
        detail: "置いたピースをタップしてから\n別のマスをタップします",
      });
    });

    test("置いたピースを選ぶと次に押す所を言うこと", () => {
      const result = messageOf(selected);

      expect(result.detail).toBe("別のマスをタップして動かします");
    });
  });

  describe("数字どおりのマス数で出るが出た先の数字が違う盤面", () => {
    const wrong = place(finishSteps(steps.length - 1), {
      piece: "backslash",
      cellIndex: readingStep.cellIndex,
    });

    test("出た先の数字と合っていないことを言うこと", () => {
      const result = messageOf(wrong);

      expect(result.headline).toBe("光が出た先の数字と合っていません");
    });
  });

  describe("ピースを選ばせる手順で違う向きを置いた盤面", () => {
    const wrong = place(finishSteps(choosingPieceStepIndex), {
      piece: "slash",
      cellIndex: choosingPieceStep.cellIndex,
    });

    test("別のピースを押す直し方を言うこと", () => {
      const result = messageOf(wrong);

      expect(result.detail).toBe(
        "置いたピースをタップしてから\n別のピースをタップします",
      );
    });
  });

  describe("手を離した後に手持ちをすべて置いても揃わない盤面", () => {
    const wrong = [
      { piece: freePlacement.piece, cellIndex: cellAt(4, 4) },
      otherFreePlacement,
    ].reduce(place, finishSteps(steps.length));

    test("緑でない数字があることを言うこと", () => {
      const result = messageOf(wrong);

      expect(result.headline).toBe("緑でない数字があります");
    });
  });
});

describe("listReflectionTutorialStepMarks", () => {
  const start = startPlaying();
  const selected = performTutorialAction(reflectionTutorial, start, {
    type: "stock",
    piece: operationStep.piece,
  });
  const reading = finishSteps(steps.length - 1);
  const otherPieceSelected = performTutorialAction(
    reflectionTutorial,
    finishSteps(choosingPieceStepIndex),
    { type: "stock", piece: "black-hole" },
  );
  const wrongCellIndex = cellAt(3, 1);
  const wrong = place(finishSteps(1), {
    piece: countingStep.piece,
    cellIndex: wrongCellIndex,
  });

  test("選ばせないピースをストックで指し選ばせないマスを輪郭で示すこと", () => {
    const result = marksOf(start);

    expect(result).toEqual([
      { target: { type: "stock", piece: operationStep.piece }, pointed: true },
      {
        target: { type: "cell", cellIndex: operationStep.cellIndex },
        pointed: false,
      },
    ]);
  });

  test("ピースを選んでもマスは指で隠さず輪郭だけで示すこと", () => {
    const result = marksOf(selected);

    expect(result).toEqual([
      {
        target: { type: "cell", cellIndex: operationStep.cellIndex },
        pointed: false,
      },
    ]);
  });

  test("置くマスを選ばせる手順ではピースを選んだ後も名前のピースに輪郭を残すこと", () => {
    const result = marksOf(finishSteps(1));

    expect(result).toEqual([
      { target: { type: "stock", piece: countingStep.piece }, pointed: false },
    ]);
  });

  test("置くピースを選ばせる手順では別のピースを選んだままでもマスを指さず名前のピースに輪郭を付けること", () => {
    const result = marksOf(otherPieceSelected);

    expect(result).toEqual([
      {
        target: { type: "stock", piece: choosingPieceStep.piece },
        pointed: false,
      },
      {
        target: { type: "cell", cellIndex: choosingPieceStep.cellIndex },
        pointed: false,
      },
    ]);
  });

  test("斜め鏡の手順では向きを選ばせるよう両方の斜め鏡に輪郭を付けること", () => {
    const result = marksOf(finishSteps(2));

    expect(result).toEqual([
      { target: { type: "stock", piece: "slash" }, pointed: false },
      { target: { type: "stock", piece: "backslash" }, pointed: false },
    ]);
  });

  test("置くマスとピースの両方を選ばせる手順では印を付けないこと", () => {
    const result = marksOf(reading);

    expect(result).toEqual([]);
  });

  test("違う所に置いたピースを直す所として輪郭で示すこと", () => {
    const result = marksOf(wrong);

    expect(result).toEqual([
      { target: { type: "cell", cellIndex: wrongCellIndex }, pointed: false },
    ]);
  });
});

describe("getReflectionTutorialStepSpotlight", () => {
  const operation = startPlaying();
  const counting = finishSteps(1);
  const countingPath = traceReflectionLaser(
    counting.boardState.session.puzzleState,
    lightEntryOf(countingStep),
  ).path.map(({ cellIndex }) => cellIndex);

  test("操作を教える手順では覆わないこと", () => {
    const result = getReflectionTutorialStepSpotlight(
      situationOf(operation),
      operation.boardState,
    );

    expect(result).toEqual({ entries: [], cellIndices: [] });
  });

  test("決め手の外周ヒントとその光が通るマスを抜くこと", () => {
    const result = getReflectionTutorialStepSpotlight(
      situationOf(counting),
      counting.boardState,
    );

    expect(result.entries).toEqual(countingStep.reasonEntries);
    expect(result.cellIndices).toEqual(expect.arrayContaining(countingPath));
    expect(result.cellIndices).toContain(countingStep.cellIndex);
  });
});

describe("getReflectionTutorialLaserEntry", () => {
  const counting = finishSteps(1);

  test("手順の間は決め手の今の光を見せること", () => {
    const result = getReflectionTutorialLaserEntry(
      situationOf(counting),
      counting.boardState,
      false,
    );

    expect(result).toEqual(lightEntryOf(countingStep));
  });

  test("手順を終えた結果を見せる間はその結果の光を見せること", () => {
    const result = getReflectionTutorialLaserEntry(
      situationOf(counting),
      counting.boardState,
      true,
    );

    expect(result).toEqual(operationStep.resultEntry);
  });
});

describe("findReflectionTutorialHint", () => {
  const freePlaying = finishSteps(steps.length);
  const selected = performTutorialAction(reflectionTutorial, freePlaying, {
    type: "stock",
    piece: freePlacement.piece,
  });
  // 縦の両面鏡を斜め鏡の置き場所に置いてふさぎ、ストックに置ける物を残さない。
  const wrongCellIndex = freePlacement.cellIndex;
  const wrong = place(freePlaying, {
    piece: otherFreePlacement.piece,
    cellIndex: wrongCellIndex,
  });
  const wrongSelected = performTutorialAction(reflectionTutorial, wrong, {
    type: "cell",
    cellIndex: wrongCellIndex,
  });

  test("残りのピースを決め手の外周ヒントと一緒に選ばせること", () => {
    const result = findReflectionTutorialHint(freePlaying.boardState);

    expect(result).toMatchObject({
      target: { type: "stock", piece: freePlacement.piece },
      reasonEntries: freePlacement.reasonEntries,
    });
  });

  test("ピースを選んだらその置き場所を示すこと", () => {
    const result = findReflectionTutorialHint(selected.boardState);

    expect(result).toMatchObject({
      target: { type: "cell", cellIndex: freePlacement.cellIndex },
      reasonEntries: freePlacement.reasonEntries,
    });
  });

  test("違う所に置いたピースが置き場所をふさいだらそのピースを示すこと", () => {
    const result = findReflectionTutorialHint(wrong.boardState);

    expect(result).toMatchObject({
      target: { type: "cell", cellIndex: wrongCellIndex },
      reasonEntries: [],
    });
  });

  test("違う所に置いたピースを選んだらその解のマスを示すこと", () => {
    const result = findReflectionTutorialHint(wrongSelected.boardState);

    expect(result).toMatchObject({
      target: { type: "cell", cellIndex: otherFreePlacement.cellIndex },
    });
  });
});

describe("getReflectionTutorialProgressRatio", () => {
  const wrong = place(finishSteps(1), {
    piece: countingStep.piece,
    cellIndex: cellAt(3, 1),
  });

  test("段の数が置くピースの数であること", () => {
    const result = REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT;

    expect(result).toBe(steps.length + freePlacements.length);
  });

  test("解と同じマスに置いたピースの割合で進むこと", () => {
    const result = getReflectionTutorialProgressRatio(
      finishSteps(steps.length).boardState,
    );

    expect(result).toBe(steps.length / REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT);
  });

  test("違うマスに置いたピースでは進まないこと", () => {
    const result = getReflectionTutorialProgressRatio(wrong.boardState);

    expect(result).toBe(1 / REFLECTION_TUTORIAL_PROGRESS_STEP_COUNT);
  });
});

describe("一言", () => {
  const {
    fixDetails,
    unsolvedMessage,
    mistakenHintMessage,
    pieceRuleMessages,
    describeLight,
  } = _private;
  /** 光の行き先ごとに、盤面で起こりうるいちばん長い言い方。 */
  const longestLights = (["top", "left"] as const).map((side) =>
    describeLight(
      { size, cells: Array.from({ length: size * size }, () => null) },
      { side, index: 0 },
    ),
  );
  const texts = [
    ...[
      ...steps.flatMap((step) => [
        step.message,
        ...(step.midwayMessage ? [step.midwayMessage] : []),
      ]),
      reflectionTutorial.freePlay,
      reflectionTutorial.completion.home,
      reflectionTutorial.completion.play,
      unsolvedMessage,
      mistakenHintMessage,
      ...Object.values(pieceRuleMessages),
    ].flatMap(({ headline, detail }) => [
      headline,
      ...(detail === null ? [] : [detail]),
    ]),
    ...Object.values(fixDetails).flatMap(({ unselected, selected }) => [
      unselected,
      selected,
    ]),
    ...longestLights,
    "光が13マス通って戻ります",
    describeLight(
      {
        size,
        cells: Array.from({ length: size * size }, (_, cellIndex) =>
          cellIndex === cellAt(1, 2) ? "slash" : null,
        ),
      },
      { side: "top", index: 1 },
    ),
    "光が13マス目で止まります",
    reflectionTutorial.intro.purpose,
    reflectionTutorial.intro.goalCaption,
  ];
  const recap = reflectionTutorial.rules.map(({ label }) => label);

  test.each(recap)(
    "振り返りが全角45字までで改行と読点と句点を打たないこと: %s",
    (label) => {
      expect(label.length).toBeLessThanOrEqual(45);
      expect(label).not.toMatch(/[、。\n]/);
    },
  );

  test.each(texts)(
    "全角45字まで3行までで読点と句点を打たないこと: %s",
    (text) => {
      expect(text.split("\n").length).toBeLessThanOrEqual(3);
      expect(text.replaceAll("\n", "").length).toBeLessThanOrEqual(45);
      expect(text).not.toMatch(/[、。]/);
    },
  );
});

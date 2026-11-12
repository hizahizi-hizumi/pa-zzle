import {
  createHitofudePuzzleAdjacency,
  getHitofudePuzzleCellPosition,
  isHitofudePuzzleHole,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  findHitofudePuzzleStranding,
  isHitofudePuzzleDeadEnd,
} from "@/games/hitofude-puzzle/puzzle/rules";
import {
  _private,
  describeHitofudePuzzleTutorialHint,
  findHitofudePuzzleTutorialHint,
  findHitofudePuzzleTutorialViolation,
  getHitofudePuzzleTutorialProgressRatio,
  getHitofudePuzzleTutorialStepMarks,
  HITOFUDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT,
  type HitofudePuzzleTutorialAction,
  type HitofudePuzzleTutorialBoardState,
  type HitofudePuzzleTutorialRuleId,
  type HitofudePuzzleTutorialStep,
  hitofudePuzzleTutorial,
} from "@/games/hitofude-puzzle/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { board, solution, findVisibleStranding } = _private;
const { steps } = hitofudePuzzleTutorial;

type Progress = TutorialProgress<
  HitofudePuzzleTutorialRuleId,
  HitofudePuzzleTutorialBoardState
>;

const allRuleIds: readonly HitofudePuzzleTutorialRuleId[] = [
  "hole",
  "all",
  "narrow",
];

const adjacency = createHitofudePuzzleAdjacency(board);

/** 始点から全マスを通る道をすべて挙げる。 */
function listSolutions(): number[][] {
  const openCount = listHitofudePuzzleOpenCells(board).length;
  const solutions: number[][] = [];
  function extend(path: number[]): void {
    if (path.length === openCount) {
      solutions.push(path);
      return;
    }
    for (const next of adjacency[path.at(-1) ?? board.start] ?? []) {
      if (!path.includes(next)) {
        extend([...path, next]);
      }
    }
  }
  extend([board.start]);
  return solutions;
}

function listUnvisitedNeighbors(path: readonly number[]): number[] {
  return (adjacency[path.at(-1) ?? board.start] ?? []).filter(
    (cell) => !path.includes(cell),
  );
}

/** 伝えたルールで、全マスを通れなくなったと分からない道か。 */
function isAcceptable(
  path: readonly number[],
  ruleIds: readonly HitofudePuzzleTutorialRuleId[],
): boolean {
  return findVisibleStranding(path, ruleIds) === null;
}

function listTaughtRuleIds(
  step: HitofudePuzzleTutorialStep,
): HitofudePuzzleTutorialRuleId[] {
  return steps
    .slice(0, steps.indexOf(step) + 1)
    .flatMap((taught) => taught.introducedRuleId ?? []);
}

function getStepStart(step: HitofudePuzzleTutorialStep): number[] {
  return solution.slice(0, solution.indexOf(step.route[0] ?? board.start));
}

/**
 * 先端から `target` まで、穴と通ったマスをよけて、伝えたルールで全マスを通れなくなったと分からない道筋のうち、最も短いものをすべて挙げる。
 */
function listShortestRoutes(
  start: readonly number[],
  target: number,
  ruleIds: readonly HitofudePuzzleTutorialRuleId[],
): number[][] {
  let frontier: number[][] = [[...start]];
  while (frontier.length > 0) {
    const reached = frontier.filter((path) => path.at(-1) === target);
    if (reached.length > 0) {
      return reached.map((path) => path.slice(start.length));
    }
    frontier = frontier.flatMap((path) =>
      listUnvisitedNeighbors(path)
        .map((cell) => [...path, cell])
        .filter((path_) => isAcceptable(path_, ruleIds)),
    );
  }
  return [];
}

/** 先端から一直線に `target` へ向かう、間のマス（`target` を含む）。一直線に並ばなければ `null`。 */
function listStraightCells(from: number, target: number): number[] | null {
  const origin = getHitofudePuzzleCellPosition(board.size, from);
  const goal = getHitofudePuzzleCellPosition(board.size, target);
  if (origin.row !== goal.row && origin.column !== goal.column) {
    return null;
  }
  const stride =
    Math.sign(goal.row - origin.row) * board.size +
    Math.sign(goal.column - origin.column);
  const cells: number[] = [];
  for (let cell = from + stride; cells.at(-1) !== target; cell += stride) {
    cells.push(cell);
  }
  return cells;
}

function createProgress(path: readonly number[], stepIndex: number): Progress {
  const started = finishTutorialIntro(startTutorial(hitofudePuzzleTutorial));
  return {
    ...started,
    boardState: { path, moveCount: 0, lastMove: null },
    stepIndex,
    earnedRuleIds: steps
      .slice(0, stepIndex + 1)
      .flatMap((step) => step.introducedRuleId ?? []),
  };
}

function act(
  progress: Progress,
  action: HitofudePuzzleTutorialAction,
): Progress {
  return performTutorialAction(hitofudePuzzleTutorial, progress, action);
}

function pressCells(progress: Progress, cells: readonly number[]): Progress {
  return cells.reduce(
    (current, cell) => act(current, { type: "press", cell }),
    progress,
  );
}

/** 入口を終えてから、手順を `count` 個、解のとおりに終えた進行。 */
function playSteps(count: number): Progress {
  return steps
    .slice(0, count)
    .reduce(
      (progress, step) => pressCells(progress, step.route),
      finishTutorialIntro(startTutorial(hitofudePuzzleTutorial)),
    );
}

const freePlayStart = solution.slice(
  0,
  solution.indexOf(steps.at(-1)?.route.at(-1) ?? board.start) + 1,
);

/** 道の途中の盤面。 */
function boardStateOf(
  path: readonly number[],
): HitofudePuzzleTutorialBoardState {
  return { path, moveCount: 0, lastMove: null };
}

function getMessage(progress: Progress): string {
  return getTutorialMessage(hitofudePuzzleTutorial, progress, {
    entry: "home",
    violationSettled: true,
  }).headline;
}

function findStepIntroducing(
  ruleId: HitofudePuzzleTutorialRuleId,
): HitofudePuzzleTutorialStep {
  const step = steps.find((candidate) => candidate.introducedRuleId === ruleId);
  if (step === undefined) {
    throw new Error(`No step introduces ${ruleId}`);
  }
  return step;
}

describe("hitofudePuzzleTutorial の盤面", () => {
  const ruleSteps = steps.filter((step) => step.introducedRuleId !== null);
  const singleTargetRuleSteps = ruleSteps.filter(
    (step) => step.marks.length === 1,
  );
  const choiceSteps = steps.filter((step) => step.marks.length > 1);
  const freePlayPaths = Array.from(
    { length: solution.length - freePlayStart.length },
    (_, offset) => solution.slice(0, freePlayStart.length + offset),
  );
  const guidedPaths = freePlayStart.map((_, index) =>
    freePlayStart.slice(0, index + 1),
  );

  test("始点から全マスを通る道がゴールの1本だけであること", () => {
    const solutions = listSolutions();

    expect(solutions).toEqual([solution]);
  });

  test("手順の道筋をつなぐとゴールの道の途中になり、手順の行き先が印のマスの1つであること", () => {
    const routes = steps.flatMap((step) => step.route);

    expect(routes).toEqual(freePlayStart.slice(1));
    for (const step of steps) {
      expect(step.marks).toContain(step.route.at(-1));
    }
  });

  test("操作を教える手順が、ゴールの盤面と一致すること", () => {
    const [operation] = steps;

    expect(operation?.introducedRuleId).toBeNull();
    expect(operation?.route).toEqual(solution.slice(1, 2));
  });

  test("手順の道筋の途中の盤面が、どのルールにも反しないこと", () => {
    const strandings = guidedPaths.map(
      (path) =>
        isHitofudePuzzleDeadEnd(board, path) ||
        findHitofudePuzzleStranding(board, path) !== null,
    );

    expect(strandings.every((stranded) => !stranded)).toBe(true);
  });

  test.each(singleTargetRuleSteps)(
    "1つの行き先へ向かう手順の道筋が、それまでに伝えたルールに合う、印までの最も短い道筋の1つだけであること: $introducedRuleId",
    (step) => {
      const routes = listShortestRoutes(
        getStepStart(step),
        step.route.at(-1) ?? board.start,
        listTaughtRuleIds(step),
      );

      expect(routes).toEqual([step.route]);
    },
  );

  test.each(choiceSteps)(
    "行き先を選ぶ手順が、伝えたルールで1つに決まり、その手順のルールを伝える前は決まらないこと: $introducedRuleId",
    (step) => {
      const start = getStepStart(step);
      const taught = listTaughtRuleIds(step);
      // 印へ最も短く進む道筋が、伝えたルールで全マスを通れなくなると分からないまま残るか。
      function listReachableMarks(
        ruleIds: readonly HitofudePuzzleTutorialRuleId[],
      ): number[] {
        return step.marks.filter((mark) => {
          const shortestLength =
            listShortestRoutes(start, mark, [])[0]?.length ?? 0;
          return listShortestRoutes(start, mark, ruleIds).some(
            (route) => route.length === shortestLength,
          );
        });
      }

      const reachableWithStepRule = listReachableMarks(taught);
      const reachableWithoutStepRule = listReachableMarks(taught.slice(0, -1));

      expect(reachableWithStepRule).toEqual([step.route.at(-1)]);
      expect(reachableWithoutStepRule).toEqual(step.marks);
    },
  );

  test.each(ruleSteps)(
    "ルールを伝える手順が、考えずに印へまっすぐ進むとそのルールに当たるか、行き先を選ばせること: $introducedRuleId",
    (step) => {
      const start = getStepStart(step);
      const line = listStraightCells(
        start.at(-1) ?? board.start,
        step.route.at(-1) ?? board.start,
      );

      const hitsRule =
        line !== null &&
        line.join() !== step.route.join() &&
        (isHitofudePuzzleHole(board, line[0] ?? board.start) ||
          !isAcceptable([...start, ...line], listTaughtRuleIds(step)));

      expect(hitsRule || step.marks.length >= 2).toBe(true);
    },
  );

  describe("穴を伝える手順", () => {
    const step = findStepIntroducing("hole");
    const start = getStepStart(step);

    test("先端から印へ一直線に進むと、穴に当たること", () => {
      const line = listStraightCells(
        start.at(-1) ?? board.start,
        step.route.at(-1) ?? board.start,
      );

      expect(isHitofudePuzzleHole(board, line?.[0] ?? board.start)).toBe(true);
    });
  });

  describe("すべてのマスを伝える手順", () => {
    const step = findStepIntroducing("all");
    const start = getStepStart(step);

    test("先端から印へ一直線に進むと、決め手のマスへ入れなくなること", () => {
      const line =
        listStraightCells(
          start.at(-1) ?? board.start,
          step.route.at(-1) ?? board.start,
        ) ?? [];

      const stranding = findVisibleStranding(
        [...start, ...line],
        ["hole", "all"],
      );

      expect(line.length).toBeGreaterThan(1);
      expect(stranding).toEqual({ kind: "stranded", cells: step.reasonCells });
    });
  });

  describe("通れる隣が少ないマスを伝える手順", () => {
    const step = findStepIntroducing("narrow");
    const atFork = [...getStepStart(step), ...step.route.slice(0, -1)];
    const head = atFork.at(-1) ?? board.start;
    /** 穴でも通ったマスでもない隣と、先端。 */
    function listPassableNeighbors(cell: number): number[] {
      return (adjacency[cell] ?? []).filter(
        (neighbor) => !atFork.includes(neighbor) || neighbor === head,
      );
    }

    test("行き先は、通れる隣が先端と決め手のマスの2つだけのマスであること", () => {
      const neighbors = listPassableNeighbors(step.route.at(-1) ?? board.start);

      expect(neighbors.sort()).toEqual([head, step.reasonCells[0]].sort());
    });

    test("決め手に、通れる隣が1つだけのマス（道の終わり）があること", () => {
      const counts = step.reasonCells.map(
        (cell) => listPassableNeighbors(cell).length,
      );

      expect(counts).toContain(1);
    });
  });

  test("手を離した後、どの分かれ道でも、伝えたルールで全マスを通れなくなると分からない手がゴールの手の1つだけであること", () => {
    const acceptableMoves = freePlayPaths.map((path) =>
      listUnvisitedNeighbors(path).filter((cell) =>
        isAcceptable([...path, cell], allRuleIds),
      ),
    );

    expect(acceptableMoves).toEqual(
      freePlayPaths.map((path) => [solution[path.length]]),
    );
  });

  test("手を離した後にも、通れる隣が少ないマスの読みが要ること", () => {
    const needsEnd = freePlayPaths.some((path) =>
      listUnvisitedNeighbors(path).some(
        (cell) =>
          isAcceptable([...path, cell], ["hole", "all"]) &&
          !isAcceptable([...path, cell], allRuleIds),
      ),
    );

    expect(needsEnd).toBe(true);
  });
});

describe("hitofudePuzzleTutorial.perform", () => {
  describe("操作を教える手順", () => {
    const progress = playSteps(0);
    const atFirstMark = createProgress([0, 1], 0);

    test("手順のマスでない所へ延ばさないこと", () => {
      const result = act(progress, { type: "press", cell: 5 });

      expect(result).toBe(progress);
    });

    test("穴へ進もうとしても、違反にしないこと", () => {
      const result = act(atFirstMark, { type: "move", direction: "down" });

      expect(result.violated).toBe(false);
    });

    test("印のマスまで延ばすと次の手順へ進むこと", () => {
      const result = pressCells(progress, [1]);

      expect(result.stepIndex).toBe(1);
    });
  });

  describe("穴を伝える手順", () => {
    const progress = playSteps(1);

    test("手順のマスでない所へは延ばさないこと", () => {
      const result = pressCells(progress, [2, 3]);

      expect(result.boardState.path).toEqual([0, 1, 2]);
    });

    test("穴へ進もうとすると、道を変えずに阻まれた違反になり、穴だと言うこと", () => {
      const result = act(progress, { type: "move", direction: "down" });

      expect(result.violated).toBe(true);
      expect(result.boardState.path).toEqual([0, 1]);
      expect(result.boardState.lastMove).toMatchObject({
        type: "blocked",
        cell: 6,
        reason: "hole",
      });
      expect(getMessage(result)).toBe("そこは通れません");
    });
  });

  describe("すべてのマスを伝える手順", () => {
    const progress = playSteps(2);

    test("印へまっすぐ進んで入れないマスが残ると違反になり、戻り先と入れないマスを示すこと", () => {
      const result = pressCells(progress, [16, 21]);

      expect(result.violated).toBe(true);
      expect(
        findHitofudePuzzleTutorialViolation(
          getTutorialSituation(hitofudePuzzleTutorial, result),
          result.boardState,
        ),
      ).toEqual({ fixCell: 11, cells: [10, 15] });
      expect(getMessage(result)).toBe("入れなくなったマスがあります");
    });

    test("通れる隣が1つのマスができても、通れる隣が少ないマスを伝える前は違反にしないこと", () => {
      const result = pressCells(progress, [16]);

      expect(result.violated).toBe(false);
    });

    test("行き止まりに入ると違反になること", () => {
      const result = pressCells(progress, [16, 15, 10]);

      expect(result.violated).toBe(true);
      expect(getMessage(result)).toBe(
        "行き止まりです\n通っていないマスが残っています",
      );
    });

    describe("違反の後", () => {
      const violated = pressCells(progress, [16, 21]);
      const back = act(violated, { type: "press", cell: 11 });

      test("手順を始めた所まで戻せること", () => {
        const result = act(violated, { type: "press", cell: 11 });

        expect(result.boardState.path).toEqual(solution.slice(0, 6));
        expect(result.violated).toBe(false);
      });

      test("手順を始めた所より前へは戻せないこと", () => {
        const result = act(back, { type: "press", cell: 12 });

        expect(result).toBe(back);
      });
    });
  });

  describe("通れる隣が少ないマスを伝える手順", () => {
    const progress = playSteps(3);

    test("通れる隣が1つのマスを2つにする向きを選ぶと違反になり、その2つのマスを示すこと", () => {
      const result = pressCells(progress, [22, 23]);

      expect(result.violated).toBe(true);
      expect(
        findHitofudePuzzleTutorialViolation(
          getTutorialSituation(hitofudePuzzleTutorial, result),
          result.boardState,
        ),
      ).toEqual({ fixCell: 22, cells: [4, 17] });
    });

    test("正しい向きを選ぶと手を離すこと", () => {
      const result = pressCells(progress, [22, 17]);

      expect(result.stepIndex).toBe(steps.length);
      expect(result.boardState.path).toEqual(freePlayStart);
    });
  });

  describe("手を離した後", () => {
    const progress = playSteps(steps.length);
    const besideHole = createProgress(solution.slice(0, 19), steps.length);

    test("残りを解のとおりに延ばすと解けること", () => {
      const result = pressCells(progress, solution.slice(freePlayStart.length));

      expect(result.phase).toBe("solved");
    });

    test("一本道を進んでも違反にしないこと", () => {
      const result = pressCells(progress, [18]);

      expect(result.violated).toBe(false);
    });

    test("通れる隣が1つのマスを2つにする向きへ進むと違反になること", () => {
      const result = pressCells(progress, [18, 13]);

      expect(result.violated).toBe(true);
    });

    test("穴へ進もうとすると違反になること", () => {
      const result = act(besideHole, { type: "move", direction: "right" });

      expect(result.violated).toBe(true);
    });
  });
});

describe("getHitofudePuzzleTutorialStepMarks", () => {
  const progress = playSteps(3);

  test("行き先を選ぶ手順で、まだ通っていない行き先の両方に印を付けること", () => {
    const marks = getHitofudePuzzleTutorialStepMarks(
      getTutorialSituation(hitofudePuzzleTutorial, progress),
      progress.boardState,
    );

    expect(marks).toEqual([17, 23]);
  });
});

describe("findHitofudePuzzleTutorialHint", () => {
  const forkPath = [...freePlayStart, 18];

  test("一本道では、次のマスだけを示し、一言を添えないこと", () => {
    const hint = findHitofudePuzzleTutorialHint(boardStateOf(freePlayStart));

    expect(hint).toEqual({
      kind: "extend",
      cell: 18,
      ruleId: null,
      reasonCells: [],
    });
    expect(hint && describeHitofudePuzzleTutorialHint(hint)).toBeNull();
  });

  test("分かれ道では、次のマスに通れる隣が1つのマスを添え、通れる隣が少ないマスの一言を添えること", () => {
    const hint = findHitofudePuzzleTutorialHint(boardStateOf(forkPath));

    expect(hint).toEqual({
      kind: "extend",
      cell: 23,
      ruleId: "narrow",
      reasonCells: [4],
    });
    expect(hint && describeHitofudePuzzleTutorialHint(hint)?.headline).toEqual(
      findStepIntroducing("narrow").message.headline,
    );
  });

  test("手順の道筋まで戻した分かれ道では、ほかの向きを退けるルールとその決め手を示すこと", () => {
    const hint = findHitofudePuzzleTutorialHint(
      boardStateOf(solution.slice(0, 6)),
    );

    expect(hint).toEqual({
      kind: "extend",
      cell: 10,
      ruleId: "narrow",
      reasonCells: [4],
    });
    expect(hint && describeHitofudePuzzleTutorialHint(hint)).toEqual(
      findStepIntroducing("narrow").message,
    );
  });

  test("伝えたルールで決まらない分かれ道では、決め手も一言も添えないこと", () => {
    const hint = findHitofudePuzzleTutorialHint(
      boardStateOf(solution.slice(0, 3)),
    );

    expect(hint).toEqual({
      kind: "extend",
      cell: 7,
      ruleId: null,
      reasonCells: [],
    });
  });

  test("手を離した後のどの道でも、手がかりの決め手は、ほかの向きへ進むと伝えたルールで退けられるマスであること", () => {
    const hints = solution.slice(1).map((_, index) => ({
      path: solution.slice(0, index + 1),
      hint: findHitofudePuzzleTutorialHint(
        boardStateOf(solution.slice(0, index + 1)),
      ),
    }));

    for (const { path, hint } of hints) {
      if (hint?.kind !== "extend" || hint.ruleId === null) {
        continue;
      }
      const others = listUnvisitedNeighbors(path).filter(
        (cell) => cell !== hint.cell,
      );
      expect(
        others.every((cell) => !isAcceptable([...path, cell], allRuleIds)),
      ).toBe(true);
    }
  });

  test("解から外れた道では、外れる前のマスへ戻させること", () => {
    const hint = findHitofudePuzzleTutorialHint(
      boardStateOf([...forkPath, 13]),
    );

    expect(hint).toEqual({ kind: "rewind", cell: 18 });
  });
});

describe("getHitofudePuzzleTutorialProgressRatio", () => {
  const path = [0, 1, 2, 3];

  test("始点の後に解のとおりに通ったマスの割合を返すこと", () => {
    const ratio = getHitofudePuzzleTutorialProgressRatio(boardStateOf(path));

    expect(HITOFUDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT).toBe(
      solution.length - 1,
    );
    expect(ratio).toBe(2 / (solution.length - 1));
  });
});

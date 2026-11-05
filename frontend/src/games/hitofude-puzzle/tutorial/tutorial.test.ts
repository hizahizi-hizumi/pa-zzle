import {
  createHitofudePuzzleAdjacency,
  isHitofudePuzzleHole,
  listHitofudePuzzleGridNeighbors,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  findHitofudePuzzleStranding,
  isHitofudePuzzleSolved,
} from "@/games/hitofude-puzzle/puzzle/rules";
import {
  _private,
  findHitofudePuzzleTutorialHint,
  getHitofudePuzzleTutorialStepCells,
  type HitofudePuzzleTutorialAction,
  type HitofudePuzzleTutorialBoardState,
  type HitofudePuzzleTutorialRuleId,
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

const { board, solution } = _private;
const { steps } = hitofudePuzzleTutorial;

type Progress = TutorialProgress<
  HitofudePuzzleTutorialRuleId,
  HitofudePuzzleTutorialBoardState
>;

const allRuleIds: readonly HitofudePuzzleTutorialRuleId[] = [
  "once",
  "hole",
  "all",
];

/** 始点から全マスを通る道をすべて挙げる。 */
function listSolutions(): number[][] {
  const adjacency = createHitofudePuzzleAdjacency(board);
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

/** 先端から延ばす手の候補のうち、ゴールの手でないもの。来たマスへ戻る手は含めない。 */
function listOtherCandidates(path: readonly number[], next: number): number[] {
  const head = path.at(-1) ?? board.start;
  return listHitofudePuzzleGridNeighbors(board.size, head).filter(
    (cell) => cell !== next && cell !== path.at(-2),
  );
}

/** その手を、どのルールで除けるか。どのルールでも除けなければ `null`。 */
function findExcludingRule(
  path: readonly number[],
  cell: number,
): HitofudePuzzleTutorialRuleId | null {
  if (isHitofudePuzzleHole(board, cell)) {
    return "hole";
  }
  if (path.includes(cell)) {
    return "once";
  }
  if (findHitofudePuzzleStranding(board, [...path, cell]) !== null) {
    return "all";
  }
  return null;
}

/** ゴールの道の `index` 番目のマスへ延ばす手。`before` はその手の前の道。 */
type SolutionMove = { before: readonly number[]; next: number };

function listSolutionMoves(from: number, to: number): SolutionMove[] {
  return solution.slice(from, to).map((next, offset) => ({
    before: solution.slice(0, from + offset),
    next,
  }));
}

function isDecidedBy(
  { before, next }: SolutionMove,
  earned: readonly HitofudePuzzleTutorialRuleId[],
): boolean {
  return listOtherCandidates(before, next).every((cell) => {
    const rule = findExcludingRule(before, cell);
    return rule !== null && earned.includes(rule);
  });
}

/** 手順ごとの、手順の手と、手順を始めた時点で手に入れているルール。 */
const stepMoves = steps.map((step, index) => {
  const from = solution.indexOf(steps[index - 1]?.cells.at(-1) ?? board.start);
  const to = solution.indexOf(step.cells.at(-1) ?? board.start);
  const earned = steps
    .slice(0, index + 1)
    .flatMap((earlier) =>
      earlier.introducedRuleId === null ? [] : [earlier.introducedRuleId],
    );
  return { step, index, moves: listSolutionMoves(from + 1, to + 1), earned };
});
const guidedEndLength = solution.indexOf(steps.at(-1)?.cells.at(-1) ?? 0) + 1;
const freeMoves = listSolutionMoves(guidedEndLength, solution.length);

function press(cell: number): HitofudePuzzleTutorialAction {
  return { type: "press", cell };
}

function perform(
  progress: Progress,
  actions: readonly HitofudePuzzleTutorialAction[],
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(hitofudePuzzleTutorial, current, action),
    progress,
  );
}

const playing = finishTutorialIntro(startTutorial(hitofudePuzzleTutorial));

/** `count` 個の手順を、印のマスを順に押して終えた進行。 */
function playSteps(count: number): Progress {
  return perform(
    playing,
    steps.slice(0, count).flatMap((step) => step.cells.map(press)),
  );
}

describe("盤面", () => {
  test("始点から全マスを通る道が、ゴールの道の1本だけであること", () => {
    const solutions = listSolutions();

    expect(solutions).toEqual([solution]);
  });

  test("導入で見せるゴールが、全マスを通り終えた道であること", () => {
    const goal = hitofudePuzzleTutorial.goal();

    expect(isHitofudePuzzleSolved(board, goal.path)).toBe(true);
  });

  test("始めの盤面が、道が始点だけの盤面であること", () => {
    const start = hitofudePuzzleTutorial.start();

    expect(start.path).toEqual([board.start]);
  });
});

describe("手順", () => {
  test("手順のマスと手を離した後の残りが、ゴールの道を始点から順にたどること", () => {
    const cells = [
      board.start,
      ...steps.flatMap((step) => step.cells),
      ...freeMoves.map((move) => move.next),
    ];

    expect(cells).toEqual(solution);
  });

  test("操作を教えるのは最初の手順だけで、ほかの手順はルールを1つずつ伝えること", () => {
    const introduced = steps.map((step) => step.introducedRuleId);

    expect(introduced).toEqual([null, ...allRuleIds]);
  });

  const ruleStepCases = stepMoves.filter(({ index }) => index > 0);

  test.each(ruleStepCases)(
    "ルールを伝えた後の手は、それまでに伝えたルールで決まること: 手順$index",
    ({ moves, earned }) => {
      const decided = moves.every((move) => isDecidedBy(move, earned));

      expect(decided).toBe(true);
    },
  );

  test.each(ruleStepCases)(
    "手順で伝えたルールが、その手順の手で、ほかの手を除く決め手になること: 手順$index",
    ({ step, moves }) => {
      const excludingRules = moves.flatMap(({ before, next }) =>
        listOtherCandidates(before, next).map((cell) =>
          findExcludingRule(before, cell),
        ),
      );

      expect(excludingRules).toContain(step.introducedRuleId);
    },
  );

  test.each(ruleStepCases)(
    "決め手のマスが、手順で伝えたルールでほかの手を除くマスであること: 手順$index",
    ({ step, moves }) => {
      const reasons = new Set(
        moves.flatMap(({ before, next }) =>
          listOtherCandidates(before, next).flatMap((cell) => {
            const rule = findExcludingRule(before, cell);
            if (rule !== step.introducedRuleId) {
              return [];
            }
            if (rule !== "all") {
              return [cell];
            }
            const stranding = findHitofudePuzzleStranding(board, [
              ...before,
              cell,
            ]);
            return [
              ...(stranding?.isolatedCells ?? []),
              ...(stranding?.deadEndCells ?? []),
              ...(stranding?.separatedCells ?? []),
            ];
          }),
        ),
      );
      const outside = step.reasonCells.filter((cell) => !reasons.has(cell));

      expect(step.reasonCells.length).toBeGreaterThan(0);
      expect(outside).toEqual([]);
    },
  );

  const allRuleStep = stepMoves.find(
    ({ step }) => step.introducedRuleId === "all",
  );

  test("すべてのマスのルールを伝える手順は、ほかの手で取り残されるマスをすべて決め手に挙げること", () => {
    const strandedCells = (allRuleStep?.moves ?? []).flatMap(
      ({ before, next }) =>
        listOtherCandidates(before, next).flatMap((cell) => {
          const stranding = findHitofudePuzzleStranding(board, [
            ...before,
            cell,
          ]);
          return [
            ...(stranding?.isolatedCells ?? []),
            ...(stranding?.deadEndCells ?? []),
            ...(stranding?.separatedCells ?? []),
          ];
        }),
    );
    const missing = strandedCells.filter(
      (cell) => !allRuleStep?.step.reasonCells.includes(cell),
    );

    expect(strandedCells.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  test("操作を教える手順の手が、ゴールの道と一致すること", () => {
    const [operationStep] = stepMoves;
    const cells = operationStep?.moves.map((move) => move.next);

    expect(cells).toEqual(steps[0]?.cells);
  });

  test("手を引く間のどの途中の盤面にも、取り残しが無いこと", () => {
    const strandings = solution
      .slice(1, guidedEndLength)
      .map((_, index) =>
        findHitofudePuzzleStranding(board, solution.slice(0, index + 2)),
      );

    expect(strandings.every((stranding) => stranding === null)).toBe(true);
  });

  test("手を離した後の残りを、3つのルールを当てはめるだけで解き切れること", () => {
    const decided = freeMoves.every((move) => isDecidedBy(move, allRuleIds));

    expect(freeMoves.length).toBeGreaterThan(0);
    expect(decided).toBe(true);
  });

  test("手を離した後の残りに、すべてのマスのルールで決まる手があること", () => {
    const excludingRules = freeMoves.flatMap(({ before, next }) =>
      listOtherCandidates(before, next).map((cell) =>
        findExcludingRule(before, cell),
      ),
    );

    expect(excludingRules).toContain("all");
  });
});

describe("hitofudePuzzleTutorial.perform", () => {
  describe("操作を教える手順の場合", () => {
    test("印のマスへなぞると、道が延びること", () => {
      const result = perform(playing, [
        { type: "trace", step: { from: 6, to: 2, horizontalFirst: false } },
      ]);

      expect(result.boardState.path).toEqual([6, 2]);
      expect(result.stepIndex).toBe(0);
    });

    test("印の最後のマスまで延ばすと、次の手順へ進むこと", () => {
      const result = perform(playing, [press(2), press(3)]);

      expect(result.boardState.path).toEqual([6, 2, 3]);
      expect(result.stepIndex).toBe(1);
    });

    test("印の無いマスへ延ばそうとしても、道を変えないこと", () => {
      const result = perform(playing, [press(7)]);

      expect(result).toBe(playing);
    });

    test("穴のルールを伝える前は、穴へ進もうとしても、ルールに合わない手にしないこと", () => {
      const result = perform(playing, [press(2), press(1)]);

      expect(result.violated).toBe(false);
      expect(result.boardState.path).toEqual([6, 2]);
    });

    test("先端を押しても、道を変えないこと", () => {
      const result = perform(playing, [press(6)]);

      expect(result).toBe(playing);
    });
  });

  describe("同じマスのルールを伝える手順の場合", () => {
    const progress = playSteps(1);

    test("来た道をなぞり戻しても、道を縮めないこと", () => {
      const result = perform(progress, [
        { type: "trace", step: { from: 3, to: 2, horizontalFirst: true } },
      ]);

      expect(result).toBe(progress);
    });

    test("道のマスを押しても、巻き戻さないこと", () => {
      const result = perform(progress, [press(6)]);

      expect(result).toBe(progress);
    });

    test("同じマスのルールを手に入れていること", () => {
      const earned = progress.earnedRuleIds;

      expect(earned).toEqual(["once"]);
    });

    test("矢印キーで通ったマスへ進もうとすると、道を変えずにルールに合わない手として応え、同じマスを通れないと言うこと", () => {
      const result = perform(progress, [
        press(7),
        { type: "move", direction: "left" },
      ]);
      const message = getTutorialMessage(hitofudePuzzleTutorial, result, {
        entry: "home",
        violationSettled: true,
      });

      expect(result.violated).toBe(true);
      expect(result.boardState.path).toEqual([6, 2, 3, 7]);
      expect(result.boardState.lastMove).toEqual({
        type: "blocked",
        cell: 6,
        direction: "left",
        reason: "visited",
      });
      expect(message.headline).toBe("同じマスは2回通れません");
    });
  });

  describe("穴のルールを伝えた手順の場合", () => {
    const progress = playSteps(2);
    const blocked = perform(progress, [
      { type: "trace", step: { from: 11, to: 10, horizontalFirst: true } },
    ]);

    test("穴へ進もうとすると、道を変えずにルールに合わない手として応えること", () => {
      const lastMove = blocked.boardState.lastMove;

      expect(blocked.violated).toBe(true);
      expect(blocked.boardState.path).toEqual(progress.boardState.path);
      expect(lastMove).toEqual({
        type: "blocked",
        cell: 10,
        direction: "left",
        reason: "hole",
      });
    });

    test("違反の一言が、穴を通れないことを言うこと", () => {
      const message = getTutorialMessage(hitofudePuzzleTutorial, blocked, {
        entry: "home",
        violationSettled: true,
      });

      expect(message.headline).toBe("穴は通れません");
    });

    test("印のマスへ延ばすと、違反を下げて進めること", () => {
      const result = perform(blocked, [press(15)]);

      expect(result.violated).toBe(false);
      expect(result.boardState.path.at(-1)).toBe(15);
    });
  });

  describe("すべてのマスのルールを伝えた手順の場合", () => {
    const progress = playSteps(3);

    test("角を通らずに上へ曲がろうとしても、道を変えないこと", () => {
      const result = perform(progress, [press(9)]);

      expect(result).toBe(progress);
    });

    test("角を通って印のマスまで延ばすと、手を離すこと", () => {
      const result = perform(progress, [press(12), press(8)]);
      const situation = getTutorialSituation(hitofudePuzzleTutorial, result);

      expect(situation.step).toBeNull();
      expect(result.earnedRuleIds).toEqual(allRuleIds);
    });
  });

  describe("手を離した後の場合", () => {
    const progress = playSteps(steps.length);

    test("解から外れて全マスを通れなくなる手は、本番と同じく道を延ばし、ルールに合わない手として応えること", () => {
      const result = perform(progress, [press(4)]);
      const message = getTutorialMessage(hitofudePuzzleTutorial, result, {
        entry: "home",
        violationSettled: true,
      });

      expect(result.boardState.path.at(-1)).toBe(4);
      expect(result.violated).toBe(true);
      expect(message.headline).toBe(
        "このままでは\nたどり着けないマスが残ります",
      );
    });

    test("行き止まりまで延ばすと、行き止まりだと言うこと", () => {
      const result = perform(progress, [press(4), press(0)]);
      const message = getTutorialMessage(hitofudePuzzleTutorial, result, {
        entry: "home",
        violationSettled: true,
      });

      expect(message.headline).toBe(
        "行き止まりです\n通っていないマスが残っています",
      );
    });

    test("来た道をなぞり戻すと、本番と同じく道が縮み、違反を下げること", () => {
      const result = perform(progress, [
        press(4),
        { type: "trace", step: { from: 4, to: 8, horizontalFirst: false } },
      ]);

      expect(result.boardState.path).toEqual(progress.boardState.path);
      expect(result.violated).toBe(false);
    });

    test("道のマスを押すと、本番と同じくそこまで巻き戻すこと", () => {
      const result = perform(progress, [press(13)]);

      expect(result.boardState.path).toEqual(solution.slice(0, 8));
    });

    test("先端から離れたマスを押すと、道を変えずに阻まれたとして応え、ルールに合わない手にはしないこと", () => {
      const result = perform(progress, [press(0)]);

      expect(result.violated).toBe(false);
      expect(result.boardState.lastMove).toEqual({
        type: "blocked",
        cell: 0,
        direction: null,
        reason: "not-adjacent",
      });
    });

    test("残りを延ばして全マスを通ると、解き終えること", () => {
      const result = perform(progress, [9, 5, 4, 0].map(press));

      expect(result.phase).toBe("solved");
    });

    test("矢印キーでも、本番と同じく先端を動かせること", () => {
      const result = perform(progress, [{ type: "move", direction: "right" }]);

      expect(result.boardState.path.at(-1)).toBe(9);
    });

    test("矢印キーで通ったマスへ進もうとすると、本番と同じく阻まれ、ルールに合わない手として応えること", () => {
      const result = perform(progress, [
        press(9),
        { type: "move", direction: "down" },
      ]);

      expect(result.violated).toBe(true);
      expect(result.boardState.path.at(-1)).toBe(9);
    });
  });
});

describe("getHitofudePuzzleTutorialStepCells", () => {
  const progress = perform(playing, [press(2)]);
  const situation = getTutorialSituation(hitofudePuzzleTutorial, progress);

  test("手順のマスのうち、まだ延ばしていないマスを返すこと", () => {
    const cells = getHitofudePuzzleTutorialStepCells(
      situation,
      progress.boardState,
    );

    expect(cells).toEqual([3]);
  });
});

describe("findHitofudePuzzleTutorialHint", () => {
  const cases = [
    {
      name: "道が解の途中なら、次に延ばすマス",
      path: solution.slice(0, 10),
      expected: { kind: "extend", cell: 9 },
    },
    {
      name: "道が解から外れていれば、外れる前のマス",
      path: [...solution.slice(0, 10), 4, 0],
      expected: { kind: "rewind", cell: 8 },
    },
    {
      name: "解き終えていれば無し",
      path: solution,
      expected: null,
    },
  ];

  test.each(cases)("$name を返すこと", ({ path, expected }) => {
    const hint = findHitofudePuzzleTutorialHint({
      path,
      moveCount: 0,
      lastMove: null,
    });

    expect(hint).toEqual(expected);
  });
});

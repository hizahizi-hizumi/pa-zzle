import { isMagicSquareSolved } from "@/games/magic-square/puzzle/rules";
import {
  type MagicSquareTutorialAction,
  type MagicSquareTutorialBoardState,
  type MagicSquareTutorialRuleId,
  magicSquareTutorial,
  magicSquareTutorialPuzzle,
} from "@/games/magic-square/tutorial/tutorial";
import {
  finishTutorialIntro,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type Progress = TutorialProgress<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialBoardState
>;

function perform(
  actions: readonly MagicSquareTutorialAction[],
  progress: Progress = finishTutorialIntro(startTutorial(magicSquareTutorial)),
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(magicSquareTutorial, current, action),
    progress,
  );
}

const guidedActions = magicSquareTutorial.steps.map(
  (step): MagicSquareTutorialAction =>
    step.kind === "select"
      ? { type: "select", cellIndex: step.cellIndex }
      : { type: "enter", value: step.value },
);

/** 手を離した後に残る空き（2行4列・3行2列・4行3列）を、答えの数で埋める手。 */
const freePlayActions: readonly MagicSquareTutorialAction[] = [
  { type: "select", cellIndex: 7 },
  { type: "enter", value: 16 },
  { type: "select", cellIndex: 9 },
  { type: "enter", value: 13 },
  { type: "select", cellIndex: 14 },
  { type: "enter", value: 10 },
];

describe("magicSquareTutorial", () => {
  const goalCells = magicSquareTutorial.goal().puzzleState.cells;
  test("始めの盤面は最初から置いてある数だけで、どのマスも選んでいないこと", () => {
    const start = magicSquareTutorial.start();

    expect(start).toEqual({
      puzzleState: expect.objectContaining({
        cells: magicSquareTutorialPuzzle.givens.cells,
      }),
      selectedCellIndex: null,
    });
  });

  test("解き終えた盤面が魔方陣になっていること", () => {
    const solved = isMagicSquareSolved(magicSquareTutorial.goal().puzzleState);

    expect(solved).toBe(true);
  });

  test("手順どおりに選んで押すと、手を離すところまで進むこと", () => {
    const progress = perform(guidedActions);

    expect({
      stepIndex: progress.stepIndex,
      earnedRuleIds: progress.earnedRuleIds,
    }).toEqual({
      stepIndex: magicSquareTutorial.steps.length,
      earnedRuleIds: ["line-sum", "use-once"],
    });
  });

  test("手順で押す数は、解き終えた盤面のそのマスの数であること", () => {
    const values = magicSquareTutorial.steps.flatMap((step) =>
      step.kind === "enter"
        ? [[step.value, goalCells[step.cellIndex]] as const]
        : [],
    );

    expect(values.every(([value, solution]) => value === solution)).toBe(true);
  });

  describe("手を引いている間の場合", () => {
    const start = finishTutorialIntro(startTutorial(magicSquareTutorial));
    const selected = perform([guidedActions[0]!]);
    const cases: readonly [string, MagicSquareTutorialAction][] = [
      ["印の無いマスを選ぶ", { type: "select", cellIndex: 3 }],
      ["マスを選ぶ前に数を押す", { type: "enter", value: 14 }],
    ];

    test.each(cases)("%s手を受け付けないこと", (_, action) => {
      const progress = perform([action], start);

      expect(progress).toBe(start);
    });

    test("印のマスを選んでから印の無い数を押す手を受け付けないこと", () => {
      const progress = perform([{ type: "enter", value: 13 }], selected);

      expect(progress).toBe(selected);
    });
  });

  describe("手を離した後の場合", () => {
    const freePlay = perform(guidedActions);

    test("残りの空きを答えの数で埋めると解けること", () => {
      const progress = perform(freePlayActions, freePlay);

      expect(progress.phase).toBe("solved");
    });

    test("合計の合わない列ができる手を違反とすること", () => {
      const progress = perform(
        [
          { type: "select", cellIndex: 7 },
          { type: "enter", value: 13 },
        ],
        freePlay,
      );

      expect(progress.violated).toBe(true);
    });

    test("同じ数をもう一度押すと外し、違反でなくなること", () => {
      const progress = perform(
        [
          { type: "select", cellIndex: 7 },
          { type: "enter", value: 13 },
          { type: "enter", value: 13 },
        ],
        freePlay,
      );

      expect({
        cell: progress.boardState.puzzleState.cells[7],
        violated: progress.violated,
      }).toEqual({ cell: null, violated: false });
    });
  });
});

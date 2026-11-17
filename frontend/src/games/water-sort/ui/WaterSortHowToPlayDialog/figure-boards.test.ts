import { createWaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import {
  listWaterSortPourRejections,
  listWaterSortSourceRejections,
  selectWaterSortBottle,
  type WaterSortRejection,
} from "@/games/water-sort/puzzle/bottle-selection";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  applyWaterSortMove,
  getWaterSortPourAmount,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  isWaterSortCleared,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  applyWaterSortSessionMove,
  getWaterSortSessionResult,
  restartWaterSortSession,
  undoWaterSortSession,
  type WaterSortSession,
} from "@/games/water-sort/session/session";
import {
  amountRuleExamples,
  backtrackFigures,
  completeRuleExamples,
  deadlockFigure,
  destinationRuleExamples,
  goalFigure,
  pourDestinationExample,
  type WaterSortHowToPlayBacktrackFigure,
  type WaterSortHowToPlayFlowStep,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";

/** 盤面に `moves` を順に注いだ姿。注げない手があれば `null`。 */
function pourAll(
  state: WaterSortState,
  moves: readonly WaterSortMove[],
): WaterSortState | null {
  let current: WaterSortState | null = state;
  for (const move of moves) {
    current = current && applyWaterSortMove(current, move);
  }
  return current;
}

/** 本番で注げる手を `maxMoves` 手まで注いで作れる姿（注がない姿も含む）。 */
function listReachableStates(
  state: WaterSortState,
  maxMoves: number,
): WaterSortState[] {
  let frontier = [state];
  const reached = [state];
  for (let move = 0; move < maxMoves; move += 1) {
    frontier = frontier.flatMap((current) =>
      listWaterSortLegalMoves(current).flatMap((legalMove) => {
        const next = applyWaterSortMove(current, legalMove);
        return next === null ? [] : [next];
      }),
    );
    reached.push(...frontier);
  }
  return reached;
}

/** 2手が、どちらも注ぎ先にするボトルのほかに、同じボトルを動かすか。 */
function sharesMovingBottle(
  left: WaterSortMove,
  right: WaterSortMove,
): boolean {
  const leftBottles = [left.sourceBottleIndex, left.destinationBottleIndex];
  const rightBottles = [right.sourceBottleIndex, right.destinationBottleIndex];
  return leftBottles.some(
    (bottle) =>
      rightBottles.includes(bottle) &&
      !(
        bottle === left.destinationBottleIndex &&
        bottle === right.destinationBottleIndex
      ),
  );
}

describe("goalFigure", () => {
  test("始まりの盤面から順に注いだ手がどれも本番で注げ、最後の手で本番の完成の判定を満たすこと", () => {
    const goal = pourAll(goalFigure.start, goalFigure.moves);

    const cleared = goal !== null && isWaterSortCleared(goal);

    expect(cleared).toBe(true);
  });

  test("最後の手より前には、完成の判定を満たさないこと", () => {
    const beforeLast = pourAll(goalFigure.start, goalFigure.moves.slice(0, -1));
    const cleared = beforeLast !== null && isWaterSortCleared(beforeLast);

    expect(beforeLast).not.toBeNull();
    expect(cleared).toBe(false);
  });

  test("続けて注ぐ2手が、同じ注ぎ先へ注ぐほかは同じボトルを動かさないこと", () => {
    const overlapping = goalFigure.moves.slice(1).filter((move, index) => {
      const previous = goalFigure.moves[index];
      return previous !== undefined && sharesMovingBottle(previous, move);
    });

    expect(overlapping).toEqual([]);
  });
});

describe("pourDestinationExample", () => {
  const { bottles, selectedBottleIndex } = pourDestinationExample;
  const candidates = [1, 2, 3, 4];

  test("最初に選んでおく左のボトルを、本番の盤面でも選べること", () => {
    const selection = selectWaterSortBottle(bottles, null, selectedBottleIndex);

    expect(selection.type).toBe("source-selected");
  });

  test("左のボトルから右の候補へ、本番の盤面で順に、注げる・上の色が違って注げない・注げる・いっぱいで注げないこと", () => {
    const rejections = candidates.map((destination) =>
      listWaterSortPourRejections(bottles, {
        sourceBottleIndex: selectedBottleIndex,
        destinationBottleIndex: destination,
      }),
    );

    expect(rejections).toEqual([[], ["different-color"], [], ["full"]]);
  });

  test("注げる候補は、いちばん上が左のボトルと同じ色のボトルと、空のボトルであること", () => {
    const tops = [1, 3].map(
      (destination) => bottles[destination]?.at(-1) ?? null,
    );

    expect(tops).toEqual([bottles[0]?.at(-1), null]);
  });
});

describe("completeRuleExamples・destinationRuleExamples", () => {
  const cases: [
    string,
    WaterSortRejection,
    readonly { bottles: WaterSortState }[],
  ][] = [
    ["1色でいっぱい", "complete", completeRuleExamples],
    ["どこにも注げない", "no-destination", destinationRuleExamples],
  ];

  test.each(cases)(
    "%s のルールで、左の例は本番の盤面で左のボトルを選べ、右の例は教えるルールで選べないこと",
    (_, rule, [allowed, denied]) => {
      const rejections = [allowed, denied].map((example) =>
        listWaterSortSourceRejections(example?.bottles ?? [], 0),
      );

      expect(rejections).toEqual([[], [rule]]);
    },
  );
});

describe("amountRuleExamples", () => {
  test("入るぶんだけ移るルールで、上に続く同じ色の数は同じで、本番で移る量が2つと1つになること", () => {
    const amounts = amountRuleExamples.map((example) =>
      getWaterSortPourAmount(example.bottles, {
        sourceBottleIndex: 0,
        destinationBottleIndex: 1,
      }),
    );

    expect(amounts).toEqual([2, 1]);
  });
});

/** 図の盤面から始める、本番のプレイ。経過時間は使わない。 */
function startSession(initialState: WaterSortState): WaterSortSession {
  return {
    status: "playing",
    problem: { initialState },
    puzzleState: initialState,
    history: [],
    startedAt: 0,
    clearedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

/**
 * 図の流れの後にそろえ終えたときの、本番の結果の手戻り。
 * 流れの後は、待ったも盤面を戻すも使わずにそろえれば、注ぐ手が総手数とクリア手数に同じだけ足されて手戻りは変わらないので、
 * 流れの直後にそろえ終えたとみなして、本番の結果を作る。手戻りのほかの値は使わない。
 */
function countBacktrackMoves(session: WaterSortSession): number | null {
  const sessionResult = getWaterSortSessionResult({
    ...session,
    status: "cleared",
    clearedAt: session.startedAt,
  });
  return sessionResult === null
    ? null
    : createWaterSortResult(sessionResult, 1, 1).backtrackMoveCount;
}

/** 流れの操作を、本番のプレイで1つ行う。 */
function playStep(
  session: WaterSortSession,
  step: WaterSortHowToPlayFlowStep,
): WaterSortSession {
  switch (step.kind) {
    case "pour":
      return step.moves.reduce(
        (current, move) => applyWaterSortSessionMove(current, move, 0),
        session,
      );
    case "undo":
      return undoWaterSortSession(session);
    case "restart":
      return restartWaterSortSession(session);
  }
}

/** 図の流れのとおりに本番のプレイで操作し、操作ごとの盤面と、最後のプレイを返す。 */
function playFlow(figure: WaterSortHowToPlayBacktrackFigure): {
  states: WaterSortState[];
  session: WaterSortSession;
} {
  let session = startSession(figure.frames[0]?.bottles ?? []);
  const states = [session.puzzleState];
  for (const step of figure.steps) {
    session = playStep(session, step);
    states.push(session.puzzleState);
  }
  return { states, session };
}

const flows: readonly [string, WaterSortHowToPlayBacktrackFigure][] = [
  ["注いでから待ったで戻す流れ", backtrackFigures.undo],
  ["2手注いでから盤面を戻す流れ", backtrackFigures.restart],
];

describe("backtrackFigures", () => {
  describe.each(flows)("%sの場合", (_, figure) => {
    const frameBottles = figure.frames.map(({ bottles }) => bottles);
    /** 注ぐ元を選んで見せるコマと、その次の操作。 */
    const selectedFrames = figure.frames.flatMap((frame, index) =>
      frame.selectedBottleIndex === undefined
        ? []
        : [
            {
              frame,
              selected: frame.selectedBottleIndex,
              next: figure.steps[index],
            },
          ],
    );

    test("最初のコマから本番のプレイで順に操作すると、どのコマの盤面にもなること", () => {
      const { states } = playFlow(figure);

      expect(states).toEqual(frameBottles);
    });

    test("図に添える手戻りの手数が、本番の数え方と一致すること", () => {
      const { session } = playFlow(figure);
      const backtrackMoveCount = countBacktrackMoves(session);

      expect(backtrackMoveCount).toBe(figure.backtrackMoveCount);
    });

    test("注ぐ操作の前のコマでは、どれも注ぐ元を選んだ姿で示すこと", () => {
      const pourSourceShown = figure.steps.flatMap((step, index) =>
        step.kind === "pour"
          ? [figure.frames[index]?.selectedBottleIndex !== undefined]
          : [],
      );

      expect(pourSourceShown).toEqual(pourSourceShown.map(() => true));
    });

    test("注ぐ操作の後のコマは、矢印に添える手数より少ない手では作れないこと", () => {
      const reachableEarlier = figure.steps.flatMap((step, index) => {
        const before = figure.frames[index]?.bottles;
        const after = figure.frames[index + 1]?.bottles;
        if (step.kind !== "pour" || before === undefined) {
          return [];
        }
        return [
          listReachableStates(before, step.moves.length - 1).some(
            (state) => JSON.stringify(state) === JSON.stringify(after),
          ),
        ];
      });

      expect(reachableEarlier).toEqual(reachableEarlier.map(() => false));
    });

    test("注ぐ元を選んで見せるコマでは、そのボトルが次の操作で最初に注ぐボトルで、本番でも選べること", () => {
      const checks = selectedFrames.map(({ frame, selected, next }) => ({
        firstSource:
          next?.kind === "pour" ? next.moves[0]?.sourceBottleIndex : undefined,
        selection: selectWaterSortBottle(frame.bottles, null, selected).type,
      }));

      expect(checks).toEqual(
        selectedFrames.map(({ selected }) => ({
          firstSource: selected,
          selection: "source-selected",
        })),
      );
    });
  });

  describe("2つの流れの場合", () => {
    test("同じ始まりの盤面から始めること", () => {
      const starts = flows.map(([, figure]) => figure.frames[0]?.bottles);

      expect(starts[0]).toEqual(starts[1]);
    });
  });
});

describe("deadlockFigure", () => {
  test("本番の手詰まりの判定で、手詰まりになること", () => {
    const status = classifyWaterSortDeadlock(deadlockFigure.bottles, {
      maxVisitedStates: Number.POSITIVE_INFINITY,
    });

    expect(status).toBe("deadlocked");
  });
});

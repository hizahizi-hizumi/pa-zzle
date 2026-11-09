import { findIceFloorMazeDeadlock } from "@/games/ice-floor-maze/puzzle/deadlock";
import {
  applyIceFloorMazeSlide,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import {
  _private,
  findIceFloorMazeTutorialHintCellIndex,
  getIceFloorMazeTutorialStepFocus,
  type IceFloorMazeTutorialBoardState,
  type IceFloorMazeTutorialRuleId,
  iceFloorMazeTutorial,
  iceFloorMazeTutorialPuzzle,
  listIceFloorMazeTutorialMoveCellIndices,
  readIceFloorMazeTutorialSlide,
} from "@/games/ice-floor-maze/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const {
  startState,
  freePlayState,
  solvedState,
  findShortestDirections,
  findStepSlide,
} = _private;
const { board, goal } = iceFloorMazeTutorialPuzzle;

type Progress = TutorialProgress<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialBoardState
>;

function slideAll(
  progress: Progress,
  directions: readonly IceFloorMazeDirection[],
): Progress {
  return directions.reduce(
    (current, direction) =>
      performTutorialAction(iceFloorMazeTutorial, current, { direction }),
    progress,
  );
}

/** 最初の `count` 個の手順を、印のマスへ止まる向きへ滑らせて終える。 */
function finishSteps(count: number): Progress {
  return iceFloorMazeTutorial.steps.slice(0, count).reduce(
    (progress, step) => {
      const slide = findStepSlide(progress.boardState.puzzleState, step.target);
      return slide ? slideAll(progress, [slide.direction]) : progress;
    },
    finishTutorialIntro(startTutorial(iceFloorMazeTutorial)),
  );
}

/** 手順の印の滑りを、手順を始める前の状態とともに並べる。 */
function listStepSlides() {
  return iceFloorMazeTutorial.steps.map((step, index) => {
    const before = finishSteps(index);
    const slide = findStepSlide(before.boardState.puzzleState, step.target);
    const earnedRuleIds = iceFloorMazeTutorial.steps
      .slice(0, index + 1)
      .flatMap(({ introducedRuleId }) =>
        introducedRuleId === null ? [] : [introducedRuleId],
      );
    return { step, before, slide, earnedRuleIds };
  });
}

/** 手を離した後を最短で進める滑りを、滑る前の状態とともに並べる。 */
function listFreePlaySlides() {
  let state = freePlayState;
  return (findShortestDirections(freePlayState) ?? []).map((direction) => {
    const slide = slideIceFloorMazePiece(board, state, direction);
    const before = state;
    if (slide.status === "slid") {
      state = applyIceFloorMazeSlide(state, slide);
    }
    return { before, slide };
  });
}

/**
 * 手順で伝えていない細かいルールで、盤面が応える手か。応えるなら、その理由。
 * すぐ隣のもろい岩・塊・雪へ向ける、動けない塊や押し出せない雪の手前で止まる、塊が薄い氷やゴールの上を通るか止め役でない物の手前で止まる、
 * 雪をゴールか薄い氷の上へ押し出す、床の先のもろい岩が崩れない、のどれか。
 */
function findUntaughtReaction(
  state: IceFloorMazeState,
  direction: IceFloorMazeDirection,
): string | null {
  const slide = slideIceFloorMazePiece(board, state, direction);
  const next = getIceFloorMazeNeighbor(board, state.position, direction);
  const describeCell = (cell: number | null) =>
    cell === null
      ? "wall"
      : state.blocks.includes(cell)
        ? "sliding-block"
        : state.cells[cell];
  if (slide.status === "blocked") {
    const neighbor = describeCell(next);
    return ["sliding-block", "brittle-rock", "snow"].includes(neighbor ?? "")
      ? `すぐ隣の${neighbor}`
      : null;
  }
  if (slide.movedBlock) {
    const { from, to } = slide.movedBlock;
    const stopper = describeCell(getIceFloorMazeNeighbor(board, to, direction));
    const crossed = [from];
    for (let cell = from; cell !== to; ) {
      cell = getIceFloorMazeNeighbor(board, cell, direction)!;
      crossed.push(cell);
    }
    if (
      crossed.some((cell) => cell === goal || state.cells[cell] === "thin-ice")
    ) {
      return "塊が薄い氷かゴールの上を通る";
    }
    return ["rock", "water", "snow-mound", "wall", "outside"].includes(
      stopper ?? "",
    )
      ? null
      : `塊が${stopper}の手前で止まる`;
  }
  if (slide.pushedSnow) {
    const { to } = slide.pushedSnow;
    return to === goal || state.cells[to] === "thin-ice"
      ? "雪をゴールか薄い氷の上へ押し出す"
      : null;
  }
  const stopper = getIceFloorMazeNeighbor(board, slide.to, direction);
  if (state.cells[slide.to] === "floor") {
    return stopper !== null && state.cells[stopper] === "brittle-rock"
      ? "床の先のもろい岩"
      : null;
  }
  const stopperCell = describeCell(stopper);
  return stopperCell === "sliding-block" || stopperCell === "snow"
    ? `動けない${stopperCell}の手前で止まる`
    : null;
}

describe("手を引く間", () => {
  const stepSlides = listStepSlides();

  test("どの手順にも、印のマスで止まる向きがあること", () => {
    const missing = stepSlides.filter(({ slide }) => slide === null);

    expect(missing).toEqual([]);
  });

  test("最初の手順で操作を教える滑りが、始めの盤面からゴールに止まる最短の道筋の1手目になること", () => {
    const fromStart = findShortestDirections(startState)?.length;
    const afterFirst = findShortestDirections(
      finishSteps(1).boardState.puzzleState,
    )?.length;

    expect({ fromStart, afterFirst }).toEqual({
      fromStart: (afterFirst ?? 0) + 1,
      afterFirst,
    });
  });

  test("手順を終えて残りを最短で進めると、導入で見せるゴールの盤面で完成すること", () => {
    const solved = slideAll(finishSteps(iceFloorMazeTutorial.steps.length), [
      ...(findShortestDirections(freePlayState) ?? []),
    ]);

    expect({
      phase: solved.phase,
      position: solved.boardState.puzzleState.position,
      cells: solved.boardState.puzzleState.cells,
      blocks: solved.boardState.puzzleState.blocks,
    }).toEqual({
      phase: "solved",
      position: iceFloorMazeTutorial.goal().puzzleState.position,
      cells: iceFloorMazeTutorial.goal().puzzleState.cells,
      blocks: iceFloorMazeTutorial.goal().puzzleState.blocks,
    });
  });

  test("各手順の滑りが、その手順までに示したルールだけで読めること", () => {
    const unearned = stepSlides.flatMap(({ before, slide, earnedRuleIds }) =>
      slide
        ? readIceFloorMazeTutorialSlide(
            before.boardState.puzzleState,
            slide,
          ).ruleIds.filter((ruleId) => !earnedRuleIds.includes(ruleId))
        : [],
    );

    expect(unearned).toEqual([]);
  });

  test("各手順の滑りが、その手順で示すルールを決め手に使うこと", () => {
    const unused = stepSlides.flatMap(({ step, before, slide }) =>
      slide &&
      step.introducedRuleId !== null &&
      !readIceFloorMazeTutorialSlide(
        before.boardState.puzzleState,
        slide,
      ).ruleIds.includes(step.introducedRuleId)
        ? [step.introducedRuleId]
        : [],
    );

    expect(unused).toEqual([]);
  });

  test("印の滑りに、まだ伝えていない細かいルールで盤面が応える所が無いこと", () => {
    const reactions = stepSlides.flatMap(({ before, slide }) => {
      const reaction = slide
        ? findUntaughtReaction(before.boardState.puzzleState, slide.direction)
        : null;
      return reaction === null ? [] : [reaction];
    });

    expect(reactions).toEqual([]);
  });

  test("印の滑りが、ゴールで止まらないこと", () => {
    const stoppedOnGoal = stepSlides.filter(({ slide }) => slide?.to === goal);

    expect(stoppedOnGoal).toEqual([]);
  });
});

describe("ルールの決め手", () => {
  const ruleIds = iceFloorMazeTutorial.rules.map(({ id }) => id);
  const usedRuleIds = [
    ...listStepSlides().flatMap(({ before, slide }) =>
      slide
        ? readIceFloorMazeTutorialSlide(before.boardState.puzzleState, slide)
            .ruleIds
        : [],
    ),
    ...listFreePlaySlides().flatMap(({ before, slide }) =>
      slide.status === "slid"
        ? readIceFloorMazeTutorialSlide(before, slide).ruleIds
        : [],
    ),
  ];

  test.each(ruleIds)("%s が、1つ以上の滑りの決め手になること", (ruleId) => {
    const used = usedRuleIds.includes(ruleId);

    expect(used).toBe(true);
  });

  test("手順で示すルールが、上部に並べたルールの順と同じこと", () => {
    const introduced = iceFloorMazeTutorial.steps.flatMap(
      ({ introducedRuleId }) =>
        introducedRuleId === null ? [] : [introducedRuleId],
    );

    expect(introduced).toEqual(ruleIds);
  });
});

describe("伝えた止め役", () => {
  const slides = [
    ...listStepSlides().flatMap(({ before, slide }) =>
      slide ? [{ before: before.boardState.puzzleState, slide }] : [],
    ),
    ...listFreePlaySlides().flatMap(({ before, slide }) =>
      slide.status === "slid" ? [{ before, slide }] : [],
    ),
  ];
  const stopperCells = slides.flatMap(({ before, slide }) => {
    const stopper = getIceFloorMazeNeighbor(board, slide.to, slide.direction);
    return stopper === null ? [] : [before.cells[stopper]];
  });
  const createdStoppers = ["water", "snow-mound"] as const;

  test.each(createdStoppers)(
    "要素が変わってできた %s を、伝えた後の滑りで止め役に使うこと",
    (cell) => {
      const used = stopperCells.includes(cell);

      expect(used).toBe(true);
    },
  );
});

describe("手を離した後", () => {
  const graph = exploreIceFloorMazeStates(board, freePlayState, { goal });

  test("どう滑っても、ゴールに止まれなくなる状態へ入らないこと", () => {
    const deadlocked = (graph?.states ?? []).filter(
      (state) => findIceFloorMazeDeadlock(board, state, goal) !== null,
    );

    expect({ explored: graph !== null, deadlocked }).toEqual({
      explored: true,
      deadlocked: [],
    });
  });

  test("最短で3手かかること", () => {
    const directions = findShortestDirections(freePlayState);

    expect(directions?.length).toBe(3);
  });

  test("まだ伝えていない細かいルールで盤面が応える手が、どの状態にも無いこと", () => {
    const reactions = (graph?.states ?? [])
      .filter(({ position }) => position !== goal)
      .flatMap((state) =>
        iceFloorMazeDirections.flatMap((direction) => {
          const reaction = findUntaughtReaction(state, direction);
          return reaction === null ? [] : [reaction];
        }),
      );

    expect(reactions).toEqual([]);
  });
});

describe("iceFloorMazeTutorial.perform", () => {
  describe("滑れる向きがほかにもある手順を引いている間", () => {
    const progress = finishSteps(1);
    const step = iceFloorMazeTutorial.steps[1]!;
    const otherDirections = iceFloorMazeDirections.filter(
      (direction) =>
        slideIceFloorMazePiece(
          board,
          progress.boardState.puzzleState,
          direction,
        ).status === "slid" &&
        findStepSlide(progress.boardState.puzzleState, step.target)
          ?.direction !== direction,
    );

    test("印のマスで止まらない、滑れる向きがあること", () => {
      const count = otherDirections.length;

      expect(count).toBeGreaterThan(0);
    });

    test.each(otherDirections)(
      "印のマスで止まらない向き %s では盤面を変えないこと",
      (direction) => {
        const next = performTutorialAction(iceFloorMazeTutorial, progress, {
          direction,
        });

        expect(next).toBe(progress);
      },
    );

    test("印のマスで止まる向きでは次の手順へ進むこと", () => {
      const next = finishSteps(2);

      expect({
        stepIndex: next.stepIndex,
        position: next.boardState.puzzleState.position,
      }).toEqual({ stepIndex: 2, position: step.target });
    });
  });

  describe("1マスも動けない向き", () => {
    const progress = slideAll(finishSteps(iceFloorMazeTutorial.steps.length), [
      "down",
    ]);

    test("手を離した後も盤面を変えないこと", () => {
      const next = performTutorialAction(iceFloorMazeTutorial, progress, {
        direction: "down",
      });

      expect(next).toBe(progress);
    });
  });

  describe("手を離した後", () => {
    const progress = finishSteps(iceFloorMazeTutorial.steps.length);

    test("最短の道筋から外れる滑りも受け付けること", () => {
      const next = slideAll(progress, ["up"]);

      expect({
        phase: next.phase,
        moved:
          next.boardState.puzzleState.position !==
          progress.boardState.puzzleState.position,
      }).toEqual({ phase: "playing", moved: true });
    });
  });
});

describe("getIceFloorMazeTutorialStepFocus", () => {
  describe("薄い氷の手順", () => {
    const stepIndex = iceFloorMazeTutorial.steps.findIndex(
      ({ introducedRuleId }) => introducedRuleId === "thin-ice",
    );
    const progress = finishSteps(stepIndex);

    test("印のマスと、割れる薄い氷と止める岩を決め手にすること", () => {
      const focus = getIceFloorMazeTutorialStepFocus(
        getTutorialSituation(iceFloorMazeTutorial, progress),
        progress.boardState,
      );

      expect(focus).toEqual({
        target: 1 + 3 * board.width,
        path: [1 + 2 * board.width, 1 + 3 * board.width],
        reasonCellIndices: [1 + 2 * board.width, 1 + 4 * board.width],
      });
    });
  });

  describe("手を離した後", () => {
    const progress = finishSteps(iceFloorMazeTutorial.steps.length);

    test("印を付けないこと", () => {
      const focus = getIceFloorMazeTutorialStepFocus(
        getTutorialSituation(iceFloorMazeTutorial, progress),
        progress.boardState,
      );

      expect(focus).toBeNull();
    });
  });
});

describe("listIceFloorMazeTutorialMoveCellIndices", () => {
  describe("塊を押した手順の後", () => {
    const stepIndex = iceFloorMazeTutorial.steps.findIndex(
      ({ introducedRuleId }) => introducedRuleId === "sliding-block",
    );
    const progress = finishSteps(stepIndex + 1);

    test("駒の通ったマスと、塊の元と行き先と、塊を止めた岩を含むこと", () => {
      const lastMove = progress.boardState.lastMove;
      const cellIndices = lastMove
        ? listIceFloorMazeTutorialMoveCellIndices(lastMove).sort(
            (left, right) => left - right,
          )
        : [];

      expect(cellIndices).toEqual(
        [0, 1, 2, 3, 4].map((y) => 4 + y * board.width),
      );
    });
  });
});

describe("findIceFloorMazeTutorialHintCellIndex", () => {
  describe("手を離した直後", () => {
    const state = iceFloorMazeTutorial.start();
    const freePlay = { ...state, puzzleState: freePlayState };

    test("最短の道筋で次に止まるマスを返すこと", () => {
      const hint = findIceFloorMazeTutorialHintCellIndex(freePlay);

      expect(hint).toBe(2 + 5 * board.width);
    });
  });

  describe("ゴールに止まった後", () => {
    const solved = {
      ...iceFloorMazeTutorial.start(),
      puzzleState: solvedState,
    };

    test("何も返さないこと", () => {
      const hint = findIceFloorMazeTutorialHintCellIndex(solved);

      expect(hint).toBeNull();
    });
  });
});

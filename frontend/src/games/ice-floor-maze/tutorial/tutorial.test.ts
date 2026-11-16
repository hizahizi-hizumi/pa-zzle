import { isIceFloorMazeStaticBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  _private,
  findIceFloorMazeTutorialHint,
  getIceFloorMazeTutorialStepFocus,
  type IceFloorMazeTutorialBoardState,
  type IceFloorMazeTutorialRuleId,
  type IceFloorMazeTutorialSlide,
  iceFloorMazeTutorial,
  iceFloorMazeTutorialPuzzle,
} from "@/games/ice-floor-maze/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialProgress,
} from "@/games/tutorial";

const {
  startState,
  freePlayState,
  listSlides,
  listSlidesToward,
  listStepSlides,
  measureMovesTo,
  stateAt,
} = _private;
const { board, start, goal } = iceFloorMazeTutorialPuzzle;
const { steps } = iceFloorMazeTutorial;

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

function finishSteps(count: number): Progress {
  return steps.slice(0, count).reduce(
    (progress, step) =>
      slideAll(
        progress,
        listStepSlides(progress.boardState.puzzleState, step.target).map(
          ({ direction }) => direction,
        ),
      ),
    finishTutorialIntro(startTutorial(iceFloorMazeTutorial)),
  );
}

/** 滑りの止まる位置を読むのに要るルール。岩か壁で止まる滑りは滑るルールだけで読める。 */
function readSlideRuleIds(
  slide: IceFloorMazeTutorialSlide,
): IceFloorMazeTutorialRuleId[] {
  return [
    "slide",
    ...(board.cells[slide.to] === "floor" ? (["floor"] as const) : []),
    ...(slide.path.includes(goal) ? (["goal"] as const) : []),
  ];
}

function stopsAtRock(slide: IceFloorMazeTutorialSlide): boolean {
  const stopper = getIceFloorMazeNeighbor(board, slide.to, slide.direction);
  return (
    board.cells[slide.to] !== "floor" &&
    stopper !== null &&
    board.cells[stopper] === "rock"
  );
}

/** `from` から滑りを重ねて止まれる位置。ゴールで止まると完成するので、ゴールから先はたどらない。 */
function listReachableStops(from: number): number[] {
  const stops = [from];
  for (let order = 0; order < stops.length; order += 1) {
    const stop = stops[order]!;
    if (stop === goal) {
      continue;
    }
    for (const slide of listSlides(stateAt(stop))) {
      if (!stops.includes(slide.to)) {
        stops.push(slide.to);
      }
    }
  }
  return stops;
}

/** 手順ごとの、始める前の状態と、印のマスへ最も少ない手数で止める滑りの並び。 */
const stepRoutes = steps.map((step, index) => {
  const before = finishSteps(index).boardState.puzzleState;
  return {
    step,
    before,
    slides: listStepSlides(before, step.target),
    // 滑るルールは、操作を教える最初の手順で伝える。
    earnedRuleIds: [
      "slide",
      ...steps
        .slice(0, index + 1)
        .flatMap(({ introducedRuleId }) =>
          introducedRuleId === null ? [] : [introducedRuleId],
        ),
    ],
  };
});

describe("盤面", () => {
  test("要素の無い、レベル1と同じ材料だけの盤面であること", () => {
    const isStatic = isIceFloorMazeStaticBoard(board);

    expect(isStatic).toBe(true);
  });

  test("開始位置とゴールが本番と同じく氷のマスにあること", () => {
    const cells = [board.cells[start], board.cells[goal]];

    expect(cells).toEqual(["ice", "ice"]);
  });
});

describe("手を引く間", () => {
  test("どの手順も、印のマスまで滑りを重ねて止まれること", () => {
    const reached = stepRoutes.map(
      ({ before, slides }) => slides.at(-1)?.to ?? before.position,
    );

    expect(reached).toEqual(steps.map(({ target }) => target));
  });

  test("最初の手順で操作を教える滑りが、上へ1回滑らせて岩の手前で止まる滑りであること", () => {
    const [{ slides }] = stepRoutes as [(typeof stepRoutes)[number]];
    const shape = slides.map((slide) => ({
      direction: slide.direction,
      stopsAtRock: stopsAtRock(slide),
    }));

    expect(shape).toEqual([{ direction: "up", stopsAtRock: true }]);
  });

  test("各手順の滑りが、その手順までに示したルールだけで読めること", () => {
    const unearned = stepRoutes.flatMap(({ slides, earnedRuleIds }) =>
      slides
        .flatMap(readSlideRuleIds)
        .filter((ruleId) => !earnedRuleIds.includes(ruleId)),
    );

    expect(unearned).toEqual([]);
  });

  test("床とゴールの手順の滑りが、その手順で示すルールを決め手に使うこと", () => {
    const used = stepRoutes
      .filter(({ step }) =>
        (["floor", "goal"] as const).some(
          (ruleId) => ruleId === step.introducedRuleId,
        ),
      )
      .map(({ step, slides }) =>
        slides.flatMap(readSlideRuleIds).includes(step.introducedRuleId!),
      );

    expect(used).toEqual([true, true]);
  });

  test("読みの手順は、印のマスへ1回では止まれず、2回の滑りをどちらも岩で止めること", () => {
    const reading = stepRoutes.find(
      ({ step }) => step.introducedRuleId === "stopper",
    )!;
    const shape = reading.slides.map(stopsAtRock);

    expect(shape).toEqual([true, true]);
  });

  test("手順の途中でゴールに止まらないこと", () => {
    const stoppedAtGoal = stepRoutes.flatMap(({ slides }) =>
      slides.filter((slide) => slide.to === goal),
    );

    expect(stoppedAtGoal).toEqual([]);
  });

  test("ルールと読みを伝える手順では、ほかの向きにも滑れて、印を見るだけでは向きが決まらないこと", () => {
    const choices = stepRoutes
      .filter(({ step }) => step.introducedRuleId !== null)
      .map(({ before }) => listSlides(before).length >= 2);

    expect(choices).toEqual([true, true, true]);
  });

  test("どの手順も、印のマスへ最も少ない手数で近づく向きが1つだけであること", () => {
    const counts = stepRoutes.flatMap(({ before, slides, step }) =>
      [before, ...slides.slice(0, -1).map(({ to }) => stateAt(to))].map(
        (state) => listSlidesToward(state, step.target).length,
      ),
    );

    expect(new Set(counts)).toEqual(new Set([1]));
  });
});

describe("手を離した後", () => {
  test("ゴールまで2手以上かかり、伝えた読みがもう一度要ること", () => {
    const moveCount = measureMovesTo(freePlayState.position, goal);

    expect(moveCount).toBeGreaterThanOrEqual(2);
  });

  test("どこからゴールへ滑り込んでも、ゴールの先の岩で止まること", () => {
    const intoGoal = listReachableStops(freePlayState.position).flatMap(
      (stop) =>
        stop === goal
          ? []
          : listSlides(stateAt(stop)).filter((slide) => slide.to === goal),
    );

    expect(intoGoal.map(stopsAtRock)).toEqual(intoGoal.map(() => true));
  });

  test("どう滑っても、ゴールに止まれなくなる所が無いこと", () => {
    const trapped = listReachableStops(freePlayState.position).filter(
      (stop) => measureMovesTo(stop, goal) === null,
    );

    expect(trapped).toEqual([]);
  });

  test("始めの盤面から、手順の滑りの後に最も少ない手数で進めると完成すること", () => {
    const solved = slideAll(
      finishSteps(steps.length),
      listStepSlides(freePlayState, goal).map(({ direction }) => direction),
    );

    expect({
      phase: solved.phase,
      position: solved.boardState.puzzleState.position,
    }).toEqual({
      phase: "solved",
      position: iceFloorMazeTutorial.goal().puzzleState.position,
    });
  });
});

describe("performTutorialAction", () => {
  describe("手を引いている間", () => {
    const progress = finishSteps(0);
    const ignoredDirections = listSlides(startState)
      .filter((slide) => slide.direction !== "up")
      .map(({ direction }) => direction);

    test.each(ignoredDirections)(
      "印のマスへ近づかない向きでは盤面が変わらないこと: %s",
      (direction) => {
        const next = performTutorialAction(iceFloorMazeTutorial, progress, {
          direction,
        });

        expect(next).toBe(progress);
      },
    );
  });

  describe("読みの手順で1回目を滑らせた場合", () => {
    const readingIndex = steps.findIndex(
      ({ introducedRuleId }) => introducedRuleId === "stopper",
    );
    const progress = finishSteps(readingIndex);
    const [first] = stepRoutes[readingIndex]!.slides;

    test("同じ手順のまま盤面が進むこと", () => {
      const next = performTutorialAction(iceFloorMazeTutorial, progress, {
        direction: first!.direction,
      });

      expect({
        stepIndex: next.stepIndex,
        position: next.boardState.puzzleState.position,
      }).toEqual({ stepIndex: readingIndex, position: first!.to });
    });
  });

  describe("手を離した後", () => {
    const progress = finishSteps(steps.length);
    const blocked = (["up", "right", "down", "left"] as const).filter(
      (direction) =>
        !listSlides(freePlayState).some(
          (slide) => slide.direction === direction,
        ),
    );

    test("ゴールへ近づかない向きにも滑れること", () => {
      const next = performTutorialAction(iceFloorMazeTutorial, progress, {
        direction: "down",
      });

      expect(next.boardState.puzzleState.position).not.toBe(
        freePlayState.position,
      );
    });

    test.each(blocked)(
      "1マスも動けない向きでは盤面が変わらないこと: %s",
      (direction) => {
        const next = performTutorialAction(iceFloorMazeTutorial, progress, {
          direction,
        });

        expect(next).toBe(progress);
      },
    );
  });
});

describe("getIceFloorMazeTutorialStepFocus", () => {
  describe("読みの手順を始めた場合", () => {
    const readingIndex = steps.findIndex(
      ({ introducedRuleId }) => introducedRuleId === "stopper",
    );
    const progress = finishSteps(readingIndex);
    const [first, last] = stepRoutes[readingIndex]!.slides;

    test("印のマスとその先の岩を見せ、途中で止まるマスを見せないこと", () => {
      const focus = getIceFloorMazeTutorialStepFocus(
        getTutorialSituation(iceFloorMazeTutorial, progress),
        progress.boardState,
      );

      expect({
        target: focus?.target,
        showsStopper: focus?.cellIndices.includes(
          getIceFloorMazeNeighbor(board, last!.to, last!.direction)!,
        ),
        showsMidway: focus?.cellIndices.includes(first!.to),
      }).toEqual({
        target: steps[readingIndex]!.target,
        showsStopper: true,
        showsMidway: false,
      });
    });
  });
});

describe("getIceFloorMazeTutorialStepFocus の通り道", () => {
  const routes = stepRoutes.filter(
    ({ step }) => step.introducedRuleId !== null,
  );

  test("ルールと読みを伝える手順では、駒から印のマスまでの通り道を見せず、向きを自分で選ばせること", () => {
    const shownPaths = routes.flatMap(({ step, before, slides }) => {
      const progress = finishSteps(steps.indexOf(step));
      const focus = getIceFloorMazeTutorialStepFocus(
        getTutorialSituation(iceFloorMazeTutorial, progress),
        progress.boardState,
      );
      const firstPath = slides[0]!.path.filter(
        (cellIndex) =>
          cellIndex !== step.target &&
          cellIndex !== goal &&
          board.cells[cellIndex] !== "floor",
      );
      return firstPath.filter(
        (cellIndex) =>
          cellIndex !== before.position &&
          focus?.cellIndices.includes(cellIndex),
      );
    });

    expect(shownPaths).toEqual([]);
  });
});

describe("findIceFloorMazeTutorialHint", () => {
  const [first, next] = listStepSlides(freePlayState, goal);
  const progress = slideAll(finishSteps(steps.length), [first!.direction]);

  test("岩で止まる手では、最も少ない手数でゴールに止まる道筋で次に止まるマスと、その先の岩を示すこと", () => {
    const hint = findIceFloorMazeTutorialHint(progress.boardState);

    expect({
      target: hint?.target,
      showsStopper: hint?.cellIndices.includes(
        getIceFloorMazeNeighbor(board, next!.to, next!.direction)!,
      ),
    }).toEqual({ target: next!.to, showsStopper: true });
  });

  test("岩で止まる手では、止めたいマスの先の岩に向けて滑らせる読みの一言を添えること", () => {
    const hint = findIceFloorMazeTutorialHint(progress.boardState);

    expect(hint?.message.headline).toBe(
      steps.find(({ introducedRuleId }) => introducedRuleId === "stopper")!
        .message.headline,
    );
  });

  describe("壁で止まる手の場合", () => {
    const wallProgress = finishSteps(steps.length);

    test("滑るルールの一言を添えること", () => {
      const hint = findIceFloorMazeTutorialHint(wallProgress.boardState);

      expect(hint?.message.headline).toBe(steps[0]!.message.headline);
    });
  });
});

describe("一言", () => {
  const messages: TutorialMessage[] = [
    ...steps.map(({ message }) => message),
    iceFloorMazeTutorial.freePlay,
    iceFloorMazeTutorial.completion.home,
    iceFloorMazeTutorial.completion.play,
    {
      headline: iceFloorMazeTutorial.intro.purpose,
      detail: iceFloorMazeTutorial.intro.goalCaption,
    },
  ];
  const texts = messages.flatMap(({ headline, detail }) =>
    detail === null ? [headline] : [headline, detail],
  );

  test("全角45字まで・3行までで、読点と句点を打たないこと", () => {
    const broken = texts.filter(
      (text) =>
        text.replaceAll("\n", "").length > 45 ||
        text.split("\n").length > 3 ||
        /[、。]/.test(text),
    );

    expect(broken).toEqual([]);
  });

  test("完成で振り返るルールの順が、手順で示す順と同じこと", () => {
    const introduced = steps.flatMap(({ introducedRuleId }) =>
      introducedRuleId === null ? [] : [introducedRuleId],
    );

    expect(iceFloorMazeTutorial.rules.map(({ id }) => id)).toEqual([
      "slide",
      ...introduced,
    ]);
  });
});

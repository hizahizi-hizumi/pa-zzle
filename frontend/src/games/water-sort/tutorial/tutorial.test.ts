import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";
import {
  applyWaterSortMove,
  getWaterSortPourAmount,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  createWaterSortStateKey,
  isCompleteWaterSortBottle,
  isStandardWaterSortInitialState,
  isWaterSortCleared,
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortBottle,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  _private,
  findWaterSortTutorialHintBottle,
  getWaterSortTutorialShownProgress,
  getWaterSortTutorialStepBottle,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  type WaterSortTutorialStep,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";

const { startBottles, goalBottles, countMovesToClear } = _private;
const { steps } = waterSortTutorial;

type Progress = TutorialProgress<
  WaterSortTutorialRuleId,
  WaterSortTutorialBoardState
>;

const started = finishTutorialIntro(startTutorial(waterSortTutorial));

function tapBottles(
  progress: Progress,
  bottleIndices: readonly number[],
): Progress {
  return bottleIndices.reduce(
    (current, bottleIndex) =>
      performTutorialAction(waterSortTutorial, current, { bottleIndex }),
    progress,
  );
}

/** 注ぎ元を選ぶか注ぐ手順の注ぎ。 */
function getStepMove(step: WaterSortTutorialStep | undefined): WaterSortMove {
  if (step === undefined || step.endsWhen === "rejected") {
    throw new Error("注ぎ元を選ぶか注ぐ手順ではない");
  }
  return step.move;
}

/** 手順で押すボトルを順に押して、`count` 個目の手順まで終える。選ぶ手順の次の注ぐ手順では、注ぎ元を選んだまま注ぎ先だけを押す。 */
function playSteps(count: number): Progress {
  return tapBottles(
    started,
    steps.slice(0, count).flatMap((step, index) => {
      if (step.endsWhen === "selected") {
        return [step.move.sourceBottleIndex];
      }
      if (step.endsWhen === "rejected") {
        return [step.bottleIndex];
      }
      return steps[index - 1]?.endsWhen === "selected"
        ? [step.move.destinationBottleIndex]
        : [step.move.sourceBottleIndex, step.move.destinationBottleIndex];
    }),
  );
}

function listReachableStates(from: WaterSortState): WaterSortState[] {
  const reached = new Map([[createWaterSortStateKey(from), from]]);
  const pending = [from];
  for (let current = pending.pop(); current; current = pending.pop()) {
    for (const move of listWaterSortLegalMoves(current)) {
      const next = applyWaterSortMove(current, move);
      const key = next && createWaterSortStateKey(next);
      if (next && key && !reached.has(key)) {
        reached.set(key, next);
        pending.push(next);
      }
    }
  }
  return [...reached.values()];
}

/** いちばん上で重なっている同じ色の数。 */
function countSameColorOnTop(bottle: WaterSortBottle): number {
  const topColor = bottle.at(-1);
  const below = bottle.findLastIndex((color) => color !== topColor);
  return bottle.length - below - 1;
}

function getMessage(progress: Progress) {
  return getTutorialMessage(waterSortTutorial, progress, {
    entry: "selection",
    violationSettled: true,
  });
}

describe("盤面", () => {
  test("始めの盤面が、本番と同じく1色でそろったボトルの無い満杯のボトルと、空のボトル2本から始まること", () => {
    const standard = isStandardWaterSortInitialState(startBottles, 3);
    const hasComplete = startBottles.some(isCompleteWaterSortBottle);

    expect(standard).toBe(true);
    expect(hasComplete).toBe(false);
  });

  test("ゴールの盤面が、そろった盤面で、始めの盤面から注いでたどり着けること", () => {
    const reachableKeys = listReachableStates(startBottles).map(
      createWaterSortStateKey,
    );

    expect(isWaterSortCleared(goalBottles)).toBe(true);
    expect(reachableKeys).toContain(createWaterSortStateKey(goalBottles));
  });
});

describe("手順", () => {
  const pourSteps = steps.flatMap((step, index) =>
    step.endsWhen === "poured"
      ? [{ step, board: playSteps(index).boardState.bottles }]
      : [],
  );
  const [first, second, third, fourth] = pourSteps.map(({ step }) => step);
  const [firstBoard, secondBoard, thirdBoard, fourthBoard] = pourSteps.map(
    ({ board }) => board,
  );
  const releasedBottles = playSteps(steps.length).boardState.bottles;

  test("最初の手順が、ルールを示さずに注ぎ元を選ばせ、選ぶと empty を示して空のボトルへ注ぐ手順へ進むこと", () => {
    const selected = playSteps(1);

    expect(steps[0]?.endsWhen).toBe("selected");
    expect(started.earnedRuleIds).toEqual([]);
    expect(selected.stepIndex).toBe(1);
    expect(selected.earnedRuleIds).toEqual(["empty"]);
    expect(selected.boardState.sourceBottleIndex).toBe(
      getStepMove(steps[1]).sourceBottleIndex,
    );
  });

  test("sorted を示す手順が、そろったボトルを押させ、選べずに揺れたところで次の手順へ進むこと", () => {
    const sortedStepIndex = steps.findIndex(
      ({ introducedRuleId }) => introducedRuleId === "sorted",
    );
    const sortedStep = steps[sortedStepIndex];
    const before = playSteps(sortedStepIndex);
    const after = playSteps(sortedStepIndex + 1);
    const bottleIndex =
      sortedStep?.endsWhen === "rejected" ? sortedStep.bottleIndex : -1;
    const bottle = before.boardState.bottles[bottleIndex];

    expect(bottle && isCompleteWaterSortBottle(bottle)).toBe(true);
    expect(after.stepIndex).toBe(sortedStepIndex + 1);
    expect(after.violated).toBe(false);
    expect(after.boardState.lastMove).toEqual({
      type: "rejected",
      bottleIndex,
      rejection: "complete",
    });
    expect(after.boardState.bottles).toEqual(before.boardState.bottles);
  });

  test("empty を示す1手目が、空のボトルへ1つだけ注ぎ、後のルールを先取りしないこと", () => {
    const destination =
      first && firstBoard?.[first.move.destinationBottleIndex];
    const amount =
      first && firstBoard && getWaterSortPourAmount(firstBoard, first.move);

    expect(first?.introducedRuleId).toBe("empty");
    expect(destination).toEqual([]);
    expect(amount).toBe(1);
  });

  test("same-color を示す2手目が、いちばん上が同じ色のボトルへ1つだけ重ねること", () => {
    const source = second && secondBoard?.[second.move.sourceBottleIndex];
    const destination =
      second && secondBoard?.[second.move.destinationBottleIndex];
    const amount =
      second && secondBoard && getWaterSortPourAmount(secondBoard, second.move);

    expect(second?.introducedRuleId).toBe("same-color");
    expect(destination?.length).toBeGreaterThan(0);
    expect(destination?.at(-1)).toBe(source?.at(-1));
    expect(amount).toBe(1);
  });

  test("together を示す3手目が、重なった同じ色を残さずまとめて移し、1色をそろえること", () => {
    const source = third && thirdBoard?.[third.move.sourceBottleIndex];
    const amount =
      third && thirdBoard && getWaterSortPourAmount(thirdBoard, third.move);
    const destination =
      third && releasedBottles[third.move.destinationBottleIndex];

    expect(third?.introducedRuleId).toBe("together");
    expect(amount).toBeGreaterThanOrEqual(2);
    expect(amount).toBe(source && countSameColorOnTop(source));
    expect(destination && isCompleteWaterSortBottle(destination)).toBe(true);
  });

  test("capacity を示す4手目が、重なった同じ色を空きの足りないボトルへ注ぎ、入るだけ移して残りを注ぎ元に残すこと", () => {
    const source = fourth && fourthBoard?.[fourth.move.sourceBottleIndex];
    const destination =
      fourth && fourthBoard?.[fourth.move.destinationBottleIndex];
    const amount =
      fourth && fourthBoard && getWaterSortPourAmount(fourthBoard, fourth.move);
    const sourceAfter =
      fourth && releasedBottles[fourth.move.sourceBottleIndex];

    expect(fourth?.introducedRuleId).toBe("capacity");
    expect(destination?.at(-1)).toBe(source?.at(-1));
    expect(amount).toBe(
      WATER_SORT_BOTTLE_CAPACITY - (destination?.length ?? 0),
    );
    expect(amount).toBeLessThan(source ? countSameColorOnTop(source) : 0);
    expect(sourceAfter?.at(-1)).toBe(source?.at(-1));
  });

  test("4手目より前の手順では、注ぎ先の空きで移る量が変わらないこと", () => {
    const amountsLimitedByCapacity = pourSteps
      .slice(0, 3)
      .filter(({ step, board }) => {
        const source = board[step.move.sourceBottleIndex] ?? [];
        return (
          getWaterSortPourAmount(board, step.move) < countSameColorOnTop(source)
        );
      });

    expect(amountsLimitedByCapacity).toEqual([]);
  });

  test("手順を終えた後の残りを、どの順に注いでも詰まずにそろえられること", () => {
    const stuckStates = listReachableStates(releasedBottles).filter(
      (state) => countMovesToClear(state) === null,
    );

    expect(stuckStates).toEqual([]);
  });

  test("手順を終えた後の残りをそろえるのに、自分で何手か注ぐ必要があること", () => {
    const moveCount = countMovesToClear(releasedBottles);

    expect(moveCount).toBe(5);
  });
});

describe("performTutorialAction", () => {
  const firstMove = getStepMove(steps[0]);
  const selected = tapBottles(started, [firstMove.sourceBottleIndex]);
  const released = playSteps(steps.length);

  test("手を引いている間は、印の注ぎ元より先に注ぎ先を押しても受け付けないこと", () => {
    const ignored = tapBottles(started, [firstMove.destinationBottleIndex]);

    expect(ignored).toBe(started);
  });

  test("手を引いている間は、選んだ後に印の無いボトルを押しても受け付けないこと", () => {
    const ignored = tapBottles(selected, [4]);

    expect(ignored).toBe(selected);
  });

  test("選んだ注ぎ元をもう一度押すと選び直せること", () => {
    const deselected = tapBottles(selected, [firstMove.sourceBottleIndex]);

    expect(selected.boardState.sourceBottleIndex).toBe(
      firstMove.sourceBottleIndex,
    );
    expect(deselected.boardState.sourceBottleIndex).toBeNull();
    expect(deselected.stepIndex).toBe(1);
  });

  test("手順どおりに注ぐたびに、示したルールを手に入れて、最後に手を離すこと", () => {
    const earned = released.earnedRuleIds;
    const message = getMessage(released);

    expect(earned).toEqual([
      "empty",
      "same-color",
      "together",
      "sorted",
      "capacity",
    ]);
    expect(released.stepIndex).toBe(steps.length);
    expect(message).toBe(waterSortTutorial.freePlay);
  });

  describe("手を離した後の場合", () => {
    // 2本目と3本目の青を空の5本目へ注ぐと、2本目と3本目の上は赤、5本目の上は青になる。
    const pouredOut = tapBottles(released, [1, 4, 2, 4]);
    const rejected = tapBottles(pouredOut, [1, 4]);
    const pouredAfterRejection = tapBottles(rejected, [2]);

    test("いちばん上の色が違うボトルへ注ごうとすると、そのわけを言い、注ぎ元を選んだままにすること", () => {
      const message = getMessage(rejected);

      expect(rejected.violated).toBe(true);
      expect(rejected.boardState.bottles).toEqual(pouredOut.boardState.bottles);
      expect(rejected.boardState.sourceBottleIndex).toBe(1);
      expect(message.headline).toBe("上の色が違うと注げません");
    });

    test("そろったボトルを選ぼうとしたときの一言が、手を離す前の sorted の手順と同じ文であること", () => {
      const headline = getMessage(tapBottles(released, [3])).headline;
      const sortedStep = steps.find(
        ({ introducedRuleId }) => introducedRuleId === "sorted",
      );

      expect(sortedStep?.message.headline).toBe(headline);
    });

    test("満杯のボトルへ注ごうとすると、そのわけを言うこと", () => {
      const progress = tapBottles(released, [1, 0]);
      const message = getMessage(progress);

      expect(progress.violated).toBe(true);
      expect(message.headline).toBe("満杯のボトルには注げません");
    });

    test("次に注ぐと、違反の一言を下げて残りをそろえる一言に戻すこと", () => {
      const message = getMessage(pouredAfterRejection);

      expect(pouredAfterRejection.violated).toBe(false);
      expect(message).toBe(waterSortTutorial.freePlay);
    });

    const unselectableCases = [
      ["そろったボトル", 3, "そろったボトルからは注げません"],
      ["空のボトル", 4, "空のボトルからは注げません"],
    ] as const;

    test.each(unselectableCases)(
      "%sを選ぼうとすると、選ばずにそのわけを言うこと",
      (_, bottleIndex, headline) => {
        const progress = tapBottles(released, [bottleIndex]);
        const message = getMessage(progress);

        expect(progress.boardState.sourceBottleIndex).toBeNull();
        expect(message.headline).toBe(headline);
      },
    );
  });
});

describe("getWaterSortTutorialShownProgress", () => {
  const selected = playSteps(1);
  const deselected = tapBottles(selected, [
    selected.boardState.sourceBottleIndex ?? -1,
  ]);

  const cases = [
    ["始めたとき", started, 0, []],
    ["注ぎ元を選んで空のボトルへ注ぐ手順へ進んだとき", selected, 1, ["empty"]],
    ["その手順で注ぎ元を選び直したとき", deselected, 0, []],
  ] as const;

  test.each(cases)(
    "%sは、その時点の手順と手に入れたルールで見せること",
    (_, progress, stepIndex, earnedRuleIds) => {
      const shown = getWaterSortTutorialShownProgress(progress);

      expect(shown.stepIndex).toBe(stepIndex);
      expect(shown.earnedRuleIds).toEqual(earnedRuleIds);
    },
  );
});

describe("getWaterSortTutorialStepBottle", () => {
  const firstMove = getStepMove(steps[0]);
  const selected = tapBottles(started, [firstMove.sourceBottleIndex]);

  const cases = [
    ["注ぎ元を選ぶ前", started, firstMove.sourceBottleIndex],
    ["注ぎ元を選んだ後", selected, firstMove.destinationBottleIndex],
  ] as const;

  test.each(cases)(
    "%sは、手順で印を付けるボトルを返すこと",
    (_, progress, expected) => {
      const bottleIndex = getWaterSortTutorialStepBottle(
        getTutorialSituation(waterSortTutorial, progress),
        progress.boardState,
      );

      expect(bottleIndex).toBe(expected);
    },
  );
});

describe("findWaterSortTutorialHintBottle", () => {
  const released = playSteps(steps.length);

  test("示されたボトルを押し続けると、そろえ終えること", () => {
    let progress = released;
    for (let turn = 0; turn < 20 && progress.phase === "playing"; turn += 1) {
      const hint = findWaterSortTutorialHintBottle(progress.boardState);
      progress = tapBottles(progress, hint === null ? [] : [hint]);
    }

    expect(progress.phase).toBe("solved");
    // 最も少ない5手を、注ぎ元と注ぎ先の2回ずつ押して注ぐ。
    expect(progress.boardState.moveCount - released.boardState.moveCount).toBe(
      10,
    );
  });

  test("そろった盤面では何も示さないこと", () => {
    const hint = findWaterSortTutorialHintBottle({
      bottles: goalBottles,
      sourceBottleIndex: null,
      moveCount: 0,
      lastMove: null,
    });

    expect(hint).toBeNull();
  });
});

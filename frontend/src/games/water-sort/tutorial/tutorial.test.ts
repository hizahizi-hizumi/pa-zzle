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
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  _private,
  findWaterSortTutorialHintBottle,
  getWaterSortTutorialStepBottle,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
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

/** 手順の注ぎ元と注ぎ先を順に押して、`count` 手目まで進める。 */
function playSteps(count: number): Progress {
  return tapBottles(
    started,
    steps
      .slice(0, count)
      .flatMap(({ move }) => [
        move.sourceBottleIndex,
        move.destinationBottleIndex,
      ]),
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
  const boardsBeforeSteps = steps.map(
    (_, index) => playSteps(index).boardState.bottles,
  );
  const [firstBoard, secondBoard, thirdBoard] = boardsBeforeSteps;
  const [first, second, third] = steps;
  const releasedBottles = playSteps(steps.length).boardState.bottles;

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

  test("together を示す3手目が、上に続く同じ色をまとめて移し、1色をそろえること", () => {
    const amount =
      third && thirdBoard && getWaterSortPourAmount(thirdBoard, third.move);
    const destination =
      third && releasedBottles[third.move.destinationBottleIndex];

    expect(third?.introducedRuleId).toBe("together");
    expect(amount).toBeGreaterThanOrEqual(2);
    expect(destination && isCompleteWaterSortBottle(destination)).toBe(true);
  });

  test("手順を終えた後の残りを、どの順に注いでも詰まずにそろえられること", () => {
    const stuckStates = listReachableStates(releasedBottles).filter(
      (state) => countMovesToClear(state) === null,
    );

    expect(stuckStates).toEqual([]);
  });

  test("手順を終えた後の残りをそろえるのに、自分で何手か注ぐ必要があること", () => {
    const moveCount = countMovesToClear(releasedBottles);

    expect(moveCount).toBe(6);
  });
});

describe("performTutorialAction", () => {
  const firstMove = steps[0]?.move ?? {
    sourceBottleIndex: -1,
    destinationBottleIndex: -1,
  };
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
    expect(deselected.stepIndex).toBe(0);
  });

  test("手順どおりに注ぐたびに、示したルールを手に入れて、最後に手を離すこと", () => {
    const earned = released.earnedRuleIds;
    const message = getMessage(released);

    expect(earned).toEqual(["empty", "same-color", "together"]);
    expect(released.stepIndex).toBe(steps.length);
    expect(message).toBe(waterSortTutorial.freePlay);
  });

  describe("手を離した後の場合", () => {
    // 1本目の上は赤、2本目の上は青。
    const rejected = tapBottles(released, [0, 1]);
    const pouredAfterRejection = tapBottles(rejected, [4]);

    test("いちばん上の色が違うボトルへ注ごうとすると、そのわけを言い、注ぎ元を選んだままにすること", () => {
      const message = getMessage(rejected);

      expect(rejected.violated).toBe(true);
      expect(rejected.boardState.bottles).toEqual(released.boardState.bottles);
      expect(rejected.boardState.sourceBottleIndex).toBe(0);
      expect(message.headline).toBe("いちばん上の色が違うボトルには注げません");
    });

    test("次に注ぐと、違反の一言を下げて残りをそろえる一言に戻すこと", () => {
      const message = getMessage(pouredAfterRejection);

      expect(pouredAfterRejection.violated).toBe(false);
      expect(message).toBe(waterSortTutorial.freePlay);
    });

    const unselectableCases = [
      ["そろったボトル", 3, "このボトルはもうそろっています"],
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

describe("getWaterSortTutorialStepBottle", () => {
  const firstMove = steps[0]?.move;
  const selected = tapBottles(started, [firstMove?.sourceBottleIndex ?? -1]);

  const cases = [
    ["注ぎ元を選ぶ前", started, firstMove?.sourceBottleIndex],
    ["注ぎ元を選んだ後", selected, firstMove?.destinationBottleIndex],
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
    // 最も少ない6手を、注ぎ元と注ぎ先の2回ずつ押して注ぐ。
    expect(progress.boardState.moveCount - released.boardState.moveCount).toBe(
      12,
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

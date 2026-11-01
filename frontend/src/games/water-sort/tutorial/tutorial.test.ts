import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import { applyWaterSortMove } from "@/games/water-sort/puzzle/rules";
import {
  createWaterSortStateKey,
  isStandardWaterSortInitialState,
  isWaterSortCleared,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import { listWaterSortDistinctTransitions } from "@/games/water-sort/puzzle/transitions";
import {
  _private,
  describeWaterSortTutorialOffStepTap,
  findWaterSortTutorialHintBottleIndex,
  getWaterSortTutorialStepBottleIndex,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";

const {
  startState,
  goalState,
  listRulesForMove,
  countShortestMovesToClear,
  findSourceRejection,
} = _private;

type Progress = TutorialProgress<
  WaterSortTutorialRuleId,
  WaterSortTutorialBoardState
>;

const { steps } = waterSortTutorial;

/** 盤面を、手順の注ぎを順に進める。 */
function playSteps(count: number): WaterSortState {
  return steps
    .slice(0, count)
    .reduce(
      (bottles, step) => applyWaterSortMove(bottles, step.move) ?? bottles,
      startState,
    );
}

/** 今の盤面から、本番で注げる手を何度重ねてもたどり着ける盤面。 */
function listReachableStates(bottles: WaterSortState): WaterSortState[] {
  const seen = new Set([createWaterSortStateKey(bottles)]);
  const reachable = [bottles];
  for (let index = 0; index < reachable.length; index += 1) {
    const state = reachable[index] ?? [];
    for (const transition of listWaterSortDistinctTransitions(state)) {
      if (!seen.has(transition.stateKey)) {
        seen.add(transition.stateKey);
        reachable.push(transition.state);
      }
    }
  }
  return reachable;
}

function tapBottles(progress: Progress, bottleIndices: readonly number[]) {
  return bottleIndices.reduce(
    (current, bottleIndex) =>
      performTutorialAction(waterSortTutorial, current, { bottleIndex }),
    progress,
  );
}

/** 手順の印を順にタップする。 */
function tapSteps(progress: Progress, count: number): Progress {
  return tapBottles(
    progress,
    steps
      .slice(0, count)
      .flatMap(({ move }) => [
        move.sourceBottleIndex,
        move.destinationBottleIndex,
      ]),
  );
}

describe("盤面", () => {
  const releasedState = playSteps(steps.length);

  test("始めの盤面が、本番と同じ形の、3色と空のボトル2本の問題であること", () => {
    const standard = isStandardWaterSortInitialState(startState, 3, 2);

    expect(standard).toBe(true);
  });

  test("導入で見せるゴールが、そろった盤面で、手を離した後の盤面からたどり着けること", () => {
    const cleared = isWaterSortCleared(goalState);
    const reachable = listReachableStates(releasedState).some(
      (state) =>
        createWaterSortStateKey(state) === createWaterSortStateKey(goalState),
    );

    expect(cleared).toBe(true);
    expect(reachable).toBe(true);
  });

  test("手順の注ぎが、どれも注げて、その手順までに示したルールだけで決まること", () => {
    const rulesByStep = steps.map((step, index) => {
      const earned = steps
        .slice(0, index + 1)
        .flatMap(({ introducedRuleId }) =>
          introducedRuleId === null ? [] : [introducedRuleId],
        );
      const required = listRulesForMove(playSteps(index), step.move);
      return required?.every((ruleId) => earned.includes(ruleId)) ?? false;
    });

    expect(rulesByStep).toEqual(steps.map(() => true));
  });

  test("ルールを示す手順の注ぎが、そのルールを使うこと", () => {
    const uses = steps.flatMap((step, index) =>
      step.introducedRuleId === null
        ? []
        : [
            listRulesForMove(playSteps(index), step.move)?.includes(
              step.introducedRuleId,
            ) ?? false,
          ],
    );

    expect(uses).toEqual([true, true]);
  });

  test("手を離した後、どう注いでも詰まないこと", () => {
    const deadlocked = listReachableStates(releasedState).filter(
      (state) =>
        classifyWaterSortDeadlock(state, {
          maxVisitedStates: Number.POSITIVE_INFINITY,
        }) !== "playable",
    );

    expect(deadlocked).toEqual([]);
  });

  test("手を離した後、そろうまで最短で3手が残ること", () => {
    const remaining = countShortestMovesToClear(releasedState);

    expect(remaining).toBe(3);
  });
});

describe("waterSortTutorial", () => {
  let progress: Progress;

  beforeEach(() => {
    progress = finishTutorialIntro(startTutorial(waterSortTutorial));
  });

  describe("手を引いている場合", () => {
    test("印のボトルを注ぎ元、注ぎ先の順にタップすると、注いで次の手順へ進むこと", () => {
      const next = tapSteps(progress, 1);

      expect(next.stepIndex).toBe(1);
      expect(next.boardState.bottles).toEqual(playSteps(1));
      expect(next.earnedRuleIds).toEqual(["where"]);
    });

    test("印の無いボトルをタップしても、何も起きないこと", () => {
      const next = tapBottles(progress, [0, 3]);

      expect(next).toBe(progress);
    });

    test("注ぎ元を選んだ後、印の無い注げる先をタップしても、注がないこと", () => {
      const selected = tapBottles(progress, [1]);

      const next = tapBottles(selected, [4]);

      expect(next).toBe(selected);
    });

    test("最後の手順を終えると、手を離して残りをそろえる一言にすること", () => {
      const next = tapSteps(progress, steps.length);

      const message = getTutorialMessage(waterSortTutorial, next, {
        entry: "selection",
        violationSettled: true,
      });

      expect(next.stepIndex).toBe(steps.length);
      expect(message).toEqual(waterSortTutorial.freePlay);
    });
  });

  describe("手を離した後の場合", () => {
    let released: Progress;

    beforeEach(() => {
      released = tapSteps(progress, steps.length);
    });

    const rejectionCases = [
      ["空のボトル", [4], "空のボトルからは注げません"],
      ["そろったボトル", [3], "そろったボトルは、もう動かせません"],
      ["違う色の上", [0, 1], "違う色の上には注げません"],
    ] as const;

    test.each(rejectionCases)(
      "本番で通らない手を、ルールに合わない手として返し、わけを言うこと: %s",
      (_name, bottleIndices, headline) => {
        const next = tapBottles(released, bottleIndices);

        const message = getTutorialMessage(waterSortTutorial, next, {
          entry: "selection",
          violationSettled: true,
        });

        expect(next.violated).toBe(true);
        expect(next.boardState.bottles).toEqual(released.boardState.bottles);
        expect(message.headline).toBe(headline);
      },
    );

    test("注げない先をタップしても、注ぎ元を選んだままにすること", () => {
      const next = tapBottles(released, [0, 1]);

      expect(next.boardState.sourceBottleIndex).toBe(0);
    });

    test("選んだ注ぎ元をもう一度タップすると、選び直せること", () => {
      const next = tapBottles(released, [0, 0]);

      expect(next.boardState.sourceBottleIndex).toBeNull();
      expect(next.violated).toBe(false);
    });

    test("同じ色を重ねていくと、そろえて解き終えること", () => {
      const next = tapBottles(released, [2, 0, 1, 2, 1, 0]);

      expect(next.phase).toBe("solved");
      expect(isWaterSortCleared(next.boardState.bottles)).toBe(true);
    });
  });
});

describe("findSourceRejection", () => {
  const cases = [
    ["空のボトル", [[0, 0, 0, 1], [1, 1, 1, 0], []], 2, "empty"],
    ["1色で満杯のボトル", [[0, 0, 0, 0], [1, 1, 1], [1]], 0, "complete"],
    [
      "注げる先が無いボトル",
      [
        [0, 1, 0, 1],
        [1, 0, 1, 0],
        [2, 2, 2],
      ],
      0,
      "no-destination",
    ],
    ["注げる先があるボトル", [[0, 0, 0, 1], [1, 1, 1, 0], []], 0, null],
  ] as const;

  test.each(cases)(
    "本番で注ぎ元に選べないわけを返すこと: %s",
    (_name, bottles, bottleIndex, expected) => {
      const rejection = findSourceRejection(bottles, bottleIndex);

      expect(rejection).toBe(expected);
    },
  );
});

describe("getWaterSortTutorialStepBottleIndex", () => {
  let progress: Progress;

  beforeEach(() => {
    progress = finishTutorialIntro(startTutorial(waterSortTutorial));
  });

  test("注ぎ元を選ぶまでは注ぎ元に、選んだ後は注ぎ先に印を付けること", () => {
    const selected = tapBottles(progress, [1]);

    const before = getWaterSortTutorialStepBottleIndex(
      getTutorialSituation(waterSortTutorial, progress),
      progress.boardState,
    );
    const after = getWaterSortTutorialStepBottleIndex(
      getTutorialSituation(waterSortTutorial, selected),
      selected.boardState,
    );

    expect(before).toBe(1);
    expect(after).toBe(3);
  });
});

describe("describeWaterSortTutorialOffStepTap", () => {
  let progress: Progress;

  beforeEach(() => {
    progress = finishTutorialIntro(startTutorial(waterSortTutorial));
  });

  describe("注げる先のルールを示した手順の場合", () => {
    let selected: Progress;

    beforeEach(() => {
      selected = tapBottles(tapSteps(progress, 1), [2]);
    });

    test("注ぎ元を選んだまま違う色の上をタップすると、注げないわけを言うこと", () => {
      const message = describeWaterSortTutorialOffStepTap(
        getTutorialSituation(waterSortTutorial, selected),
        selected.boardState,
        1,
      );

      expect(message?.headline).toBe("違う色の上には注げません");
    });

    test("注ぎ元を選んだまま注げる先をタップしても、何も言わないこと", () => {
      const message = describeWaterSortTutorialOffStepTap(
        getTutorialSituation(waterSortTutorial, selected),
        selected.boardState,
        4,
      );

      expect(message).toBeNull();
    });
  });

  describe("注げる先のルールを示す前の場合", () => {
    let selected: Progress;

    beforeEach(() => {
      selected = tapBottles(progress, [1]);
    });

    test("違う色の上をタップしても、何も言わないこと", () => {
      const message = describeWaterSortTutorialOffStepTap(
        getTutorialSituation(waterSortTutorial, selected),
        selected.boardState,
        0,
      );

      expect(message).toBeNull();
    });
  });
});

describe("findWaterSortTutorialHintBottleIndex", () => {
  const releasedState = playSteps(steps.length);

  /** 手がかりのボトルだけをタップし続けたときに、そろうまでにタップした数。 */
  function countTapsFollowingHints(
    bottles: WaterSortState,
  ): number | undefined {
    let state: WaterSortTutorialBoardState = {
      bottles,
      sourceBottleIndex: null,
      moveCount: 0,
      lastMove: null,
    };
    for (let taps = 0; taps < 40; taps += 1) {
      if (isWaterSortCleared(state.bottles)) {
        return taps;
      }
      const bottleIndex = findWaterSortTutorialHintBottleIndex(state);
      if (bottleIndex === null) {
        return undefined;
      }
      state = waterSortTutorial.perform(
        { step: null, earnedRuleIds: ["where", "together"] },
        state,
        { bottleIndex },
      ).state;
    }
    return undefined;
  }

  test("手を離した後のどの盤面からも、手がかりをたどると最短の手数でそろうこと", () => {
    const states = listReachableStates(releasedState).filter(
      (state) => !isWaterSortCleared(state),
    );

    const mismatches = states.filter(
      (state) =>
        countTapsFollowingHints(state) !==
        (countShortestMovesToClear(state) ?? 0) * 2,
    );

    expect(states.length).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});

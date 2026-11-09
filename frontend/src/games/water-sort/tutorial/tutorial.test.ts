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
  isCompleteWaterSortBottle,
  isStandardWaterSortInitialState,
  isWaterSortCleared,
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import { listWaterSortDistinctTransitions } from "@/games/water-sort/puzzle/transitions";
import {
  _private,
  describeWaterSortTutorialStep,
  findWaterSortTutorialHintBottleIndex,
  getWaterSortTutorialSpotlitBottleIndices,
  getWaterSortTutorialStepBottleIndex,
  isWaterSortTutorialFirstCompletion,
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
const fullStepIndex = steps.findIndex(
  ({ introducedRuleId }) => introducedRuleId === "full",
);
const allRuleIds = waterSortTutorial.rules.map(({ id }) => id);

/** 盤面を、手順の注ぎを順に進める。 */
function playSteps(count: number): WaterSortState {
  return steps
    .slice(0, count)
    .reduce(
      (bottles, step) =>
        step.kind === "pour"
          ? (applyWaterSortMove(bottles, step.move) ?? bottles)
          : bottles,
      startState,
    );
}

/** 手順を始めた時点で手に入れているルール。その手順で示すルールを含む。 */
function listEarnedRuleIds(stepIndex: number): WaterSortTutorialRuleId[] {
  return steps
    .slice(0, stepIndex + 1)
    .flatMap(({ introducedRuleId }) =>
      introducedRuleId === null ? [] : [introducedRuleId],
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

/** 空でないボトルを注ぎ元に、ほかのボトルを注ぎ先に選ぶ、すべての組。 */
function listBottlePairs(bottles: WaterSortState): WaterSortMove[] {
  return bottles.flatMap((source, sourceBottleIndex) =>
    source.length === 0
      ? []
      : bottles.flatMap((_, destinationBottleIndex) =>
          sourceBottleIndex === destinationBottleIndex
            ? []
            : [{ sourceBottleIndex, destinationBottleIndex }],
        ),
  );
}

/**
 * 手に入れたルールだけで、注げることと何が移るかが分かる注ぎを重ねて、そろうまでの最短手数。
 * そろえられなければ `null`。
 */
function countShortestMovesByRules(
  bottles: WaterSortState,
  ruleIds: readonly WaterSortTutorialRuleId[],
): number | null {
  const seen = new Set([createWaterSortStateKey(bottles)]);
  let frontier = [bottles];
  for (let moveCount = 0; frontier.length > 0; moveCount += 1) {
    if (frontier.some(isWaterSortCleared)) {
      return moveCount;
    }
    frontier = frontier.flatMap((state) =>
      listBottlePairs(state).flatMap((move) => {
        const rules = listRulesForMove(state, move);
        const next = applyWaterSortMove(state, move);
        if (
          !rules.pourable ||
          !next ||
          !rules.ruleIds.every((ruleId) => ruleIds.includes(ruleId))
        ) {
          return [];
        }
        const key = createWaterSortStateKey(next);
        if (seen.has(key)) {
          return [];
        }
        seen.add(key);
        return [next];
      }),
    );
  }
  return null;
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
      .flatMap(({ kind, move }) =>
        kind === "pour"
          ? [move.sourceBottleIndex, move.destinationBottleIndex]
          : [move.sourceBottleIndex],
      ),
  );
}

function startPlaying(): Progress {
  return finishTutorialIntro(startTutorial(waterSortTutorial));
}

/** 遊ぶ人が伝えられたこと。ルールと、盤面で初めて1色そろったときに伝える、そろったボトルから注げないこと（`complete`）。 */
type Knowledge = WaterSortTutorialRuleId | "complete";

/**
 * 伝えられたことだけから、注ぎ元、注ぎ先の順にタップした結果を読む。
 * 伝えられていないことは、液体を注ぐときの素朴な見込み（どこへでも注げ、上の1つが移り、あふれない）で補う。
 * 結果は、注げない・注いだ後の盤面のどちらかを文字列で表す。注ぎ元に選べないことと、注ぎ先に注げないことは区別しない。
 * 注げる先が無いボトルを本番が注ぎ元に選ばないのは、伝えたルールでどこへも注げないことを、注ぎ先を選ぶ前に知らせるだけなので、注げないと読めば足りる。
 */
function predictTaps(
  bottles: WaterSortState,
  move: WaterSortMove,
  knowledge: readonly Knowledge[],
): string {
  const source = bottles[move.sourceBottleIndex] ?? [];
  if (source.length === 0) {
    return "注げない";
  }
  if (
    knowledge.includes("complete") &&
    source.length === WATER_SORT_BOTTLE_CAPACITY &&
    source.every((color) => color === source[0])
  ) {
    return "注げない";
  }
  const poured = predictPour(bottles, move, knowledge);
  return poured === null ? "注げない" : JSON.stringify(poured);
}

function predictPour(
  bottles: WaterSortState,
  { sourceBottleIndex, destinationBottleIndex }: WaterSortMove,
  knowledge: readonly Knowledge[],
): WaterSortState | null {
  const source = bottles[sourceBottleIndex] ?? [];
  const destination = bottles[destinationBottleIndex] ?? [];
  const color = source.at(-1);
  if (
    knowledge.includes("where") &&
    destination.length > 0 &&
    destination.at(-1) !== color
  ) {
    return null;
  }
  const room = WATER_SORT_BOTTLE_CAPACITY - destination.length;
  if (knowledge.includes("full") && room <= 0) {
    return null;
  }
  let run = 0;
  while (run < source.length && source[source.length - 1 - run] === color) {
    run += 1;
  }
  const wanted = knowledge.includes("together") ? run : 1;
  const amount = knowledge.includes("fit") ? Math.min(wanted, room) : wanted;
  return bottles.map((bottle, bottleIndex) =>
    bottleIndex === sourceBottleIndex
      ? source.slice(0, source.length - amount)
      : bottleIndex === destinationBottleIndex
        ? [...destination, ...source.slice(source.length - amount)]
        : bottle,
  );
}

/** チュートリアルで、手を離した後に注ぎ元、注ぎ先の順にタップした結果。`predictTaps` と同じ形で表す。 */
function performTaps(bottles: WaterSortState, move: WaterSortMove): string {
  const situation = { step: null, earnedRuleIds: allRuleIds };
  const selected = waterSortTutorial.perform(
    situation,
    { ...waterSortTutorial.start(), bottles },
    { bottleIndex: move.sourceBottleIndex },
  );
  if (selected.state.sourceBottleIndex === null) {
    return "注げない";
  }
  const poured = waterSortTutorial.perform(situation, selected.state, {
    bottleIndex: move.destinationBottleIndex,
  });
  return poured.state.lastMove?.type === "poured"
    ? JSON.stringify(poured.state.bottles)
    : "注げない";
}

describe("盤面", () => {
  const releasedState = playSteps(steps.length);
  const releasedStates = listReachableStates(releasedState);
  const stepStates = steps.map((_, index) => playSteps(index));
  const whereStepIndex = steps.findIndex(
    ({ introducedRuleId }) => introducedRuleId === "where",
  );

  test("始めの盤面が、本番と同じ形の、3色と空のボトル2本の問題であること", () => {
    const standard = isStandardWaterSortInitialState(startState, 3, 2);

    expect(standard).toBe(true);
  });

  test("導入で見せるゴールが、そろった盤面で、手を離した後の盤面からたどり着けること", () => {
    const cleared = isWaterSortCleared(goalState);
    const reachable = releasedStates.some(
      (state) =>
        createWaterSortStateKey(state) === createWaterSortStateKey(goalState),
    );

    expect(cleared).toBe(true);
    expect(reachable).toBe(true);
  });

  test("手順の手が、その手順までに示したルールだけで決まり、注ぐ手は注げて、注ごうとさせる手は注げないこと", () => {
    const decided = steps.map((step, index) => {
      const rules = listRulesForMove(stepStates[index] ?? [], step.move);
      const earned = listEarnedRuleIds(index);
      return (
        rules.pourable === (step.kind === "pour") &&
        rules.ruleIds.every((ruleId) => earned.includes(ruleId))
      );
    });

    expect(decided).toEqual(steps.map(() => true));
  });

  test("操作を教える手順の注ぎが、注いだ色を、ゴールでその色がそろうボトルへ移すこと", () => {
    const matches = steps.flatMap((step, index) => {
      if (listEarnedRuleIds(index).length > 0) {
        return [];
      }
      const { sourceBottleIndex, destinationBottleIndex } = step.move;
      const color = stepStates[index]?.[sourceBottleIndex]?.at(-1);
      const goalBottle = goalState[destinationBottleIndex] ?? [];
      return [
        goalBottle.length === WATER_SORT_BOTTLE_CAPACITY &&
          goalBottle.every((goalColor) => goalColor === color),
      ];
    });

    expect(matches).toEqual([true]);
  });

  test("注ぐ手順の注ぎ元を選んだ途中の盤面が、本番で選べる注ぎ元を選んだ盤面で、注ごうとさせる手順の印のボトルは本番で選べないこと", () => {
    const rejections = steps.map((step, index) =>
      findSourceRejection(stepStates[index] ?? [], step.move.sourceBottleIndex),
    );

    expect(rejections).toEqual(
      steps.map(({ kind }) => (kind === "pour" ? null : "no-destination")),
    );
  });

  test("ルールを示す手順の注ぎが、どれもそのルールで決まること", () => {
    const uses = steps.flatMap((step, index) => {
      const { introducedRuleId } = step;
      return introducedRuleId === null
        ? []
        : [
            listRulesForMove(
              stepStates[index] ?? [],
              step.move,
            ).ruleIds.includes(introducedRuleId),
          ];
    });

    expect(uses).toEqual(allRuleIds.map(() => true));
  });

  test("満杯のルールを示す手順で、印のボトルを、同じ色が上にある満杯のボトルへ注ごうとさせ、ほかにも注げる先が無いこと", () => {
    const fullStep = steps[fullStepIndex];
    const bottles = stepStates[fullStepIndex] ?? [];
    const sourceBottleIndex = fullStep?.move.sourceBottleIndex ?? -1;
    const attempted = fullStep && listRulesForMove(bottles, fullStep.move);
    const pourableDestinations = bottles.flatMap((_, destinationBottleIndex) =>
      destinationBottleIndex !== sourceBottleIndex &&
      listRulesForMove(bottles, { sourceBottleIndex, destinationBottleIndex })
        .pourable
        ? [destinationBottleIndex]
        : [],
    );

    expect(fullStep?.kind).toBe("refusal");
    expect(attempted).toEqual({ pourable: false, ruleIds: ["full"] });
    expect(pourableDestinations).toEqual([]);
  });

  test("手を離すまでに、すべてのルールを示すこと", () => {
    const earned = listEarnedRuleIds(steps.length - 1);

    expect(earned).toEqual(allRuleIds);
  });

  test("同じ色の上に注げると示してから満杯のルールを示すまで、注ぎ元から満杯のために注げないボトルが無いこと", () => {
    const fullTargets = steps
      .slice(whereStepIndex, fullStepIndex)
      .flatMap((step, offset) => {
        const index = whereStepIndex + offset;
        const bottles = stepStates[index] ?? [];
        return bottles.flatMap((_, destinationBottleIndex) => {
          if (destinationBottleIndex === step.move.sourceBottleIndex) {
            return [];
          }
          const rules = listRulesForMove(bottles, {
            sourceBottleIndex: step.move.sourceBottleIndex,
            destinationBottleIndex,
          });
          return !rules.pourable && rules.ruleIds.includes("full")
            ? [{ step: index + 1, destinationBottleIndex }]
            : [];
        });
      });

    expect(fullTargets).toEqual([]);
  });

  test("手を離した後、どう注いでも詰まないこと", () => {
    const deadlocked = releasedStates.filter(
      (state) =>
        classifyWaterSortDeadlock(state, {
          maxVisitedStates: Number.POSITIVE_INFINITY,
        }) !== "playable",
    );

    expect(deadlocked).toEqual([]);
  });

  test("手を離した後、伝えたルールだけで分かる注ぎを重ねて、最短の3手でそろうこと", () => {
    const byRules = countShortestMovesByRules(releasedState, allRuleIds);
    const shortest = countShortestMovesToClear(releasedState);

    expect(byRules).toBe(3);
    expect(shortest).toBe(3);
  });

  test("最後の手順の注ぎで、盤面に初めて1色そろうこと", () => {
    const completedBefore = (stepStates.at(-1) ?? []).filter(
      isCompleteWaterSortBottle,
    );
    const completedAfter = releasedState.filter(isCompleteWaterSortBottle);

    expect(completedBefore).toEqual([]);
    expect(completedAfter).toHaveLength(1);
  });

  describe("手を離した後に、ボトルを2本タップした結果を、伝えたことから読む場合", () => {
    /** 伝えたこと。ルールと、盤面で初めて1色そろったときに伝える、そろったボトルから注げないこと。 */
    const allKnowledge: readonly Knowledge[] = [...allRuleIds, "complete"];
    const taps = releasedStates.flatMap((bottles) =>
      listBottlePairs(bottles).map((move) => ({ bottles, move })),
    );

    test("伝えたことすべてから読むと、どのタップの結果も本番と同じになること", () => {
      const mismatches = taps.filter(
        ({ bottles, move }) =>
          predictTaps(bottles, move, allKnowledge) !==
          performTaps(bottles, move),
      );

      expect(taps.length).toBeGreaterThan(0);
      expect(mismatches).toEqual([]);
    });

    test.each(allKnowledge)(
      "%s を伝えなければ、結果を読み違えるタップがあること",
      (missing) => {
        const knowledge = allKnowledge.filter((item) => item !== missing);

        const mismatches = taps.filter(
          ({ bottles, move }) =>
            predictTaps(bottles, move, knowledge) !==
            performTaps(bottles, move),
        );

        expect(mismatches.length).toBeGreaterThan(0);
      },
    );
  });
});

describe("listRulesForMove", () => {
  const cases = [
    ["空のボトルへ1つ", [[0, 1], []], true, []],
    ["同じ色の上へ1つ", [[0, 1], [1]], true, ["where"]],
    ["空のボトルへ2つ", [[0, 1, 1], []], true, ["together"]],
    [
      "1つしか入らない同じ色の上へ",
      [
        [0, 1, 1],
        [0, 0, 1],
      ],
      true,
      ["where", "fit"],
    ],
    ["違う色の上", [[0, 1], [0]], false, ["where"]],
    [
      "満杯で上が同じ色のボトル",
      [
        [0, 1],
        [0, 0, 1, 1],
      ],
      false,
      ["full"],
    ],
    [
      "満杯で上が違う色のボトル",
      [
        [0, 1],
        [1, 1, 0, 0],
      ],
      false,
      ["where"],
    ],
  ] as const;

  test.each(cases)(
    "注げるかと、それを決めるルールを返すこと: %s",
    (_name, bottles, pourable, ruleIds) => {
      const rules = listRulesForMove(bottles, {
        sourceBottleIndex: 0,
        destinationBottleIndex: 1,
      });

      expect(rules).toEqual({ pourable, ruleIds });
    },
  );
});

describe("waterSortTutorial", () => {
  let progress: Progress;

  beforeEach(() => {
    progress = startPlaying();
  });

  describe("手を引いている場合", () => {
    test("印のボトルを注ぎ元、注ぎ先の順にタップすると、注いで次の手順へ進むこと", () => {
      const next = tapSteps(progress, 1);

      expect(next.stepIndex).toBe(1);
      expect(next.boardState.bottles).toEqual(playSteps(1));
      expect(next.earnedRuleIds).toEqual(["where"]);
    });

    test("印の無いボトルをタップしても、何も起きないこと", () => {
      const next = tapBottles(progress, [1, 3]);

      expect(next).toBe(progress);
    });

    test("最後の手順を終えると、手を離して残りをそろえる一言にすること", () => {
      const next = tapSteps(progress, steps.length);

      const message = getTutorialMessage(waterSortTutorial, next, {
        entry: "home",
        violationSettled: true,
      });

      expect(next.stepIndex).toBe(steps.length);
      expect(message).toEqual(waterSortTutorial.freePlay);
    });

    describe("注ぎ元を選んだ場合", () => {
      let selected: Progress;

      beforeEach(() => {
        selected = tapBottles(progress, [0]);
      });

      test("印の無い注げる先をタップしても、注がないこと", () => {
        const next = tapBottles(selected, [4]);

        expect(next).toBe(selected);
      });

      test("注げる先のルールを示す前に違う色の上をタップしても、何も起きないこと", () => {
        const next = tapBottles(selected, [1]);

        expect(next).toBe(selected);
      });
    });

    describe("満杯のボトルへ注ごうとさせる手順に進んだ場合", () => {
      let refusing: Progress;

      beforeEach(() => {
        refusing = tapSteps(progress, fullStepIndex);
      });

      test("印のボトルをタップすると、本番と同じく注ぎ先が無いボトルとしてはじき、盤面を変えずに次の手順へ進むこと", () => {
        const next = tapBottles(refusing, [4]);

        expect(next.stepIndex).toBe(fullStepIndex + 1);
        expect(next.violated).toBe(false);
        expect(next.boardState.bottles).toEqual(refusing.boardState.bottles);
        expect(next.boardState.sourceBottleIndex).toBeNull();
        expect(next.boardState.lastMove).toEqual({
          type: "rejected",
          bottleIndex: 4,
          rejection: "no-destination",
        });
      });

      test("印の無いボトルをタップしても、何も起きないこと", () => {
        const next = tapBottles(refusing, [2]);

        expect(next).toBe(refusing);
      });
    });

    describe("注げる先のルールを示した手順で注ぎ元を選んだ場合", () => {
      let selected: Progress;

      beforeEach(() => {
        selected = tapBottles(tapSteps(progress, 1), [2]);
      });

      test("違う色の上をタップすると、本番と同じくルールに合わない手として返し、注ぎ元を選んだまま、わけを言うこと", () => {
        const next = tapBottles(selected, [1]);

        const message = getTutorialMessage(waterSortTutorial, next, {
          entry: "home",
          violationSettled: true,
        });

        expect(next.violated).toBe(true);
        expect(next.stepIndex).toBe(selected.stepIndex);
        expect(next.boardState.bottles).toEqual(selected.boardState.bottles);
        expect(next.boardState.sourceBottleIndex).toBe(2);
        expect(message.headline).toBe("違う色の上には注げません");
      });

      test("ルールに合わない手の後も、印の注ぎ先をタップすると注いで次の手順へ進むこと", () => {
        const next = tapBottles(selected, [1, 3]);

        expect(next.violated).toBe(false);
        expect(next.stepIndex).toBe(2);
      });
    });
  });

  describe("手を離した後の場合", () => {
    let released: Progress;

    beforeEach(() => {
      released = tapSteps(progress, steps.length);
    });

    const rejectionCases = [
      ["空のボトル", [1, 0, 2, 3], [2], "空のボトルからは注げません"],
      ["そろったボトル", [], [4], "そろったボトルからは注げません"],
      ["違う色の上", [], [1, 3], "違う色の上には注げません"],
    ] as const;

    describe.each(rejectionCases)(
      "本番で通らない手をタップした場合: %s",
      (_name, setupBottles, rejectedBottles, headline) => {
        let before: Progress;

        beforeEach(() => {
          before = tapBottles(released, setupBottles);
        });

        test("ルールに合わない手として返し、盤面を変えずにわけを言うこと", () => {
          const next = tapBottles(before, rejectedBottles);

          const message = getTutorialMessage(waterSortTutorial, next, {
            entry: "home",
            violationSettled: true,
          });

          expect(next.violated).toBe(true);
          expect(next.boardState.bottles).toEqual(before.boardState.bottles);
          expect(message.headline).toBe(headline);
        });
      },
    );

    test("注げない注ぎ先をタップしても、注ぎ元を選んだままにすること", () => {
      const next = tapBottles(released, [1, 3]);

      expect(next.boardState.sourceBottleIndex).toBe(1);
    });

    test("選んだ注ぎ元をもう一度タップすると、選び直せること", () => {
      const next = tapBottles(released, [1, 1]);

      expect(next.boardState.sourceBottleIndex).toBeNull();
      expect(next.violated).toBe(false);
    });

    test("同じ色を重ねていくと、そろえて解き終えること", () => {
      const next = tapBottles(released, [1, 0, 2, 3, 1, 3]);

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
      "注ぎ先が無いボトル",
      [
        [0, 1, 0, 1],
        [1, 0, 1, 0],
        [2, 2, 2],
      ],
      0,
      "no-destination",
    ],
    ["注ぎ先があるボトル", [[0, 0, 0, 1], [1, 1, 1, 0], []], 0, null],
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
  let selected: Progress;

  beforeEach(() => {
    progress = startPlaying();
    selected = tapBottles(progress, [0]);
  });

  test("注ぎ元を選ぶまでは注ぎ元に、選んだ後は注ぎ先に印を付けること", () => {
    const before = getWaterSortTutorialStepBottleIndex(
      getTutorialSituation(waterSortTutorial, progress),
      progress.boardState,
    );
    const after = getWaterSortTutorialStepBottleIndex(
      getTutorialSituation(waterSortTutorial, selected),
      selected.boardState,
    );

    expect(before).toBe(0);
    expect(after).toBe(3);
  });
});

describe("describeWaterSortTutorialStep", () => {
  let progress: Progress;
  let selected: Progress;

  beforeEach(() => {
    progress = tapSteps(startPlaying(), 1);
    selected = tapBottles(progress, [2]);
  });

  test("注ぎ元を選ぶまでは印のボトルから注ぐと言い、選んだ後は印のボトルへ注ぐと言うこと", () => {
    const details = [progress, selected].map((current) => {
      const { step } = getTutorialSituation(waterSortTutorial, current);
      return (
        step && describeWaterSortTutorialStep(step, current.boardState).detail
      );
    });

    expect(details).toEqual(["印のボトルから注ぎます", "印のボトルへ注ぎます"]);
  });
});

describe("getWaterSortTutorialSpotlitBottleIndices", () => {
  describe("手を引いている場合", () => {
    let progress: Progress;
    let rejected: Progress;

    beforeEach(() => {
      progress = tapSteps(startPlaying(), 1);
      rejected = tapBottles(progress, [2, 1]);
    });

    test("手順の注ぎ元と注ぎ先を抜くこと", () => {
      const spotlit = getWaterSortTutorialSpotlitBottleIndices(
        getTutorialSituation(waterSortTutorial, progress),
        progress.boardState,
        false,
      );

      expect(spotlit).toEqual([2, 3]);
    });

    test("わけの一言を出している間は、ルールに当たって注げなかった注ぎ先も抜くこと", () => {
      const spotlit = getWaterSortTutorialSpotlitBottleIndices(
        getTutorialSituation(waterSortTutorial, rejected),
        rejected.boardState,
        true,
      );

      expect(spotlit).toEqual([2, 3, 1]);
    });

    test("わけの一言を下げたら、注げなかった注ぎ先を抜かないこと", () => {
      const spotlit = getWaterSortTutorialSpotlitBottleIndices(
        getTutorialSituation(waterSortTutorial, rejected),
        rejected.boardState,
        false,
      );

      expect(spotlit).toEqual([2, 3]);
    });
  });

  describe("手を離した後の場合", () => {
    let released: Progress;

    beforeEach(() => {
      released = tapSteps(startPlaying(), steps.length);
    });

    test("覆いから抜かないこと", () => {
      const spotlit = getWaterSortTutorialSpotlitBottleIndices(
        getTutorialSituation(waterSortTutorial, released),
        released.boardState,
        false,
      );

      expect(spotlit).toBeNull();
    });
  });
});

describe("isWaterSortTutorialFirstCompletion", () => {
  let released: Progress;
  let selected: Progress;
  let rejected: Progress;
  let pouredAgain: Progress;

  beforeEach(() => {
    released = tapSteps(startPlaying(), steps.length);
    selected = tapBottles(released, [1]);
    rejected = tapBottles(released, [4]);
    pouredAgain = tapBottles(released, [1, 0]);
  });

  test.each([
    ["初めてそろえた手順の注ぎの直後", () => released, true],
    ["その後に注ぎ元を選んだとき", () => selected, true],
    ["その後にルールに合わない手を打ったとき", () => rejected, false],
    ["その後に次の注ぎをしたとき", () => pouredAgain, false],
  ] as const)(
    "初めてそろえてから、次に注ぐかルールに合わない手を打つまでの間だけ真を返すこと: %s",
    (_name, getProgress, expected) => {
      const first = isWaterSortTutorialFirstCompletion(
        getProgress().boardState,
      );

      expect(first).toBe(expected);
    },
  );
});

describe("waterSortTutorial.perform", () => {
  const pourStepCount = steps.filter(({ kind }) => kind === "pour").length;
  let released: Progress;
  let selected: Progress;
  let completedAgain: Progress;

  beforeEach(() => {
    released = tapSteps(startPlaying(), steps.length);
    selected = tapBottles(released, [1]);
    completedAgain = tapBottles(released, [1, 0]);
  });

  test("注いでそろったボトルを、次に注ぐまで残すこと", () => {
    const completions = [released, selected].map(
      ({ boardState }) => boardState.completion,
    );

    expect(completions).toEqual([
      { bottleIndex: 4, id: pourStepCount, first: true },
      { bottleIndex: 4, id: pourStepCount, first: true },
    ]);
  });

  test("次の注ぎでそろったら、そのボトルに替えること", () => {
    const { completion } = completedAgain.boardState;

    expect(completion).toEqual({
      bottleIndex: 0,
      id: pourStepCount + 1,
      first: false,
    });
  });
});

describe("findWaterSortTutorialHintBottleIndex", () => {
  const unsolvedStates = listReachableStates(playSteps(steps.length)).filter(
    (state) => !isWaterSortCleared(state),
  );

  /** 手がかりのボトルだけをタップし続けたときに、そろうまでにタップした数。 */
  function countTapsFollowingHints(
    bottles: WaterSortState,
  ): number | undefined {
    let state: WaterSortTutorialBoardState = {
      bottles,
      sourceBottleIndex: null,
      lastMove: null,
      pourCount: 0,
      completion: null,
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
        { step: null, earnedRuleIds: allRuleIds },
        state,
        { bottleIndex },
      ).state;
    }
    return undefined;
  }

  test("手を離した後のどの盤面からも、手がかりをたどると最短の手数でそろうこと", () => {
    const mismatches = unsolvedStates.filter(
      (state) =>
        countTapsFollowingHints(state) !==
        (countShortestMovesToClear(state) ?? 0) * 2,
    );

    expect(unsolvedStates.length).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});

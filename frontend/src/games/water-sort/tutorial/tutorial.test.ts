import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  createWaterSortStateKey,
  isStandardWaterSortInitialState,
  isWaterSortCleared,
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import { listWaterSortDistinctTransitions } from "@/games/water-sort/puzzle/transitions";
import {
  _private,
  describeWaterSortTutorialFreePlay,
  describeWaterSortTutorialStep,
  findWaterSortTutorialHintBottleIndex,
  getWaterSortTutorialProgressRatio,
  getWaterSortTutorialStepBottleIndex,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRejection,
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
const allRuleIds = waterSortTutorial.rules.map(({ id }) => id);

/** 手順の印を、注ぎ元、注ぎ先の順にタップするボトル。 */
const stepTaps = steps.flatMap(({ move }) => [
  move.sourceBottleIndex,
  move.destinationBottleIndex,
]);

/** 手を離した後、青を空のボトルへよけて、最短の5手でそろえるタップ。 */
const solvingTaps = [2, 4, 2, 3, 2, 4, 0, 4, 1, 0] as const;

/** 手順の注ぎを、先頭から `count` 手まで進めた盤面。 */
function playSteps(count: number): WaterSortState {
  return steps
    .slice(0, count)
    .reduce(
      (bottles, step) => applyWaterSortMove(bottles, step.move) ?? bottles,
      startState,
    );
}

/** 手順を始めた時点で伝えたルール。その手順で示すルールを含む。 */
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
    for (const transition of listWaterSortDistinctTransitions(
      reachable[index] ?? [],
    )) {
      if (!seen.has(transition.stateKey)) {
        seen.add(transition.stateKey);
        reachable.push(transition.state);
      }
    }
  }
  return reachable;
}

/** 注ぎ元と注ぎ先に、違うボトルを選ぶすべての組。 */
function listBottlePairs(bottles: WaterSortState): WaterSortMove[] {
  return bottles.flatMap((_, sourceBottleIndex) =>
    bottles.flatMap((__, destinationBottleIndex) =>
      sourceBottleIndex === destinationBottleIndex
        ? []
        : [{ sourceBottleIndex, destinationBottleIndex }],
    ),
  );
}

/** 今の盤面から最短の手数でそろえる、すべての解き方。手ごとに、注ぐ前の盤面と注ぎを並べる。 */
function listShortestSolutions(
  bottles: WaterSortState,
): { bottles: WaterSortState; move: WaterSortMove }[][] {
  const remaining = countShortestMovesToClear(bottles);
  if (remaining === null) {
    return [];
  }
  if (remaining === 0) {
    return [[]];
  }
  return listWaterSortLegalMoves(bottles).flatMap((move) => {
    const next = applyWaterSortMove(bottles, move);
    if (!next || countShortestMovesToClear(next) !== remaining - 1) {
      return [];
    }
    return listShortestSolutions(next).map((rest) => [
      { bottles, move },
      ...rest,
    ]);
  });
}

function createBoardState(
  bottles: WaterSortState,
): WaterSortTutorialBoardState {
  return { ...waterSortTutorial.start(), bottles };
}

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

function startPlaying(): Progress {
  return finishTutorialIntro(startTutorial(waterSortTutorial));
}

describe("盤面", () => {
  const stepStates = steps.map((_, index) => playSteps(index));
  const releasedState = playSteps(steps.length);
  const releasedStates = listReachableStates(releasedState);

  test("始めの盤面が、本番と同じ形の、3色と空のボトル2本の問題であること", () => {
    const standard = isStandardWaterSortInitialState(startState, 3, 2);

    expect(standard).toBe(true);
  });

  test("導入で見せるゴールが、そろった盤面で、手を離した後の盤面からたどり着けること", () => {
    const goalKey = createWaterSortStateKey(goalState);

    const reachable = releasedStates.some(
      (state) => createWaterSortStateKey(state) === goalKey,
    );

    expect(isWaterSortCleared(goalState)).toBe(true);
    expect(reachable).toBe(true);
  });

  describe("手を引く間の場合", () => {
    test("操作を教える手が、注いだ色を、ゴールでその色がそろうボトルへ移すこと", () => {
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

    test("どの手も注げて、それまでに伝えたルールだけで決まること", () => {
      const decided = steps.map((step, index) => {
        const rules = listRulesForMove(stepStates[index] ?? [], step.move);
        const earned = listEarnedRuleIds(index);
        return (
          rules.pourable &&
          rules.ruleIds.every((ruleId) => earned.includes(ruleId))
        );
      });

      expect(decided).toEqual(steps.map(() => true));
    });

    test("ルールを示す手が、どれもそのルールで決まり、どのルールも示すこと", () => {
      const introduced = steps.flatMap((step, index) =>
        step.introducedRuleId === null
          ? []
          : [
              {
                ruleId: step.introducedRuleId,
                decisive: listRulesForMove(
                  stepStates[index] ?? [],
                  step.move,
                ).ruleIds.includes(step.introducedRuleId),
              },
            ],
      );

      expect(introduced).toEqual(
        allRuleIds.map((ruleId) => ({ ruleId, decisive: true })),
      );
    });

    test("注ぎ元を選んだ途中の盤面が、本番で選べる注ぎ元を選んだ盤面で、そこからのタップがまだ伝えていないルールで違反にならないこと", () => {
      const unearnedViolations = steps.flatMap((step, index) => {
        const bottles = stepStates[index] ?? [];
        const earned = listEarnedRuleIds(index);
        const selected = {
          ...createBoardState(bottles),
          sourceBottleIndex: step.move.sourceBottleIndex,
        };
        return bottles.flatMap((_, bottleIndex) => {
          const { outcome } = waterSortTutorial.perform(
            { step, earnedRuleIds: earned },
            selected,
            { bottleIndex },
          );
          const rules = listRulesForMove(bottles, {
            sourceBottleIndex: step.move.sourceBottleIndex,
            destinationBottleIndex: bottleIndex,
          });
          return outcome === "violated" &&
            !rules.ruleIds.every((ruleId) => earned.includes(ruleId))
            ? [{ step: index + 1, bottleIndex }]
            : [];
        });
      });
      const sourceRejections = steps.map((step, index) =>
        findSourceRejection(
          stepStates[index] ?? [],
          step.move.sourceBottleIndex,
        ),
      );

      expect(unearnedViolations).toEqual([]);
      expect(sourceRejections).toEqual(steps.map(() => null));
    });
  });

  describe("手を離した後の場合", () => {
    test("どう注いでも詰まないこと", () => {
      const deadlocked = releasedStates.filter(
        (state) =>
          classifyWaterSortDeadlock(state, {
            maxVisitedStates: Number.POSITIVE_INFINITY,
          }) !== "playable",
      );

      expect(deadlocked).toEqual([]);
    });

    test("最短の5手でそろうこと", () => {
      const shortest = countShortestMovesToClear(releasedState);

      expect(shortest).toBe(5);
    });

    test("最短の解き方が、どれも空のボトルへ注ぐ手を含むこと", () => {
      const solutions = listShortestSolutions(releasedState);

      const withoutEmptyDestination = solutions.filter((solution) =>
        solution.every(
          ({ bottles, move }) =>
            bottles[move.destinationBottleIndex]?.length !== 0,
        ),
      );

      expect(solutions.length).toBeGreaterThan(0);
      expect(withoutEmptyDestination).toEqual([]);
    });
  });
});

describe("listRulesForMove", () => {
  const cases = [
    ["空のボトルへ1つ", [[0, 1], []], true, []],
    ["同じ色の上へ1つ", [[0, 1], [1]], true, ["where"]],
    ["空のボトルへ2つ", [[0, 1, 1], []], true, ["together"]],
    [
      "同じ色の上へ2つ",
      [
        [0, 1, 1],
        [0, 1],
      ],
      true,
      ["where", "together"],
    ],
    ["違う色の上", [[0, 1], [0]], false, ["where"]],
    [
      "満杯のボトル",
      [
        [0, 1],
        [0, 0, 1, 1],
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
    [
      "同じ色が上にあるボトルが満杯で、ほかに注ぎ先も無いボトル",
      [[0, 0, 0], [1, 0], [1, 2, 2, 2], [1, 1], [2]],
      4,
      "no-room",
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

describe("waterSortTutorial.perform", () => {
  let progress: Progress;

  beforeEach(() => {
    progress = startPlaying();
  });

  describe("手を引く間の場合", () => {
    test("印のボトルを注ぎ元、注ぎ先の順にタップすると、注いで次の手順へ進み、そのルールを伝えること", () => {
      const next = tapBottles(progress, stepTaps.slice(0, 2));

      expect(next.stepIndex).toBe(1);
      expect(next.boardState.bottles).toEqual(playSteps(1));
      expect(next.earnedRuleIds).toEqual(["where"]);
    });

    test("印の無いボトルをタップしても、何も起きないこと", () => {
      const next = tapBottles(progress, [1, 3]);

      expect(next).toBe(progress);
    });

    test("手順をすべて終えると、手を離してすべてのルールを伝えていること", () => {
      const next = tapBottles(progress, stepTaps);

      expect(next.stepIndex).toBe(steps.length);
      expect(next.earnedRuleIds).toEqual(allRuleIds);
      expect(next.boardState.bottles).toEqual(playSteps(steps.length));
    });

    describe("注げる先のルールを示す前に注ぎ元を選んだ場合", () => {
      let selected: Progress;

      beforeEach(() => {
        selected = tapBottles(progress, [2]);
      });

      test.each([
        ["違う色の上", 0],
        ["印の無い空のボトル", 4],
        ["選んだ注ぎ元", 2],
      ] as const)("タップしても何も起きないこと: %s", (_name, bottleIndex) => {
        const next = tapBottles(selected, [bottleIndex]);

        expect(next).toBe(selected);
      });
    });

    describe("注げる先のルールを示した後に注ぎ元を選んだ場合", () => {
      let selected: Progress;

      beforeEach(() => {
        selected = tapBottles(progress, [...stepTaps.slice(0, 2), 1]);
      });

      test("違う色の上をタップすると、ルールに合わない手として返し、盤面を変えずに注ぎ元を選んだままにすること", () => {
        const next = tapBottles(selected, [3]);

        expect(next.violated).toBe(true);
        expect(next.stepIndex).toBe(selected.stepIndex);
        expect(next.boardState.bottles).toEqual(selected.boardState.bottles);
        expect(next.boardState.sourceBottleIndex).toBe(1);
        expect(next.boardState.lastMove).toEqual({
          type: "rejected",
          bottleIndex: 3,
          rejection: "different-color",
        });
      });

      test("印の無い注げる先をタップしても、何も起きないこと", () => {
        const next = tapBottles(selected, [4]);

        expect(next).toBe(selected);
      });

      test("ルールに合わない手の後も、印の注ぎ先をタップすると注いで次の手順へ進むこと", () => {
        const next = tapBottles(selected, [3, 2]);

        expect(next.violated).toBe(false);
        expect(next.stepIndex).toBe(2);
      });
    });
  });

  describe("手を離した後の場合", () => {
    const situation = { step: null, earnedRuleIds: allRuleIds };
    const taps = listReachableStates(playSteps(steps.length)).flatMap(
      (bottles) => listBottlePairs(bottles).map((move) => ({ bottles, move })),
    );
    let released: Progress;

    beforeEach(() => {
      released = tapBottles(progress, stepTaps);
    });

    test("どの盤面のどの2本のタップにも、本番と同じく、選べる注ぎ元から注げる分だけ注ぎ、それ以外は盤面を変えないこと", () => {
      const mismatches = taps.filter(({ bottles, move }) => {
        const selected = waterSortTutorial.perform(
          situation,
          createBoardState(bottles),
          { bottleIndex: move.sourceBottleIndex },
        );
        const poured = waterSortTutorial.perform(situation, selected.state, {
          bottleIndex: move.destinationBottleIndex,
        });
        const selectable =
          findSourceRejection(bottles, move.sourceBottleIndex) === null;
        const expected =
          (selectable && applyWaterSortMove(bottles, move)) || bottles;
        return (
          JSON.stringify(poured.state.bottles) !== JSON.stringify(expected)
        );
      });

      expect(taps.length).toBeGreaterThan(0);
      expect(mismatches).toEqual([]);
    });

    const rejectionCases: readonly (readonly [
      string,
      readonly number[],
      number,
      WaterSortTutorialRejection,
      number | null,
    ])[] = [
      ["注げる先が無いボトル", [2, 4], 1, "no-destination", null],
      [
        "同じ色が上にあるボトルが満杯で、ほかに注げる先も無いボトル",
        [2, 4, 3, 2],
        3,
        "no-room",
        null,
      ],
      ["そろったボトル", [2, 4, 2, 3], 3, "complete", null],
      ["空のボトル", [], 4, "empty", null],
      ["違う色の上", [0], 3, "different-color", 0],
      ["満杯のボトル", [2], 0, "full", 2],
    ];

    describe.each(rejectionCases)(
      "本番で通らない手をタップした場合: %s",
      (_name, setupTaps, rejectedBottleIndex, rejection, sourceBottleIndex) => {
        let before: Progress;

        beforeEach(() => {
          before = tapBottles(released, setupTaps);
        });

        test("ルールに合わない手として返し、盤面を変えずに、わけを残すこと", () => {
          const next = tapBottles(before, [rejectedBottleIndex]);

          expect(next.violated).toBe(true);
          expect(next.boardState.bottles).toEqual(before.boardState.bottles);
          expect(next.boardState.sourceBottleIndex).toBe(sourceBottleIndex);
          expect(next.boardState.lastMove).toEqual({
            type: "rejected",
            bottleIndex: rejectedBottleIndex,
            rejection,
          });
        });
      },
    );

    test("選んだ注ぎ元をもう一度タップすると、選び直せること", () => {
      const next = tapBottles(released, [1, 1]);

      expect(next.violated).toBe(false);
      expect(next.boardState.sourceBottleIndex).toBeNull();
      expect(next.boardState.lastMove).toEqual({
        type: "deselected",
        bottleIndex: 1,
      });
    });

    test("最短の解き方のとおりに注ぐと、そろえて解き終えること", () => {
      const next = tapBottles(released, solvingTaps);

      expect(next.phase).toBe("solved");
      expect(isWaterSortCleared(next.boardState.bottles)).toBe(true);
    });
  });
});

describe("waterSortTutorial.describeViolation", () => {
  const rejections = [
    "empty",
    "complete",
    "no-destination",
    "no-room",
    "full",
    "different-color",
  ] as const satisfies readonly WaterSortTutorialRejection[];
  const situation = { step: null, earnedRuleIds: allRuleIds };

  test("注げないわけごとに、違う一言を返すこと", () => {
    const headlines = rejections.map(
      (rejection) =>
        waterSortTutorial.describeViolation(situation, {
          ...waterSortTutorial.start(),
          lastMove: { type: "rejected", bottleIndex: 0, rejection },
        }).headline,
    );

    expect(new Set(headlines).size).toBe(rejections.length);
  });
});

describe("describeWaterSortTutorialStep", () => {
  let firstStep: Progress;
  let firstStepSelected: Progress;
  let secondStepSelected: Progress;

  beforeEach(() => {
    firstStep = startPlaying();
    firstStepSelected = tapBottles(firstStep, [2]);
    secondStepSelected = tapBottles(firstStep, [...stepTaps.slice(0, 2), 1]);
  });

  test("注ぎ元を選ぶまでは手順の一言、選んだ後は注ぎ先の一言を返し、注ぎ先の一言が無い手順は手順の一言のままにすること", () => {
    const messages = [firstStep, firstStepSelected, secondStepSelected].map(
      (current) => {
        const { step } = getTutorialSituation(waterSortTutorial, current);
        return step && describeWaterSortTutorialStep(step, current.boardState);
      },
    );

    expect(messages).toEqual([
      steps[0]?.message,
      steps[0]?.destinationMessage,
      steps[1]?.message,
    ]);
    expect(steps[0]?.destinationMessage).not.toBeNull();
    expect(steps[1]?.destinationMessage).toBeNull();
  });
});

describe("describeWaterSortTutorialFreePlay", () => {
  let released: Progress;
  let oneCompleted: Progress;
  let twoCompleted: Progress;

  beforeEach(() => {
    released = tapBottles(startPlaying(), stepTaps);
    oneCompleted = tapBottles(released, solvingTaps.slice(0, 4));
    twoCompleted = tapBottles(released, solvingTaps.slice(0, 8));
  });

  test("そろった色が無ければ残りを自分でそろえる一言、あればそろった数と残りの数を返すこと", () => {
    const headlines = [released, oneCompleted, twoCompleted].map(
      ({ boardState }) =>
        describeWaterSortTutorialFreePlay(boardState).headline,
    );

    expect(headlines).toEqual([
      waterSortTutorial.freePlay.headline,
      "1色そろいました\nあと2色です",
      "2色そろいました\nあと1色です",
    ]);
  });

  describe("まとめて注いだ同じ色が、注ぎ先に入りきらずに残った場合", () => {
    /** 2つ空いた緑の上へ、3つ続く緑を注ぐ。 */
    const leftoverTaps = [2, 4, 3, 2] as const;
    let leftover: Progress;

    beforeEach(() => {
      leftover = tapBottles(released, leftoverTaps);
    });

    test("残りを自分でそろえる一言の代わりに、入りきらない分が残ると言うこと", () => {
      const message = describeWaterSortTutorialFreePlay(leftover.boardState);

      expect(leftover.boardState.lastMove).toMatchObject({
        type: "poured",
        leftover: true,
      });
      expect(message.headline).not.toBe(waterSortTutorial.freePlay.headline);
    });

    test("次に入りきる注ぎをしたら、残りを自分でそろえる一言に戻すこと", () => {
      const poured = tapBottles(leftover, [0, 4]);

      const message = describeWaterSortTutorialFreePlay(poured.boardState);

      expect(poured.boardState.lastMove).toMatchObject({
        type: "poured",
        leftover: false,
      });
      expect(message.headline).toBe(waterSortTutorial.freePlay.headline);
    });
  });
});

describe("getWaterSortTutorialProgressRatio", () => {
  const releasedStates = listReachableStates(playSteps(steps.length));

  /** 手順どおりに進めてから、最短でそろえるまでの、手ごとの進行。 */
  function listProgressesToSolve(): Progress[] {
    const progresses = [startPlaying()];
    for (const bottleIndex of [...stepTaps, ...solvingTaps]) {
      const current = progresses.at(-1) as Progress;
      progresses.push(
        performTutorialAction(waterSortTutorial, current, { bottleIndex }),
      );
    }
    return progresses;
  }

  test("始めは0で、手順どおりに解く間に後戻りせず、解き終える直前は1未満で、解き終えると1になること", () => {
    const ratios = listProgressesToSolve().map(({ stepIndex, boardState }) =>
      getWaterSortTutorialProgressRatio(stepIndex, boardState),
    );

    const backwards = ratios.filter(
      (ratio, index) => index > 0 && ratio < (ratios[index - 1] ?? 0),
    );

    expect(ratios[0]).toBe(0);
    expect(backwards).toEqual([]);
    expect(ratios.at(-2)).toBeLessThan(1);
    expect(ratios.at(-1)).toBe(1);
  });

  test("手を離した後、どう注いでも後戻りしないこと", () => {
    const backwards = releasedStates.flatMap((bottles) => {
      const ratio = getWaterSortTutorialProgressRatio(
        steps.length,
        createBoardState(bottles),
      );
      return listWaterSortDistinctTransitions(bottles).filter(
        (transition) =>
          getWaterSortTutorialProgressRatio(
            steps.length,
            createBoardState(transition.state),
          ) < ratio,
      );
    });

    expect(backwards).toEqual([]);
  });
});

describe("getWaterSortTutorialStepBottleIndex", () => {
  let firstStep: Progress;
  let selected: Progress;
  let released: Progress;

  beforeEach(() => {
    firstStep = startPlaying();
    selected = tapBottles(firstStep, [2]);
    released = tapBottles(firstStep, stepTaps);
  });

  test("注ぎ元を選ぶまでは注ぎ元、選んだ後は注ぎ先を返し、手を離した後は印を付けないこと", () => {
    const bottleIndices = [firstStep, selected, released].map((current) =>
      getWaterSortTutorialStepBottleIndex(
        getTutorialSituation(waterSortTutorial, current),
        current.boardState,
      ),
    );

    expect(bottleIndices).toEqual([2, 3, null]);
  });
});

describe("findWaterSortTutorialHintBottleIndex", () => {
  const unsolvedStates = listReachableStates(playSteps(steps.length)).filter(
    (state) => !isWaterSortCleared(state),
  );
  const situation = { step: null, earnedRuleIds: allRuleIds };

  /** 手がかりのボトルだけをタップし続けたときに、そろうまでにタップした数。 */
  function countTapsFollowingHints(
    bottles: WaterSortState,
  ): number | undefined {
    let state = createBoardState(bottles);
    for (let taps = 0; taps < 40; taps += 1) {
      if (isWaterSortCleared(state.bottles)) {
        return taps;
      }
      const bottleIndex = findWaterSortTutorialHintBottleIndex(state);
      if (bottleIndex === null) {
        return undefined;
      }
      state = waterSortTutorial.perform(situation, state, {
        bottleIndex,
      }).state;
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

  test("そろった盤面では、手がかりを示さないこと", () => {
    const bottleIndex = findWaterSortTutorialHintBottleIndex(
      createBoardState(goalState),
    );

    expect(bottleIndex).toBeNull();
  });
});

import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  applyWaterSortMove,
  findWaterSortSourceRejection,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
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
  describeWaterSortTutorialCompletion,
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
  releasedState,
  listRulesForMove,
  countShortestMovesToClear,
} = _private;

type Progress = TutorialProgress<
  WaterSortTutorialRuleId,
  WaterSortTutorialBoardState
>;

const { steps } = waterSortTutorial;
const capacityStepIndex = steps.findIndex(
  ({ introducedRuleId }) => introducedRuleId === "capacity",
);
const allRuleIds = waterSortTutorial.rules.map(({ id }) => id);

/** 盤面を、手順の注ぎを順に進める。 */
function playSteps(count: number): WaterSortState {
  return steps
    .slice(0, count)
    .reduce(
      (bottles, { move }) => applyWaterSortMove(bottles, move) ?? bottles,
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

/** 手順の印を順に押す。 */
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

function startPlaying(): Progress {
  return finishTutorialIntro(startTutorial(waterSortTutorial));
}

/** 遊ぶ人が伝えられたこと。ルールと、盤面で初めて1色そろったときに伝える、そろったボトルから注げないこと（`complete`）。 */
type Knowledge = WaterSortTutorialRuleId | "complete";

/**
 * 伝えられたことだけから、注ぎ元、注ぎ先の順に押した結果を読む。
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
  if (knowledge.includes("capacity") && room <= 0) {
    return null;
  }
  let run = 0;
  while (run < source.length && source[source.length - 1 - run] === color) {
    run += 1;
  }
  const wanted = knowledge.includes("together") ? run : 1;
  const amount = knowledge.includes("capacity")
    ? Math.min(wanted, room)
    : wanted;
  return bottles.map((bottle, bottleIndex) =>
    bottleIndex === sourceBottleIndex
      ? source.slice(0, source.length - amount)
      : bottleIndex === destinationBottleIndex
        ? [...destination, ...source.slice(source.length - amount)]
        : bottle,
  );
}

/**
 * 本番のプレイと同じ `puzzle/` の判定で、注ぎ元、注ぎ先の順に押した結果。`predictTaps` と同じ形で表す。
 * 本番は、選べない注ぎ元を `findWaterSortSourceRejection` ではじき、注ぎを `applyWaterSortMove` で決める。
 */
function judgeTapsInPlay(bottles: WaterSortState, move: WaterSortMove): string {
  if (findWaterSortSourceRejection(bottles, move.sourceBottleIndex) !== null) {
    return "注げない";
  }
  const poured = applyWaterSortMove(bottles, move);
  return poured === null ? "注げない" : JSON.stringify(poured);
}

/** チュートリアルで、手を離した後に注ぎ元、注ぎ先の順に押した結果。`predictTaps` と同じ形で表す。 */
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

/**
 * 手を離した盤面から最短の5手でそろえる押し方。緑をそろえ、空いた3本目へ青を集め、赤を5本目へ重ねる。
 * 盤面は `startState` の説明のとおり、1本目「赤青」・2本目「赤青青青」・3本目「緑緑緑」・4本目「緑」・5本目「赤赤」。
 */
const shortestSolutionTaps = [2, 3, 0, 2, 1, 2, 0, 4, 1, 4];

/** 2本目の青を1本目へ戻した後に、1本目と2本目を入れ替えた最短の押し方。 */
const mirroredSolutionTaps = [2, 3, 1, 2, 0, 2, 1, 4, 0, 4];

/** 今の盤面から、本番で注げる手を何度重ねてもたどり着ける盤面。ボトルの並びを入れ替えた盤面は、別の盤面として数える。 */
function listReachableStatesInPlace(bottles: WaterSortState): WaterSortState[] {
  const seen = new Set([JSON.stringify(bottles)]);
  const reachable = [bottles];
  for (let index = 0; index < reachable.length; index += 1) {
    const state = reachable[index] ?? [];
    for (const move of listWaterSortLegalMoves(state)) {
      const next = applyWaterSortMove(state, move);
      const key = JSON.stringify(next);
      if (next && !seen.has(key)) {
        seen.add(key);
        reachable.push(next);
      }
    }
  }
  return reachable;
}

/** 空のボトルへは注がずに、そろうまでの最短手数。そろえられなければ `null`。 */
function countShortestMovesWithoutEmptyDestination(
  bottles: WaterSortState,
): number | null {
  const seen = new Set([createWaterSortStateKey(bottles)]);
  let frontier = [bottles];
  for (let moveCount = 0; frontier.length > 0; moveCount += 1) {
    if (frontier.some(isWaterSortCleared)) {
      return moveCount;
    }
    frontier = frontier.flatMap((state) =>
      listWaterSortDistinctTransitions(state).flatMap((transition) => {
        const destination = state[transition.move.destinationBottleIndex] ?? [];
        if (destination.length === 0 || seen.has(transition.stateKey)) {
          return [];
        }
        seen.add(transition.stateKey);
        return [transition.state];
      }),
    );
  }
  return null;
}

describe("盤面", () => {
  const releasedStates = listReachableStates(releasedState);
  const stepStates = steps.map((_, index) => playSteps(index));

  test("始めの盤面が、本番と同じ形の、3色と空のボトル2本の問題であること", () => {
    const standard = isStandardWaterSortInitialState(startState, 3, 2);

    expect(standard).toBe(true);
  });

  test("手を離す盤面が、手順の注ぎを順に進めた盤面であること", () => {
    const played = playSteps(steps.length);

    expect(releasedState).toEqual(played);
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

  test("手順の注ぎが注げて、その手順までに示したルールだけで決まること", () => {
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

  test("導入で見せるゴールに、手を離した後の盤面から、ボトルの位置どおりにたどり着けること", () => {
    const reachable = listReachableStatesInPlace(releasedState).some(
      (state) => JSON.stringify(state) === JSON.stringify(goalState),
    );

    expect(reachable).toBe(true);
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

  test("手順の注ぎ元を選んだ途中の盤面が、本番で選べる注ぎ元を選んだ盤面であること", () => {
    const rejections = steps.map((step, index) =>
      findWaterSortSourceRejection(
        stepStates[index] ?? [],
        step.move.sourceBottleIndex,
      ),
    );

    expect(rejections).toEqual(steps.map(() => null));
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

  test("手を離すまでに、すべてのルールを示すこと", () => {
    const earned = listEarnedRuleIds(steps.length - 1);

    expect(earned).toEqual(allRuleIds);
  });

  test("4つまで入ることを示すまで、手順の注ぎ元から、満杯のために注げないボトルが無いこと", () => {
    const fullTargets = steps
      .slice(0, capacityStepIndex)
      .flatMap((step, index) => {
        const bottles = stepStates[index] ?? [];
        return bottles.flatMap((_, destinationBottleIndex) => {
          if (destinationBottleIndex === step.move.sourceBottleIndex) {
            return [];
          }
          const rules = listRulesForMove(bottles, {
            sourceBottleIndex: step.move.sourceBottleIndex,
            destinationBottleIndex,
          });
          return !rules.pourable && rules.ruleIds.includes("capacity")
            ? [{ step: index + 1, destinationBottleIndex }]
            : [];
        });
      });

    expect(fullTargets).toEqual([]);
  });

  test("手を離すまで、1色もそろわないこと", () => {
    const completed = [...stepStates, releasedState].flatMap((bottles) =>
      bottles.filter(isCompleteWaterSortBottle),
    );

    expect(completed).toEqual([]);
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

  test("手を離した後、伝えたルールだけで分かる注ぎを重ねて、最短の5手でそろうこと", () => {
    const byRules = countShortestMovesByRules(releasedState, allRuleIds);
    const shortest = countShortestMovesToClear(releasedState);

    expect(byRules).toBe(5);
    expect(shortest).toBe(5);
  });

  test("手を離した後、空いたボトルへ注がなければそろえられないこと", () => {
    const shortest = countShortestMovesWithoutEmptyDestination(releasedState);

    expect(shortest).toBeNull();
  });

  test("手を離した盤面に、そろうまでの手数を減らさない注ぎがあること", () => {
    const shortest = countShortestMovesToClear(releasedState) ?? 0;
    const detours = listWaterSortLegalMoves(releasedState).filter((move) => {
      const next = applyWaterSortMove(releasedState, move);
      return (
        next !== null &&
        findWaterSortSourceRejection(releasedState, move.sourceBottleIndex) ===
          null &&
        (countShortestMovesToClear(next) ?? 0) >= shortest
      );
    });

    expect(detours.length).toBeGreaterThan(0);
  });

  describe("手を離した後に、ボトルを2本押した結果を読む場合", () => {
    /** 伝えたこと。ルールと、盤面で初めて1色そろったときに伝える、そろったボトルから注げないこと。 */
    const allKnowledge: readonly Knowledge[] = [...allRuleIds, "complete"];
    const taps = releasedStates.flatMap((bottles) =>
      listBottlePairs(bottles).map((move) => ({ bottles, move })),
    );

    test("チュートリアルの結果が、本番の判定と同じになること", () => {
      const mismatches = taps.filter(
        ({ bottles, move }) =>
          performTaps(bottles, move) !== judgeTapsInPlay(bottles, move),
      );

      expect(taps.length).toBeGreaterThan(0);
      expect(mismatches).toEqual([]);
    });

    test("伝えたことすべてから読むと、どの結果も本番の判定と同じになること", () => {
      const mismatches = taps.filter(
        ({ bottles, move }) =>
          predictTaps(bottles, move, allKnowledge) !==
          judgeTapsInPlay(bottles, move),
      );

      expect(mismatches).toEqual([]);
    });

    test.each(allKnowledge)(
      "%s を伝えなければ、結果を読み違える組があること",
      (missing) => {
        const knowledge = allKnowledge.filter((item) => item !== missing);

        const mismatches = taps.filter(
          ({ bottles, move }) =>
            predictTaps(bottles, move, knowledge) !==
            judgeTapsInPlay(bottles, move),
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
      ["where", "capacity"],
    ],
    ["違う色の上", [[0, 1], [0]], false, ["where"]],
    [
      "満杯で上が同じ色のボトル",
      [
        [0, 1],
        [0, 0, 1, 1],
      ],
      false,
      ["capacity"],
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
    test("印のボトルを注ぎ元、注ぎ先の順に押すと、注いで次の手順へ進むこと", () => {
      const next = tapSteps(progress, 1);

      expect(next.stepIndex).toBe(1);
      expect(next.boardState.bottles).toEqual(playSteps(1));
      expect(next.earnedRuleIds).toEqual(["where"]);
    });

    test("印の無いボトルを押しても、何も起きないこと", () => {
      const next = tapBottles(progress, [0, 3]);

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
        selected = tapBottles(progress, [1]);
      });

      test("印の無い注げる先を押しても、注がないこと", () => {
        const next = tapBottles(selected, [4]);

        expect(next).toBe(selected);
      });

      test("注げる先のルールを示す前に違う色の上を押しても、何も起きないこと", () => {
        const next = tapBottles(selected, [0]);

        expect(next).toBe(selected);
      });
    });

    describe("注げる先のルールを示した手順で注ぎ元を選んだ場合", () => {
      let selected: Progress;

      beforeEach(() => {
        selected = tapBottles(tapSteps(progress, 1), [2]);
      });

      test("違う色の上を押すと、本番と同じくルールに合わない手として返し、注ぎ元を選んだまま、わけを言うこと", () => {
        const next = tapBottles(selected, [0]);

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

      test("ルールに合わない手の後も、印の注ぎ先を押すと注いで次の手順へ進むこと", () => {
        const next = tapBottles(selected, [0, 1]);

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
      ["空のボトル", [2, 3], [2], "空のボトルからは注げません"],
      ["そろったボトル", [2, 3], [3], "そろったボトルからは注げません"],
      ["注げる先が無いボトル", [], [4], "このボトルは今どこにも注げません"],
      ["違う色の上", [], [1, 2], "違う色の上には注げません"],
      ["満杯のボトル", [2, 3, 1, 0], [1, 0], "いっぱいのボトルには注げません"],
    ] as const;

    describe.each(rejectionCases)(
      "本番で通らない手を打った場合: %s",
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

    test("注げない注ぎ先を押しても、注ぎ元を選んだままにすること", () => {
      const next = tapBottles(released, [1, 2]);

      expect(next.boardState.sourceBottleIndex).toBe(1);
    });

    test("選んだ注ぎ元をもう一度押すと、選び直せること", () => {
      const next = tapBottles(released, [1, 1]);

      expect(next.boardState.sourceBottleIndex).toBeNull();
      expect(next.violated).toBe(false);
    });

    test("空いたボトルへ青を集めると、そろえて解き終えること", () => {
      const next = tapBottles(released, shortestSolutionTaps);

      expect(next.phase).toBe("solved");
      expect(isWaterSortCleared(next.boardState.bottles)).toBe(true);
    });
  });
});

describe("getWaterSortTutorialStepBottleIndex", () => {
  let progress: Progress;
  let selected: Progress;

  beforeEach(() => {
    progress = startPlaying();
    selected = tapBottles(progress, [1]);
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

    expect(before).toBe(1);
    expect(after).toBe(3);
  });
});

describe("getWaterSortTutorialSpotlitBottleIndices", () => {
  describe("手を引いている場合", () => {
    let progress: Progress;
    let selected: Progress;
    let rejected: Progress;

    beforeEach(() => {
      progress = tapSteps(startPlaying(), 1);
      selected = tapBottles(progress, [2]);
      rejected = tapBottles(progress, [2, 0]);
    });

    test.each([
      ["注ぎ元を選ぶ前", () => progress],
      ["注ぎ元を選んだ後", () => selected],
      ["ルールに当たって注げなかった注ぎ先を押した後", () => rejected],
    ] as const)(
      "手順の注ぎ元と注ぎ先を、決め手として抜くこと: %s",
      (_name, getProgress) => {
        const spotlit = getWaterSortTutorialSpotlitBottleIndices(
          getTutorialSituation(waterSortTutorial, getProgress()),
        );

        expect(spotlit).toEqual([2, 1]);
      },
    );
  });

  describe("手を離した後の場合", () => {
    let released: Progress;

    beforeEach(() => {
      released = tapSteps(startPlaying(), steps.length);
    });

    test("覆いから抜かないこと", () => {
      const spotlit = getWaterSortTutorialSpotlitBottleIndices(
        getTutorialSituation(waterSortTutorial, released),
      );

      expect(spotlit).toBeNull();
    });
  });
});

describe("isWaterSortTutorialFirstCompletion", () => {
  let released: Progress;
  let completed: Progress;
  let selected: Progress;
  let rejected: Progress;
  let pouredAgain: Progress;

  beforeEach(() => {
    released = tapSteps(startPlaying(), steps.length);
    completed = tapBottles(released, [2, 3]);
    selected = tapBottles(completed, [0]);
    rejected = tapBottles(completed, [3]);
    pouredAgain = tapBottles(completed, [0, 2]);
  });

  test.each([
    ["手を離した直後", () => released, false],
    ["初めてそろえた注ぎの直後", () => completed, true],
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
  let completed: Progress;
  let selected: Progress;
  let completedAgain: Progress;

  beforeEach(() => {
    completed = tapBottles(tapSteps(startPlaying(), steps.length), [2, 3]);
    selected = tapBottles(completed, [0]);
    completedAgain = tapBottles(completed, [0, 2, 1, 2]);
  });

  test("注いでそろったボトルを、次に注ぐまで残すこと", () => {
    const completions = [completed, selected].map(
      ({ boardState }) => boardState.completion,
    );

    expect(completions).toEqual([
      { bottleIndex: 3, id: steps.length + 1, first: true },
      { bottleIndex: 3, id: steps.length + 1, first: true },
    ]);
  });

  test("次の注ぎでそろったら、そのボトルに替えること", () => {
    const { completion } = completedAgain.boardState;

    expect(completion).toEqual({
      bottleIndex: 2,
      id: steps.length + 3,
      first: false,
    });
  });
});

describe("describeWaterSortTutorialCompletion", () => {
  const released = tapSteps(startPlaying(), steps.length);
  const shortest = tapBottles(released, shortestSolutionTaps);
  const detoured = tapBottles(released, [1, 0, ...mirroredSolutionTaps]);

  test("最短の手数でそろえたら、最短でそろえたと言うこと", () => {
    const message = describeWaterSortTutorialCompletion(shortest.boardState);

    expect(shortest.phase).toBe("solved");
    expect(message).toEqual({
      headline: "完成です",
      detail: "自分で注いだ5手は最短です",
    });
  });

  test("最短より多い手数でそろえたら、自分の手数と最短の手数を言うこと", () => {
    const message = describeWaterSortTutorialCompletion(detoured.boardState);

    expect(detoured.phase).toBe("solved");
    expect(message).toEqual({
      headline: "完成です",
      detail: "自分で注いだのは6手、最短は5手です",
    });
  });
});

describe("findWaterSortTutorialHintBottleIndex", () => {
  const unsolvedStates = listReachableStates(releasedState).filter(
    (state) => !isWaterSortCleared(state),
  );

  /** 手がかりのボトルだけを押し続けたときに、そろうまでに押した数。 */
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

  test("手を離した後のどの盤面でも、注ぎ元を選んでいれば、その注ぎ元から最も早くそろう注ぎ先を示すこと", () => {
    const mismatches = unsolvedStates.flatMap((bottles) =>
      bottles.flatMap((_, sourceBottleIndex) => {
        if (findWaterSortSourceRejection(bottles, sourceBottleIndex) !== null) {
          return [];
        }
        const remainings = listWaterSortLegalMoves(bottles)
          .filter((move) => move.sourceBottleIndex === sourceBottleIndex)
          .map((move) => {
            const next = applyWaterSortMove(bottles, move);
            return {
              destinationBottleIndex: move.destinationBottleIndex,
              remaining: next ? countShortestMovesToClear(next) : null,
            };
          });
        const fewest = Math.min(
          ...remainings.flatMap(({ remaining }) =>
            remaining === null ? [] : [remaining],
          ),
        );
        const hinted = findWaterSortTutorialHintBottleIndex({
          bottles,
          sourceBottleIndex,
          lastMove: null,
          pourCount: 0,
          completion: null,
        });
        const hintedRemaining = remainings.find(
          ({ destinationBottleIndex }) => destinationBottleIndex === hinted,
        )?.remaining;
        return hintedRemaining === fewest
          ? []
          : [{ bottles, sourceBottleIndex, hinted }];
      }),
    );

    expect(mismatches).toEqual([]);
  });

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

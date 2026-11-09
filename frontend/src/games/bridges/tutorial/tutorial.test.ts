import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  _private,
  type BridgesTutorialBoardState,
  type BridgesTutorialRuleId,
  type BridgesTutorialSituation,
  bridgesTutorial,
  findBridgesTutorialHintEdge,
  getBridgesTutorialStepEdge,
  getBridgesTutorialStepReason,
} from "@/games/bridges/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const {
  board,
  solvedBridges,
  edgeBetween,
  islandAt,
  deduceEdge,
  deduceEdgeFromIsland,
  findVisibleViolations,
} = _private;

const network = getBridgesNetwork(board);

const allRuleIds = [
  "double",
  "count",
  "cross",
  "connect",
] as const satisfies readonly BridgesTutorialRuleId[];

type Progress = TutorialProgress<
  BridgesTutorialRuleId,
  BridgesTutorialBoardState
>;

function cycle(progress: Progress, edge: number): Progress {
  return performTutorialAction(bridgesTutorial, progress, {
    type: "cycle",
    edge,
  });
}

/** 最初の `count` 個の手順を、印の辺を手順の本数まで押して終える。 */
function finishSteps(count: number): Progress {
  let progress = finishTutorialIntro(startTutorial(bridgesTutorial));
  for (const step of bridgesTutorial.steps.slice(0, count)) {
    while (progress.boardState.bridges[step.edge]! < step.bridgeCount) {
      progress = cycle(progress, step.edge);
    }
  }
  return progress;
}

function listAllBridges(): BridgeCount[][] {
  return network.edges.reduce<BridgeCount[][]>(
    (partials) =>
      partials.flatMap((partial) =>
        ([0, 1, 2] as const).map((count) => [...partial, count]),
      ),
    [[]],
  );
}

/** 手順の後に、手に入れたルールで決まる辺へ決まった本数を架けていき、決まらなくなった盤面と架けた辺を返す。 */
function solveByRules(
  start: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
): { bridges: readonly BridgeCount[]; decidedEdges: number[] } {
  let bridges = start;
  const decidedEdges: number[] = [];
  for (;;) {
    const edge = bridges.findIndex(
      (_, candidate) => deduceEdge(bridges, ruleIds, candidate) !== null,
    );
    if (edge < 0) {
      return { bridges, decidedEdges };
    }
    const { minimum } = deduceEdge(bridges, ruleIds, edge)!;
    bridges = bridges.with(edge, minimum as BridgeCount);
    decidedEdges.push(edge);
  }
}

function situationOf(progress: Progress): BridgesTutorialSituation {
  return getTutorialSituation(bridgesTutorial, progress);
}

describe("bridgesTutorial の盤面", () => {
  test("ゴールの盤面は、3つのルールに合う唯一の架け方であること", () => {
    const solutions = listAllBridges().filter((bridges) =>
      isBridgesSolved(board, { bridges }),
    );

    expect(solutions).toEqual([solvedBridges]);
    expect(bridgesTutorial.goal().bridges).toEqual(solvedBridges);
  });

  test("始めの盤面には橋が無いこと", () => {
    expect(bridgesTutorial.start().bridges.every((count) => count === 0)).toBe(
      true,
    );
  });

  test("操作の手順は、同じ辺に1本、続けて2本と架け、ゴールの盤面と一致すること", () => {
    const [first, second] = bridgesTutorial.steps;

    expect(first).toMatchObject({ bridgeCount: 1, introducedRuleId: null });
    expect(second).toMatchObject({
      edge: first!.edge,
      bridgeCount: 2,
      introducedRuleId: "double",
    });
    expect(solvedBridges[second!.edge]).toBe(2);
  });

  test("ルールを伝える手順の辺は、それまでに伝えたルールで手順の本数に決まり、伝えたばかりのルールが無いと決まらないこと", () => {
    const ruleSteps = bridgesTutorial.steps
      .map((step, index) => ({ step, index }))
      .filter(({ index }) => index >= 2);

    for (const { step, index } of ruleSteps) {
      const { boardState, earnedRuleIds } = finishSteps(index);
      const withoutNewRule = earnedRuleIds.filter(
        (ruleId) => ruleId !== step.introducedRuleId,
      );

      expect(earnedRuleIds).toContain(step.introducedRuleId);
      expect(step.island).not.toBeNull();
      expect(
        deduceEdgeFromIsland(
          boardState.bridges,
          earnedRuleIds,
          step.island!,
          step.edge,
        )?.minimum,
      ).toBe(step.bridgeCount);
      expect(
        deduceEdge(boardState.bridges, withoutNewRule, step.edge),
      ).toBeNull();
      expect(solvedBridges[step.edge]).toBe(step.bridgeCount);
    }
  });

  test("2本までのルールは、交差の手順で、2本架かった橋を決め手にして手を決めること", () => {
    const crossIndex = bridgesTutorial.steps.findIndex(
      (step) => step.introducedRuleId === "cross",
    );
    const crossStep = bridgesTutorial.steps[crossIndex]!;
    const { boardState, earnedRuleIds } = finishSteps(crossIndex);

    expect(
      deduceEdge(
        boardState.bridges,
        earnedRuleIds.filter((ruleId) => ruleId !== "double"),
        crossStep.edge,
      ),
    ).toBeNull();
  });

  test("どのルールも、それを伝える手順で初めて伝えること", () => {
    const introduced = bridgesTutorial.steps.flatMap(({ introducedRuleId }) =>
      introducedRuleId === null ? [] : [introducedRuleId],
    );

    expect(introduced).toEqual(allRuleIds);
    expect(bridgesTutorial.rules.map(({ id }) => id)).toEqual(allRuleIds);
  });

  test("印の辺を押していく途中の盤面も、どのルールにも反しないこと", () => {
    let progress = finishTutorialIntro(startTutorial(bridgesTutorial));
    for (const step of bridgesTutorial.steps) {
      while (progress.boardState.bridges[step.edge]! < step.bridgeCount) {
        progress = cycle(progress, step.edge);
        const violations = findVisibleViolations(
          progress.boardState.bridges,
          allRuleIds,
        );

        expect(violations).toEqual({ overIslands: [], closedGroups: [] });
        expect(progress.violated).toBe(false);
      }
    }
  });

  test("手順を終えると橋が残り、4つのルールで決まる辺を順に架けて解き切れること", () => {
    const { boardState } = finishSteps(bridgesTutorial.steps.length);
    const { bridges, decidedEdges } = solveByRules(
      boardState.bridges,
      allRuleIds,
    );

    expect(decidedEdges.length).toBeGreaterThan(0);
    expect(bridges).toEqual(solvedBridges);
  });
});

describe("bridgesTutorial.perform", () => {
  test("導入の間は、操作を受け付けないこと", () => {
    const progress = startTutorial(bridgesTutorial);

    expect(cycle(progress, bridgesTutorial.steps[0]!.edge)).toBe(progress);
  });

  test("手を引いている間は、印の無い辺への操作で盤面を変えないこと", () => {
    const progress = finishTutorialIntro(startTutorial(bridgesTutorial));
    const otherEdge = network.edges.findIndex(
      (_, edge) => edge !== bridgesTutorial.steps[0]!.edge,
    );

    expect(cycle(progress, otherEdge)).toBe(progress);
  });

  test("1つ目の手順の辺を押すと1本架かり、次の手順へ進んで2本までのルールを手に入れること", () => {
    const progress = cycle(
      finishTutorialIntro(startTutorial(bridgesTutorial)),
      bridgesTutorial.steps[0]!.edge,
    );

    expect(progress.stepIndex).toBe(1);
    expect(progress.boardState.bridges[bridgesTutorial.steps[0]!.edge]).toBe(1);
    expect(progress.boardState.lastMove).toEqual({
      kind: "changed",
      edge: bridgesTutorial.steps[0]!.edge,
      fitsStep: true,
    });
    expect(progress.earnedRuleIds).toEqual(["double"]);
  });

  test("2本架ける手順は、1本目では進まず、2本目で進むこと", () => {
    const countStep = bridgesTutorial.steps[2]!;
    const progress = cycle(finishSteps(2), countStep.edge);

    expect(progress.stepIndex).toBe(2);
    expect(progress.boardState.lastMove).toMatchObject({ fitsStep: false });
    expect(
      getBridgesTutorialStepEdge(situationOf(progress), progress.boardState),
    ).toBe(countStep.edge);

    const stepped = cycle(progress, countStep.edge);

    expect(stepped.stepIndex).toBe(3);
  });

  test("手順の本数まで架けた辺を、手順を終える前にもう一度押しても外さないこと", () => {
    const progress = finishSteps(1);

    expect(
      cycle(progress, bridgesTutorial.steps[0]!.edge).boardState.bridges,
    ).toEqual(
      progress.boardState.bridges.with(bridgesTutorial.steps[0]!.edge, 2),
    );
  });

  describe("手順を終えた後", () => {
    const freed = finishSteps(bridgesTutorial.steps.length);

    test("手を離し、どの辺も押せること", () => {
      expect(situationOf(freed).step).toBeNull();
      expect(freed.earnedRuleIds).toEqual(allRuleIds);
      expect(
        getTutorialMessage(bridgesTutorial, freed, {
          entry: "home",
          violationSettled: true,
        }),
      ).toBe(bridgesTutorial.freePlay);
    });

    test("交わる橋に阻まれた手は、盤面を変えず、阻んだ橋を添えてルールに合わない手とすること", () => {
      const blockedEdge = edgeBetween([3, 1], [3, 5]);
      const progress = cycle(freed, blockedEdge);

      expect(progress.violated).toBe(true);
      expect(progress.boardState.bridges).toEqual(freed.boardState.bridges);
      expect(progress.boardState.lastMove).toEqual({
        kind: "blocked",
        edge: blockedEdge,
        crossingEdges: [edgeBetween([1, 3], [4, 3])],
      });
      expect(
        bridgesTutorial.describeViolation(
          situationOf(progress),
          progress.boardState,
        ).headline,
      ).toBe("橋どうしは\n交差できません");
    });

    test("数字より多く橋を出した手は、ルールに合わない手とすること", () => {
      const progress = cycle(freed, edgeBetween([1, 1], [3, 1]));

      expect(progress.violated).toBe(true);
      expect(
        listBridgesIslandStatuses(board, progress.boardState).includes("over"),
      ).toBe(true);
      expect(
        bridgesTutorial.describeViolation(
          situationOf(progress),
          progress.boardState,
        ).headline,
      ).toBe("橋が数字より\n多く出ています");
    });

    test("ほかの島とつながれない島の組を作った手は、ルールに合わない手とすること", () => {
      const beforeClosing: Progress = {
        ...freed,
        boardState: {
          ...freed.boardState,
          bridges: freed.boardState.bridges.with(
            edgeBetween([1, 1], [3, 1]),
            0,
          ),
        },
      };
      const progress = cycle(beforeClosing, edgeBetween([3, 1], [5, 1]));

      expect(progress.violated).toBe(true);
      expect(
        bridgesTutorial.describeViolation(
          situationOf(progress),
          progress.boardState,
        ).headline,
      ).toBe("ほかの島と\nつながれない島ができています");
    });

    test("残りを解のとおりに架けると解けること", () => {
      const remaining = network.edges.flatMap((_, edge) =>
        Array.from(
          {
            length: solvedBridges[edge]! - freed.boardState.bridges[edge]!,
          },
          () => edge,
        ),
      );
      const solved = remaining.reduce(cycle, freed);

      expect(solved.phase).toBe("solved");
      expect(
        getTutorialMessage(bridgesTutorial, solved, {
          entry: "play",
          violationSettled: true,
        }),
      ).toBe(bridgesTutorial.completion.play);
    });

    test("手が止まったときに示す辺は、4つのルールで橋が要ると決まる辺であること", () => {
      const edge = findBridgesTutorialHintEdge(
        situationOf(freed),
        freed.boardState,
      );

      expect(edge).not.toBeNull();
      expect(
        deduceEdge(freed.boardState.bridges, allRuleIds, edge!),
      ).not.toBeNull();
    });

    test("解と違う橋のせいでルールで決まる辺が無いときは、その橋の辺を示すこと", () => {
      const mistakenEdge = edgeBetween([3, 1], [5, 1]);
      const bridges = solvedBridges
        .with(edgeBetween([1, 1], [3, 1]), 0)
        .with(edgeBetween([5, 1], [5, 5]), 0)
        .with(mistakenEdge, 1);
      const state = { ...freed.boardState, bridges };

      expect(findBridgesTutorialHintEdge(situationOf(freed), state)).toBe(
        mistakenEdge,
      );
    });
  });
});

describe("手順の決め手", () => {
  test("数字の手順は、右下の3と左の1を決め手にすること", () => {
    const progress = finishSteps(2);

    expect(
      getBridgesTutorialStepReason(situationOf(progress), progress.boardState),
    ).toEqual({ islands: [islandAt(5, 5), islandAt(5, 1)], edges: [] });
  });

  test("交差の手順は、右の3と、左へ架けられない辺とそこに交わる真ん中の縦の橋と、2本架かった下の橋を決め手にすること", () => {
    const progress = finishSteps(3);
    const reason = getBridgesTutorialStepReason(
      situationOf(progress),
      progress.boardState,
    );

    expect(reason).toEqual({
      islands: [islandAt(3, 5)],
      edges: expect.arrayContaining([
        edgeBetween([3, 1], [3, 5]),
        edgeBetween([1, 3], [4, 3]),
        edgeBetween([3, 5], [5, 5]),
      ]),
    });
    expect(reason.edges).toHaveLength(3);
  });

  test("つながりの手順は、左の真ん中の1と、数字とちょうどの右の3と、つなぐと閉じる下の1を決め手にすること", () => {
    const progress = finishSteps(4);
    const reason = getBridgesTutorialStepReason(
      situationOf(progress),
      progress.boardState,
    );

    expect(reason).toEqual({
      islands: [islandAt(3, 1), islandAt(3, 5), islandAt(5, 1)],
      edges: [],
    });
  });

  test("操作を教える手順には決め手が無いこと", () => {
    const progress = finishSteps(0);

    expect(
      getBridgesTutorialStepReason(situationOf(progress), progress.boardState),
    ).toEqual({ islands: [], edges: [] });
  });
});

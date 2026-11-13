import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  countBridgesSeparatedIslandGroups,
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  _private,
  BRIDGES_TUTORIAL_PROGRESS_STEP_COUNT,
  type BridgesTutorialBoardState,
  type BridgesTutorialRuleId,
  type BridgesTutorialSituation,
  type BridgesTutorialStep,
  bridgesTutorial,
  describeBridgesTutorialHint,
  describeBridgesTutorialOffStep,
  describeBridgesTutorialStep,
  findBridgesTutorialFix,
  findBridgesTutorialHint,
  getBridgesTutorialProgressRatio,
  getBridgesTutorialStepEdges,
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

const { board, solvedBridges, steps, edgeBetween, islandAt, listDeductions } =
  _private;

const network = getBridgesNetwork(board);

const allRuleIds = [
  "count",
  "double",
  "cross",
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

/** 手順の辺を、前から順に手順の本数まで押す。押すたびに `onPress` を呼ぶ。 */
function finishStep(
  start: Progress,
  step: BridgesTutorialStep,
  onPress: (progress: Progress) => void = () => {},
): Progress {
  let progress = start;
  for (const { edge, count } of step.targets) {
    while (progress.boardState.bridges[edge]! < count) {
      progress = cycle(progress, edge);
      onPress(progress);
    }
  }
  return progress;
}

function finishSteps(count: number): Progress {
  let progress = finishTutorialIntro(startTutorial(bridgesTutorial));
  for (const step of steps.slice(0, count)) {
    progress = finishStep(progress, step);
  }
  return progress;
}

/** `index` 番目の手順を始めた時点の盤面と手に入れたルール。 */
function getStepStart(index: number): {
  bridges: readonly BridgeCount[];
  earnedRuleIds: readonly BridgesTutorialRuleId[];
} {
  const progress = finishSteps(index);
  return {
    bridges: progress.boardState.bridges,
    earnedRuleIds: progress.earnedRuleIds,
  };
}

function situationOf(progress: Progress): BridgesTutorialSituation {
  return getTutorialSituation(bridgesTutorial, progress);
}

function messageOf(progress: Progress) {
  return getTutorialMessage(bridgesTutorial, progress, {
    entry: "home",
    violationSettled: true,
  });
}

/** 島 `island` から決まる、辺ごとの少なくとも要る本数。 */
function deduceTargets(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
  island: number,
): Map<number, { minimum: number; read: string }> {
  return new Map(
    listDeductions(bridges, ruleIds)
      .filter((deduction) => deduction.island === island)
      .map(({ edge, minimum, read }) => [edge, { minimum, read }]),
  );
}

function isStepDecided(
  step: BridgesTutorialStep,
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
): boolean {
  const deduced = deduceTargets(bridges, ruleIds, step.island!);
  return step.targets.every(
    ({ edge, count }) => (deduced.get(edge)?.minimum ?? 0) >= count,
  );
}

const finishedSteps = finishSteps(steps.length);

/**
 * 手を離した後の盤面から、伝えたルールで決まる手を、行き先が1つしかない島から先に打って解き切る。使った読みを返す。
 * 決まる手が無くなれば `null`。
 */
function solveByDeductions(start: readonly BridgeCount[]): string[] | null {
  let bridges = start;
  const reads: string[] = [];
  while (!isBridgesSolved(board, { bridges })) {
    const deductions = listDeductions(bridges, allRuleIds);
    const deduction =
      deductions.find(({ read }) => read === "single") ?? deductions[0];
    if (!deduction || deduction.minimum > solvedBridges[deduction.edge]!) {
      return null;
    }
    reads.push(deduction.read);
    bridges = bridges.with(deduction.edge, deduction.minimum as BridgeCount);
  }
  return reads;
}

describe("bridgesTutorial の盤面", () => {
  test("ゴールの盤面は、本番の判定で解けた唯一の架け方であり、つながりを除いても唯一であること", () => {
    for (const ignoresConnectivity of [false, true]) {
      const result = countBridgesSolutions(board, {
        limit: 2,
        nodeLimit: 1_000_000,
        ignoresConnectivity,
      });
      expect(result.solutionCount).toBe(1);
      expect(result.firstSolution).toEqual(solvedBridges);
    }
    expect(isBridgesSolved(board, { bridges: solvedBridges })).toBe(true);
  });

  test("全部の島が数字とちょうどで交わらない架け方は解だけなので、本番が知らせる、島が分かれた盤面にならないこと", () => {
    const result = countBridgesSolutions(board, {
      limit: 2,
      nodeLimit: 1_000_000,
      ignoresConnectivity: true,
    });
    expect(result.solutionCount).toBe(1);
    const bridges = result.firstSolution as readonly BridgeCount[];
    expect(
      countBridgesSeparatedIslandGroups(
        board,
        { bridges },
        listBridgesIslandStatuses(board, { bridges }),
      ),
    ).toBeNull();
  });

  test("始めの盤面には橋が無いこと", () => {
    expect(bridgesTutorial.start().bridges.every((count) => count === 0)).toBe(
      true,
    );
  });

  test("最初の手順は操作を教え、架けた本数はゴールの盤面と一致すること", () => {
    const [first] = steps;
    expect(first!.introducedRuleId).toBeNull();
    expect(first!.island).toBeNull();
    expect(first!.pointed).toBe(true);
    for (const { edge, count } of first!.targets) {
      expect(count).toBe(solvedBridges[edge]);
    }
  });

  test("どの手順の本数も、ゴールの盤面の本数を超えないこと", () => {
    for (const step of steps) {
      for (const { edge, count } of step.targets) {
        expect(count).toBeLessThanOrEqual(solvedBridges[edge]!);
      }
    }
  });

  test("ルールを伝える手順の本数は、それまでに伝えたルールで決まり、伝えたばかりのルールが無いと決まらないこと", () => {
    for (const [index, step] of steps.entries()) {
      if (step.introducedRuleId === null) {
        continue;
      }
      const { bridges, earnedRuleIds } = getStepStart(index);
      expect(earnedRuleIds).toContain(step.introducedRuleId);
      expect(isStepDecided(step, bridges, earnedRuleIds)).toBe(true);
      expect(
        isStepDecided(
          step,
          bridges,
          earnedRuleIds.filter((ruleId) => ruleId !== step.introducedRuleId),
        ),
      ).toBe(false);
    }
  });

  test("最後の手順は、ほかの行き先だけでは足りない分を架ける読みで、2つ以上の辺に決まること", () => {
    const index = steps.length - 1;
    const step = steps[index]!;
    const { bridges, earnedRuleIds } = getStepStart(index);
    expect(earnedRuleIds).toEqual(expect.arrayContaining([...allRuleIds]));
    expect(step.targets.length).toBeGreaterThanOrEqual(2);
    const deduced = deduceTargets(bridges, earnedRuleIds, step.island!);
    for (const { edge, count } of step.targets) {
      expect(deduced.get(edge)).toEqual({ minimum: count, read: "shortfall" });
    }
  });

  test("3つのルールと読みが、それぞれ1つ以上の手の決め手になること", () => {
    const introduced = steps.flatMap((step) =>
      step.introducedRuleId === null ? [] : [step.introducedRuleId],
    );
    expect([...introduced].sort()).toEqual([...allRuleIds].sort());
    expect(steps.at(-1)!.introducedRuleId).toBeNull();
    expect(steps.at(-1)!.island).not.toBeNull();
  });

  test("ルールと読みの手順は印を付けず、決め手の島から架けられる行き先が2つ以上あって、どこへ架けるかを自分で選ぶこと", () => {
    for (const [index, step] of steps.entries()) {
      if (step.island === null) {
        continue;
      }
      expect(step.pointed).toBe(false);
      const { bridges } = getStepStart(index);
      const choices = network.islandEdges[step.island]!.filter(
        (edge) => bridges[edge]! < 2,
      );
      expect(choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("印の無い手順の、手順に無い手への一言は、その手順の一言と違い、押しても黙らないこと", () => {
    const unpointed = steps.filter((step) => !step.pointed);

    for (const step of unpointed) {
      expect(step.offStepMessage).not.toEqual(step.message);
    }
  });

  test("交差のルールを伝える前の手順は阻まれた手を違反としないので、阻まれたときの一言を持たないこと", () => {
    const beforeCross = steps.slice(
      0,
      steps.findIndex((step) => step.introducedRuleId === "cross"),
    );

    for (const step of beforeCross) {
      expect(step.blockedDetail).toBeNull();
    }
  });

  test("手順の辺を押していく途中の盤面は、数字より多い島も交わる橋も無く、ゴールの盤面に含まれること", () => {
    let progress = finishTutorialIntro(startTutorial(bridgesTutorial));
    for (const step of steps) {
      progress = finishStep(progress, step, (pressed) => {
        const { bridges } = pressed.boardState;
        expect(
          listBridgesIslandStatuses(board, { bridges }).includes("over"),
        ).toBe(false);
        expect(
          bridges.every((count, edge) => count <= solvedBridges[edge]!),
        ).toBe(true);
        expect(pressed.violated).toBe(false);
      });
    }
    expect(progress.stepIndex).toBe(steps.length);
    expect(progress.phase).toBe("playing");
  });

  test("手を離した後は、伝えたルールで決まる手だけで解き切れ、足りない分を架ける読みがもう一度要ること", () => {
    const reads = solveByDeductions(finishedSteps.boardState.bridges);

    expect(reads).toContain("shortfall");
  });

  test("押して橋になるのは、縦か横にまっすぐ並び、間に島の無い2島の間だけであること", () => {
    for (const { from, to, orientation } of network.edges) {
      const a = board.islands[from]!;
      const b = board.islands[to]!;
      if (orientation === "horizontal") {
        expect(a.row).toBe(b.row);
      } else {
        expect(a.column).toBe(b.column);
      }
    }
  });
});

describe("bridgesTutorial.perform", () => {
  test("導入の間は、操作を受け付けないこと", () => {
    const progress = startTutorial(bridgesTutorial);
    expect(cycle(progress, steps[0]!.targets[0]!.edge)).toBe(progress);
  });

  test("手を引いている間は、手順に無い辺への操作で盤面を変えないこと", () => {
    const progress = finishSteps(1);
    expect(cycle(progress, edgeBetween([1, 1], [1, 3]))).toBe(progress);
  });

  test("手順の本数まで架けた辺を、手順を終える前にもう一度押しても外さないこと", () => {
    const progress = cycle(
      cycle(finishSteps(2), edgeBetween([1, 1], [1, 3])),
      edgeBetween([1, 1], [1, 3]),
    );
    expect(progress.stepIndex).toBe(2);
    expect(cycle(progress, edgeBetween([1, 1], [1, 3]))).toBe(progress);
  });

  test("最初の手順の辺を押すと1本架かり、次の手順へ進んで数字と同じ本数のルールを手に入れること", () => {
    const progress = cycle(finishSteps(0), steps[0]!.targets[0]!.edge);
    expect(progress.stepIndex).toBe(1);
    expect(progress.earnedRuleIds).toEqual(["count"]);
    expect(progress.boardState.lastMove).toMatchObject({ fitsStep: true });
  });

  test("2本架ける手順は、1本目では途中の一言に替わって進まず、2本目で進むこと", () => {
    const step = steps[1]!;
    const edge = step.targets[0]!.edge;
    const midway = cycle(finishSteps(1), edge);
    expect(midway.stepIndex).toBe(1);
    expect(describeBridgesTutorialStep(step, midway.boardState)).toBe(
      step.midwayMessage,
    );
    const done = cycle(midway, edge);
    expect(done.stepIndex).toBe(2);
  });

  test("交差の手順で阻まれる辺を押すと、盤面を変えずに阻んだ橋を残し、交差の一言と今の手順で何をするかを返すこと", () => {
    const progress = finishSteps(3);
    const blockedEdge = edgeBetween([3, 1], [3, 6]);
    const blocked = cycle(progress, blockedEdge);
    expect(blocked.boardState.bridges).toEqual(progress.boardState.bridges);
    expect(blocked.boardState.lastMove).toEqual({
      kind: "blocked",
      edge: blockedEdge,
      crossingEdges: [edgeBetween([2, 5], [4, 5])],
    });
    expect(blocked.violated).toBe(true);
    expect(messageOf(blocked)).toEqual({
      headline: "ここに架けるとほかの橋と交差します",
      detail: steps[3]!.blockedDetail,
    });
    expect(blocked.stepIndex).toBe(3);
  });

  describe("手順を終えた後", () => {
    test("手を離し、本番と同じく辺を 1本 → 2本 → なし と回すこと", () => {
      const edge = edgeBetween([1, 3], [1, 6]);
      const once = cycle(finishedSteps, edge);
      expect(once.boardState.bridges[edge]).toBe(1);
      expect(once.violated).toBe(false);
      expect(messageOf(once)).toBe(bridgesTutorial.freePlay);
    });

    test("数字より多い島ができた手は、ルールに合わない手として、多い島と直し方を言い、その辺を直す辺にすること", () => {
      const edge = edgeBetween([1, 3], [1, 6]);
      const over = cycle(cycle(finishedSteps, edge), edge);
      expect(over.violated).toBe(true);
      expect(findBridgesTutorialFix(over.boardState)).toEqual({
        edge,
        count: 1,
        tapCount: 2,
      });
      expect(messageOf(over)).toEqual({
        headline: "1の島から橋が\n数字より多く出ています",
        detail: "あと2回タップで1本に戻ります",
      });
    });

    test("最後の橋を架けると解けること", () => {
      let progress = finishedSteps;
      for (;;) {
        const hint = findBridgesTutorialHint(
          situationOf(progress),
          progress.boardState,
        );
        if (hint === null) {
          break;
        }
        progress = cycle(progress, hint.edge);
        expect(progress.violated).toBe(false);
      }
      expect(progress.phase).toBe("solved");
      expect(getBridgesTutorialProgressRatio(progress.boardState)).toBe(1);
    });
  });
});

describe("手順の決め手と印", () => {
  test("操作を教える手順には決め手が無く、印を付けた辺だけを押させること", () => {
    const progress = finishSteps(0);
    expect(
      getBridgesTutorialStepReason(situationOf(progress), progress.boardState),
    ).toBeNull();
    expect(
      getBridgesTutorialStepEdges(situationOf(progress), progress.boardState),
    ).toEqual([edgeBetween([2, 5], [4, 5])]);
  });

  test("数字の手順は、下の3と、その行き先の上の1と左の6を決め手にし、印を付けないこと", () => {
    const progress = finishSteps(1);
    const reason = getBridgesTutorialStepReason(
      situationOf(progress),
      progress.boardState,
    );
    expect(reason?.islands).toEqual(
      expect.arrayContaining([islandAt(4, 5), islandAt(2, 5), islandAt(4, 3)]),
    );
    expect(
      getBridgesTutorialStepEdges(situationOf(progress), progress.boardState),
    ).toEqual([]);
  });

  test("交差の手順は、右へ阻む縦の橋を決め手にすること", () => {
    const progress = finishSteps(3);
    const reason = getBridgesTutorialStepReason(
      situationOf(progress),
      progress.boardState,
    );
    expect(reason?.edges).toContain(edgeBetween([2, 5], [4, 5]));
    expect(reason?.islands).toContain(islandAt(3, 1));
  });
});

describe("手がかり", () => {
  test("手を離した直後は、上の5が足りない分を架ける読みで決まる辺か、行き先が1つの島の辺を示すこと", () => {
    const hint = findBridgesTutorialHint(
      situationOf(finishedSteps),
      finishedSteps.boardState,
    );
    expect(hint).not.toBeNull();
    expect(hint!.read).not.toBe("mistake");
    expect(finishedSteps.boardState.bridges[hint!.edge]!).toBeLessThan(
      solvedBridges[hint!.edge]!,
    );
    expect(describeBridgesTutorialHint(hint!).headline).toMatch(/の島/);
  });
});

describe("解と違う橋を架けた盤面の場合", () => {
  const mistakenEdge = edgeBetween([6, 1], [6, 3]);
  const state: BridgesTutorialBoardState = {
    bridges: solvedBridges
      .with(edgeBetween([3, 1], [6, 1]), 0)
      .with(edgeBetween([6, 3], [6, 6]), 0)
      .with(mistakenEdge, 1),
    moveCount: 0,
    lastMove: null,
  };
  const situation: BridgesTutorialSituation = {
    step: null,
    earnedRuleIds: allRuleIds,
  };

  test("findBridgesTutorialHint は、その橋の辺を、外すまでに押す回数と一緒に示すこと", () => {
    const hint = findBridgesTutorialHint(situation, state);

    expect(hint).toEqual({
      edge: mistakenEdge,
      read: "mistake",
      island: null,
      reason: null,
      count: 0,
      tapCount: 2,
    });
    expect(describeBridgesTutorialHint(hint!)).toEqual({
      headline: "この橋を外すと\n続きが解けます",
      detail: "あと2回タップで外れます",
    });
  });

  test("findBridgesTutorialHint は、ルールで決まる辺がまだあっても、先にその橋を示すこと", () => {
    const early = cycle(finishedSteps, edgeBetween([1, 6], [3, 6]));

    const hint = findBridgesTutorialHint(situationOf(early), early.boardState);

    expect(hint?.edge).toBe(edgeBetween([1, 6], [3, 6]));
    expect(hint?.read).toBe("mistake");
  });

  test("findBridgesTutorialFix は、解と違う橋を数字より多くしたとき、手の前の本数ではなく外す回数を返すこと", () => {
    const over = cycle(
      cycle(finishedSteps, edgeBetween([1, 6], [3, 6])),
      edgeBetween([1, 6], [3, 6]),
    );

    const fix = findBridgesTutorialFix(over.boardState);

    expect(fix).toEqual({
      edge: edgeBetween([1, 6], [3, 6]),
      count: 0,
      tapCount: 1,
    });
  });
});

describe("describeBridgesTutorialOffStep", () => {
  const doubleStep = steps[2]!;
  const finishedEdge = doubleStep.targets[0]!.edge;
  const state = finishSteps(2).boardState;
  const doubled: BridgesTutorialBoardState = {
    ...state,
    bridges: state.bridges.with(finishedEdge, 2),
  };

  test("2本まで架け終えた手順の辺を押したときは、2本までのルールで返すこと", () => {
    const message = describeBridgesTutorialOffStep(
      doubleStep,
      doubled,
      finishedEdge,
    );

    expect(message.headline).toBe("島と島の間には\n橋を2本まで架けられます");
  });

  test("手順に無い辺を押したときは、今の手順で何をするかを返すこと", () => {
    const message = describeBridgesTutorialOffStep(
      doubleStep,
      doubled,
      edgeBetween([2, 5], [4, 5]),
    );

    expect(message).toBe(doubleStep.offStepMessage);
  });
});

describe("進み具合", () => {
  test("始めは0、ゴールの盤面で1になり、段の数は解の橋の本数であること", () => {
    expect(getBridgesTutorialProgressRatio(bridgesTutorial.start())).toBe(0);
    expect(getBridgesTutorialProgressRatio(bridgesTutorial.goal())).toBe(1);
    expect(BRIDGES_TUTORIAL_PROGRESS_STEP_COUNT).toBe(
      solvedBridges.reduce<number>((total, count) => total + count, 0),
    );
  });
});

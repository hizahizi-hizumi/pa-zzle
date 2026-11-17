import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  findBridgesClosedGroups,
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import { cycleBridgesEdge } from "@/games/bridges/puzzle/transitions";
import {
  type BridgesExampleBoard,
  type BridgesExampleCycle,
  createBridgesExampleBoard,
  cycleBridgesExampleEdge,
  findBridgesExampleHint,
  isBridgesExampleChanged,
  judgeBridgesExampleConnection,
  judgeBridgesExampleCount,
  judgeBridgesExampleCrossing,
  listBridgesExampleCandidates,
  missBridgesExamplePress,
  selectBridgesExampleIsland,
  showBridgesExampleCandidates,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";
import {
  type BridgesHowToPlayExample,
  backwardCycleOperationExample,
  connectionRuleExamples,
  countRuleExamples,
  crossingOperationExample,
  crossingRuleExample,
  cycleOperationExample,
  dragOperationExample,
  pairOperationExample,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";

function press(
  example: BridgesExampleBoard,
  edge: number,
  gesture: BridgesExampleCycle["gesture"] = "edge",
): BridgesExampleBoard {
  return cycleBridgesExampleEdge(example, {
    edge,
    gesture,
    direction: "forward",
  });
}

function pressBackward(
  example: BridgesExampleBoard,
  edge: number,
): BridgesExampleBoard {
  return cycleBridgesExampleEdge(example, {
    edge,
    gesture: "edge",
    direction: "backward",
  });
}

/** 例の盤面の、2島の間の辺。 */
function edgeOf(
  definition: BridgesHowToPlayExample,
  from: number,
  to: number,
): number {
  return getBridgesNetwork(definition.board).edges.findIndex(
    (edge) =>
      (edge.from === from && edge.to === to) ||
      (edge.from === to && edge.to === from),
  );
}

describe("数字と同じ本数のルールの例の場合", () => {
  const [allowed, disallowed] = countRuleExamples;
  const allowedStart = createBridgesExampleBoard(allowed);
  const disallowedStart = createBridgesExampleBoard(disallowed);
  const overEdge = disallowed.bridges.indexOf(2);
  const shortEdge = disallowed.bridges.indexOf(1);

  test("できる形は、本番の判定で完成した盤面であること", () => {
    const solved = isBridgesSolved(allowed.board, allowed);

    expect(solved).toBe(true);
  });

  test("できる形は ✓ ちょうど と判定すること", () => {
    const verdict = judgeBridgesExampleCount(allowedStart);

    expect(verdict).toBe("allowed");
  });

  test("できない形は、足りない・ちょうど・多すぎの島が1つずつあること", () => {
    const statuses = listBridgesIslandStatuses(disallowed.board, disallowed);

    expect([...statuses].sort()).toEqual(["exact", "over", "short"]);
  });

  test("できない形は ✕ 多すぎ と判定すること", () => {
    const verdict = judgeBridgesExampleCount(disallowedStart);

    expect(verdict).toBe("disallowed");
  });

  test("できない形の多すぎの橋を外すと、多すぎの島が無くなって途中になること", () => {
    const removed = press(disallowedStart, overEdge);
    const verdict = judgeBridgesExampleCount(removed);

    expect(verdict).toBe("incomplete");
  });

  test("できない形から本番の遷移で完成させると ✓ ちょうど になること", () => {
    const completed = press(
      press(press(disallowedStart, overEdge), overEdge),
      shortEdge,
    );
    const solved = isBridgesSolved(disallowed.board, completed);
    const verdict = judgeBridgesExampleCount(completed);

    expect(solved).toBe(true);
    expect(verdict).toBe("allowed");
  });
});

describe("全部の島をつなげるルールの例の場合", () => {
  const [allowed, disallowed] = connectionRuleExamples;
  const allowedStart = createBridgesExampleBoard(allowed);
  const disallowedStart = createBridgesExampleBoard(disallowed);
  const top = edgeOf(disallowed, 0, 1);
  const bottom = edgeOf(disallowed, 2, 3);
  const left = edgeOf(disallowed, 0, 2);

  test("できる形は、本番の判定で完成した盤面であること", () => {
    const solved = isBridgesSolved(allowed.board, allowed);

    expect(solved).toBe(true);
  });

  test("できる形は ✓ と判定すること", () => {
    const judgement = judgeBridgesExampleConnection(allowedStart);

    expect(judgement).toEqual({ verdict: "allowed", overIslands: false });
  });

  test("できない形は、どの島もちょうどで、2島ずつの閉じた組が2つあること", () => {
    const statuses = listBridgesIslandStatuses(disallowed.board, disallowed);
    const groups = findBridgesClosedGroups(disallowed.board, disallowed);

    expect(statuses.every((status) => status === "exact")).toBe(true);
    expect(groups.map((group) => group.length)).toEqual([2, 2]);
  });

  test("できない形は ✕ と判定し、別のルールのわけを添えないこと", () => {
    const judgement = judgeBridgesExampleConnection(disallowedStart);

    expect(judgement).toEqual({ verdict: "disallowed", overIslands: false });
  });

  test("できない形で上の2本を外しても、下の2島が閉じたままなので ✕ のままであること", () => {
    const removed = press(disallowedStart, top);
    const judgement = judgeBridgesExampleConnection(removed);

    expect(judgement).toEqual({ verdict: "disallowed", overIslands: false });
  });

  test("できない形で上と下の2本を外すと、閉じた組が無くなって途中になること", () => {
    const removed = press(press(disallowedStart, top), bottom);
    const judgement = judgeBridgesExampleConnection(removed);

    expect(judgement).toEqual({ verdict: "incomplete", overIslands: false });
  });

  test("できない形で左に架けると、多すぎの島ができて ✕ に数字のわけを添えること", () => {
    const placed = press(disallowedStart, left);
    const judgement = judgeBridgesExampleConnection(placed);

    expect(judgement).toEqual({ verdict: "disallowed", overIslands: true });
  });
});

describe("交差のルールの例の場合", () => {
  const example = createBridgesExampleBoard(crossingRuleExample);
  const blockedEdge = crossingRuleExample.hints[0] as {
    kind: "edge";
    edge: number;
  };
  const markedIsland = crossingRuleExample.markedIsland;
  const allowedEdge = listBridgesExampleCandidates(example).find(
    ({ allowed }) => allowed,
  )!.edge;
  const blocking = crossingRuleExample.bridges.indexOf(1);
  const shown = showBridgesExampleCandidates(example);

  test("手がかりの線は、本番の遷移で阻まれること", () => {
    const change = cycleBridgesEdge(
      crossingRuleExample.board,
      crossingRuleExample,
      blockedEdge.edge,
    );

    expect(change.kind).toBe("blocked");
  });

  test("印を付ける島から出る2本の線に、架けられる ✓ と阻まれる ✕ を付けること", () => {
    const candidates = listBridgesExampleCandidates(example);

    expect(candidates).toHaveLength(2);
    expect(candidates).toContainEqual({
      edge: blockedEdge.edge,
      island: markedIsland,
      allowed: false,
    });
    expect(candidates.filter(({ allowed }) => allowed)).toHaveLength(1);
  });

  test("触る前は、手がかりを阻まれる線に付けること", () => {
    const hint = findBridgesExampleHint(example);

    expect(hint).toEqual(blockedEdge);
  });

  test("触る前は、凡例を出すこと", () => {
    const caption = judgeBridgesExampleCrossing(example);

    expect(caption).toEqual({ kind: "legend", overIslands: false });
  });

  test("手がかりの線を押すと、橋を変えずに阻まれ、手がかりを消すこと", () => {
    const blocked = press(example, blockedEdge.edge);
    const hint = findBridgesExampleHint(blocked);
    const caption = judgeBridgesExampleCrossing(blocked);
    const changed = isBridgesExampleChanged(blocked);

    expect(blocked.bridges).toEqual(crossingRuleExample.bridges);
    expect(blocked.edgeNotice).toMatchObject({
      change: "blocked",
      edge: blockedEdge.edge,
    });
    expect(hint).toBeNull();
    expect(caption.kind).toBe("blocked");
    expect(changed).toBe(false);
  });

  test("✓ の線に架けると、架けられたと言い、まだ多すぎの島が無いこと", () => {
    const placed = press(example, allowedEdge);
    const caption = judgeBridgesExampleCrossing(placed);
    const candidates = listBridgesExampleCandidates(placed);

    expect(caption).toEqual({ kind: "placed", overIslands: false });
    expect(candidates).toEqual([
      { edge: blockedEdge.edge, island: markedIsland, allowed: false },
    ]);
  });

  test("✓ の線に2本架けると、多すぎの島ができたことを添えること", () => {
    const doubled = press(press(example, allowedEdge), allowedEdge);
    const caption = judgeBridgesExampleCrossing(doubled);

    expect(caption).toEqual({ kind: "placed", overIslands: true });
  });

  test("✓ の線に 1本 → 2本 → なし と押して最初の形に戻ると、凡例を出し直し、手がかりを付け直すこと", () => {
    const back = press(
      press(press(example, allowedEdge), allowedEdge),
      allowedEdge,
    );
    const caption = judgeBridgesExampleCrossing(back);
    const hint = findBridgesExampleHint(back);

    expect(caption.kind).toBe("legend");
    expect(hint).toEqual(blockedEdge);
  });

  test("線が交差する所を押すと、どちらの橋か決まらなかったと言うこと", () => {
    const caption = judgeBridgesExampleCrossing(shown);

    expect(caption.kind).toBe("ambiguous");
  });

  test("線が交差する所を押した後に島を選ぶと、決まらなかったことを下げること", () => {
    const selected = selectBridgesExampleIsland(shown, markedIsland!);
    const caption = judgeBridgesExampleCrossing(selected);

    expect(caption.kind).toBe("legend");
  });

  test("線が交差する所を押した後に何も変えない所を押すと、決まらなかったことを下げること", () => {
    const missed = missBridgesExamplePress(shown);
    const caption = judgeBridgesExampleCrossing(missed);

    expect(caption.kind).toBe("legend");
  });

  test("阻んでいる橋を外すと、外れたと言い、下への線も ✓ になること", () => {
    const removed = press(press(example, blocking), blocking);
    const caption = judgeBridgesExampleCrossing(removed);
    const candidates = listBridgesExampleCandidates(removed);

    expect(caption.kind).toBe("removed");
    expect(candidates).toContainEqual({
      edge: blockedEdge.edge,
      island: markedIsland,
      allowed: true,
    });
  });
});

describe("島の間を押す操作の例の場合", () => {
  const start = createBridgesExampleBoard(cycleOperationExample);
  const [hint] = cycleOperationExample.hints;
  const edge = hint?.kind === "edge" ? hint.edge : -1;
  const other = edgeOf(cycleOperationExample, 0, 2);

  test("押すたびに 1本 → 2本 → なし と回り、どの姿も多すぎにも完成にもならないこと", () => {
    const once = press(start, edge);
    const twice = press(once, edge);
    const thrice = press(twice, edge);
    const states = [once, twice, thrice];
    const statuses = states.flatMap((state) =>
      listBridgesIslandStatuses(cycleOperationExample.board, state),
    );
    const solved = states.map((state) =>
      isBridgesSolved(cycleOperationExample.board, state),
    );

    expect(states.map(({ bridges }) => bridges[edge])).toEqual([1, 2, 0]);
    expect(statuses).not.toContain("over");
    expect(solved).toEqual([false, false, false]);
  });

  test("1回押すと、次の手として同じ線に手がかりを付け直すこと", () => {
    const once = press(start, edge);
    const shownHint = findBridgesExampleHint(once);

    expect(once.hintStep).toBe(1);
    expect(shownHint).toEqual(hint);
  });

  test("3回押してなしに戻ると、最初の手から手がかりを付け直すこと", () => {
    const thrice = press(press(press(start, edge), edge), edge);
    const shownHint = findBridgesExampleHint(thrice);

    expect(thrice.hintStep).toBe(0);
    expect(shownHint).toEqual(hint);
  });

  test("ほかの線を押すと、手がかりを消すこと", () => {
    const moved = press(start, other);
    const shownHint = findBridgesExampleHint(moved);

    expect(shownHint).toBeNull();
  });

  test("ほかの線を押してから最初の形に戻すと、手がかりを付け直すこと", () => {
    const back = press(press(press(start, other), other), other);
    const shownHint = findBridgesExampleHint(back);

    expect(shownHint).toEqual(hint);
  });

  test("なぞって回しても橋は回るが、押す手がかりは進めずに消すこと", () => {
    const dragged = press(start, edge, "drag");
    const shownHint = findBridgesExampleHint(dragged);

    expect(dragged.bridges[edge]).toBe(1);
    expect(dragged.hintStep).toBe(0);
    expect(shownHint).toBeNull();
  });
});

describe("右クリックの例の場合", () => {
  const start = createBridgesExampleBoard(backwardCycleOperationExample);
  const [hint] = backwardCycleOperationExample.hints;
  const edge = hint?.kind === "backward" ? hint.edge : -1;

  test("右クリックのたびに なし → 2本 → 1本 と逆に回り、手がかりを進めること", () => {
    const once = pressBackward(start, edge);
    const twice = pressBackward(once, edge);
    const shownHint = findBridgesExampleHint(twice);

    expect([once.bridges[edge], twice.bridges[edge]]).toEqual([2, 1]);
    expect(twice.hintStep).toBe(2);
    expect(shownHint).toEqual(hint);
  });

  test("左の押しで回すと、手がかりを進めずに消すこと", () => {
    const pressed = press(start, edge);
    const shownHint = findBridgesExampleHint(pressed);

    expect(shownHint).toBeNull();
  });
});

describe("なぞる操作の例の場合", () => {
  const start = createBridgesExampleBoard(dragOperationExample);
  const [hint] = dragOperationExample.hints;
  const edge = hint?.kind === "drag" ? hint.edge : -1;

  test("なぞって架けたときだけ手がかりを進め、消すこと", () => {
    const dragged = press(start, edge, "drag");
    const shownHint = findBridgesExampleHint(dragged);

    expect(dragged.hintStep).toBe(1);
    expect(shownHint).toBeNull();
  });

  test("島の間を押して架けたときは手がかりを進めないこと", () => {
    const pressed = press(start, edge, "edge");

    expect(pressed.hintStep).toBe(0);
  });
});

describe("島を選んでから相手の島を押す操作の例の場合", () => {
  const start = createBridgesExampleBoard(pairOperationExample);
  const [selectHint, pairHint] = pairOperationExample.hints;
  const source = selectHint?.kind === "select" ? selectHint.island : -1;
  const edge = pairHint?.kind === "pair" ? pairHint.edge : -1;
  const selected = selectBridgesExampleIsland(start, source);
  // 盤面は、相手の島を押すと、選びを解いた知らせの後に橋を回す手を送る。
  const released = selectBridgesExampleIsland(selected, null);

  test("触る前は、選ぶ島に手がかりを付けること", () => {
    const shownHint = findBridgesExampleHint(start);

    expect(shownHint).toEqual(selectHint);
  });

  test("その島を選ぶと、相手の島に手がかりを移すこと", () => {
    const shownHint = findBridgesExampleHint(selected);

    expect(shownHint).toEqual(pairHint);
  });

  test("相手の島を押して架けると、手がかりを消すこと", () => {
    const placed = press(released, edge, "islands");
    const shownHint = findBridgesExampleHint(placed);

    expect(placed.bridges[edge]).toBe(1);
    expect(placed.hintStep).toBe(2);
    expect(shownHint).toBeNull();
  });

  test("選んだ後に選びを解くと、選ぶ島の手がかりへ戻すこと", () => {
    const shownHint = findBridgesExampleHint(released);

    expect(shownHint).toEqual(selectHint);
  });

  test("別の島を選んでいる間は、手がかりを付けないこと", () => {
    const other = selectBridgesExampleIsland(start, (source + 1) % 3);
    const shownHint = findBridgesExampleHint(other);

    expect(shownHint).toBeNull();
  });
});

describe("線が交差する所を押す操作の例の場合", () => {
  const start = createBridgesExampleBoard(crossingOperationExample);
  const [hint, dragHint] = crossingOperationExample.hints;
  const shown = showBridgesExampleCandidates(start);
  const dragEdge = dragHint?.kind === "drag" ? dragHint.edge : -1;
  const crossing = hint?.kind === "crossing" ? hint.edges : [-1, -1];

  test("2本の線は、交差する2本であること", () => {
    const { crossingEdges } = getBridgesNetwork(crossingOperationExample.board);

    expect(crossingEdges[crossing[0]]).toEqual([crossing[1]]);
  });

  test("触る前は、交差する所に手がかりを付けること", () => {
    const shownHint = findBridgesExampleHint(start);

    expect(shownHint).toEqual(hint);
  });

  test("交差する所を押すと、橋を変えずに、なぞる手の手がかりへ移すこと", () => {
    const nextHint = findBridgesExampleHint(shown);
    const changed = isBridgesExampleChanged(shown);

    expect(nextHint).toEqual(dragHint);
    expect(changed).toBe(false);
  });

  test("続けてなぞって架けると、手がかりを消すこと", () => {
    const dragged = press(shown, dragEdge, "drag");
    const shownHint = findBridgesExampleHint(dragged);

    expect(dragged.bridges[dragEdge]).toBe(1);
    expect(shownHint).toBeNull();
  });
});

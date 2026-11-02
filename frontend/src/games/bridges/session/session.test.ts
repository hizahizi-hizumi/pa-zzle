import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import {
  type BridgesSession,
  canRestartBridgesSession,
  canUndoBridgesSession,
  createBridgesSession,
  cycleBridgesSessionEdge,
  getBridgesSessionResult,
  restartBridgesSession,
  undoBridgesSession,
} from "@/games/bridges/session/session";

// 辺0 = 左上-右上（横）、辺1 = 左上-左下（縦）。両方に1本ずつで解ける。
const problem = parseBridgesBoard([
  "2.1...",
  "......",
  "1.....",
  "......",
  "......",
  "......",
]);
// 辺0 = 島0-島1（横）、辺1 = 島0-島2（縦）、辺2 = 島1-島4（縦）、辺3 = 島2-島3（横）。辺2と辺3が交わる。
const crossingProblem = parseBridgesBoard([
  "1.1...",
  "......",
  "1...1.",
  "......",
  "..1...",
  "......",
]);
const startedAt = 1_000;

function cycleEdges(
  session: BridgesSession,
  edges: readonly number[],
  operatedAt = startedAt,
): BridgesSession {
  return edges.reduce(
    (current, edge) =>
      cycleBridgesSessionEdge(current, edge, operatedAt).session,
    session,
  );
}

describe("createBridgesSession", () => {
  test("橋の無いプレイ中の session を作ること", () => {
    const session = createBridgesSession(problem, startedAt);

    expect(session).toMatchObject({
      status: "playing",
      puzzleState: { bridges: [0, 0] },
      startedAt,
      finishedAt: null,
      inputCount: 0,
      blockedCount: 0,
    });
  });

  describe("扱えない問題の場合", () => {
    test.each([
      [
        "隣り合う島のある",
        {
          width: 6,
          height: 6,
          islands: [
            { row: 0, column: 0, clue: 1 },
            { row: 0, column: 1, clue: 1 },
          ],
        },
      ],
      [
        "正方形でない",
        parseBridgesBoard(["1.1....", ...Array(5).fill(".......")]),
      ],
      ["一辺が5の", parseBridgesBoard(["1.1..", ...Array(4).fill(".....")])],
    ])("%s問題を拒むこと", (_, invalid) => {
      const act = () => createBridgesSession(invalid, startedAt);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("cycleBridgesSessionEdge", () => {
  const initial = createBridgesSession(problem, startedAt);
  const halfway = cycleEdges(initial, [0]);
  const clearedAt = 5_000;

  test("橋を架けて入力を数え、前の状態を待ったの履歴に積むこと", () => {
    const { session, crossingEdges } = cycleBridgesSessionEdge(
      initial,
      0,
      2_000,
    );

    expect({ session, crossingEdges }).toMatchObject({
      session: {
        puzzleState: { bridges: [1, 0] },
        inputCount: 1,
        history: [{ bridges: [0, 0] }],
      },
      crossingEdges: null,
    });
  });

  test("全部の島がちょうどでつながったら、その時刻でクリアにすること", () => {
    const { session } = cycleBridgesSessionEdge(halfway, 1, clearedAt);

    expect(session).toMatchObject({ status: "cleared", finishedAt: clearedAt });
  });

  describe("クリアした後の場合", () => {
    const cleared = cycleBridgesSessionEdge(halfway, 1, clearedAt).session;

    test("受け付けず、同じ session を返すこと", () => {
      const change = cycleBridgesSessionEdge(cleared, 0, clearedAt + 1);

      expect(change).toEqual({ session: cleared, crossingEdges: null });
    });
  });

  describe("交わる橋に阻まれた場合", () => {
    const crossed = cycleEdges(
      createBridgesSession(crossingProblem, startedAt),
      [3],
    );

    test("盤面を変えず、阻まれた回数を数えて交わる辺を返すこと", () => {
      const { session, crossingEdges } = cycleBridgesSessionEdge(
        crossed,
        2,
        2_000,
      );

      expect({
        bridges: session.puzzleState.bridges,
        blockedCount: session.blockedCount,
        inputCount: session.inputCount,
        crossingEdges,
      }).toEqual({
        bridges: [0, 0, 0, 1],
        blockedCount: 1,
        inputCount: 1,
        crossingEdges: [3],
      });
    });
  });
});

describe("undoBridgesSession", () => {
  const twice = cycleEdges(
    createBridgesSession(crossingProblem, startedAt),
    [0, 0],
  );

  test("直前の盤面操作を1つ取り消し、待ったを数えること", () => {
    const session = undoBridgesSession(twice);

    expect({
      bridges: session.puzzleState.bridges,
      undoCount: session.undoCount,
      canUndo: canUndoBridgesSession(session),
    }).toEqual({ bridges: [1, 0, 0, 0], undoCount: 1, canUndo: true });
  });

  describe("取り消せる操作が無い場合", () => {
    const initial = createBridgesSession(crossingProblem, startedAt);

    test("何もせず、同じ session を返すこと", () => {
      const session = undoBridgesSession(initial);

      expect(session).toBe(initial);
    });
  });
});

describe("restartBridgesSession", () => {
  const played = cycleEdges(
    createBridgesSession(crossingProblem, startedAt),
    [0, 3],
  );

  test("橋を全部外して待ったの履歴を消し、盤面を戻した回数を数えること", () => {
    const session = restartBridgesSession(played);

    expect({
      bridges: session.puzzleState.bridges,
      history: session.history,
      restartCount: session.restartCount,
      canRestart: canRestartBridgesSession(session),
    }).toEqual({
      bridges: [0, 0, 0, 0],
      history: [],
      restartCount: 1,
      canRestart: false,
    });
  });

  describe("橋が1本も無い場合", () => {
    const initial = createBridgesSession(crossingProblem, startedAt);

    test("何もせず、回数も数えないこと", () => {
      const session = restartBridgesSession(initial);

      expect(session).toBe(initial);
    });
  });
});

describe("getBridgesSessionResult", () => {
  const initial = createBridgesSession(problem, startedAt);
  const cleared = cycleBridgesSessionEdge(
    cycleEdges(initial, [0, 0, 0, 0]),
    1,
    7_000,
  ).session;

  test("クリアまでの経過時間とプレイの事実を返すこと", () => {
    const result = getBridgesSessionResult(cleared);

    expect(result).toEqual({
      elapsedMs: 6_000,
      undoCount: 0,
      restartCount: 0,
      inputCount: 5,
      blockedCount: 0,
    });
  });

  test("プレイ中は null を返すこと", () => {
    const result = getBridgesSessionResult(initial);

    expect(result).toBeNull();
  });
});

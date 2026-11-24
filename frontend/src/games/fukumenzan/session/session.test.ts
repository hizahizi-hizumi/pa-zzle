import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import type { FukumenzanDigit } from "@/games/fukumenzan/puzzle/state";
import {
  canRestartFukumenzanSession,
  canUndoFukumenzanSession,
  createFukumenzanSession,
  type FukumenzanSession,
  getFukumenzanSessionResult,
  placeFukumenzanSessionDigit,
  restartFukumenzanSession,
  returnFukumenzanSessionDigit,
  toggleFukumenzanSessionCross,
  undoFukumenzanSession,
} from "@/games/fukumenzan/session/session";

// 文字は B Y K T H の順。985 + 515 = 1500 で解ける。
const problem: FukumenzanProblem = { addends: ["BYK", "KTK"], result: "TKHH" };
const solution: readonly FukumenzanDigit[] = [9, 8, 5, 1, 0];
const startedAt = 1_000;

function placeDigits(
  session: FukumenzanSession,
  digits: readonly (readonly [letter: number, digit: FukumenzanDigit])[],
  operatedAt = startedAt,
): FukumenzanSession {
  return digits.reduce(
    (current, [letter, digit]) =>
      placeFukumenzanSessionDigit(current, letter, digit, operatedAt),
    session,
  );
}

const solvingPlacements = solution.map(
  (digit, letter) => [letter, digit] as const,
);

describe("createFukumenzanSession", () => {
  test("全部の文字が空のプレイ中の session を作ること", () => {
    const session = createFukumenzanSession(problem, startedAt);

    expect(session).toMatchObject({
      status: "playing",
      puzzleState: {
        placedDigits: [null, null, null, null, null],
        crossedDigits: [[], [], [], [], []],
      },
      startedAt,
      clearedAt: null,
      placeCount: 0,
      returnCount: 0,
      crossToggleCount: 0,
    });
  });

  describe("扱えない問題の場合", () => {
    test.each([
      [
        "見間違えやすい文字を使う",
        { addends: ["SEND", "MORE"], result: "MONEY" },
      ],
      ["足す数が1つ", { addends: ["ABC"], result: "ABC" }],
    ])("%s 問題を拒むこと", (_, invalidProblem) => {
      const act = () => createFukumenzanSession(invalidProblem, startedAt);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("placeFukumenzanSessionDigit", () => {
  const session = createFukumenzanSession(problem, startedAt);

  test("札を入れて数え、前の状態を待ったの履歴に積むこと", () => {
    const placed = placeFukumenzanSessionDigit(session, 2, 5, startedAt);

    expect(placed.puzzleState.placedDigits).toEqual([
      null,
      null,
      5,
      null,
      null,
    ]);
    expect(placed.placeCount).toBe(1);
    expect(placed.history).toEqual([session.puzzleState]);
  });

  test("全部の文字が解の数字になったら、その時刻でクリアにすること", () => {
    const cleared = placeDigits(session, solvingPlacements, 5_000);

    expect(cleared).toMatchObject({ status: "cleared", clearedAt: 5_000 });
  });

  describe("同じ札が入っている文字の場合", () => {
    const placed = placeFukumenzanSessionDigit(session, 2, 5, startedAt);

    test("受け付けず、同じ session を返すこと", () => {
      const next = placeFukumenzanSessionDigit(placed, 2, 5, startedAt);

      expect(next).toBe(placed);
    });
  });

  describe("クリアした後の場合", () => {
    const cleared = placeDigits(session, solvingPlacements);

    test("受け付けず、同じ session を返すこと", () => {
      const next = placeFukumenzanSessionDigit(cleared, 0, 2, startedAt);

      expect(next).toBe(cleared);
    });
  });
});

describe("returnFukumenzanSessionDigit", () => {
  const placed = placeDigits(createFukumenzanSession(problem, startedAt), [
    [0, 9],
  ]);

  test("札を列へ戻して数えること", () => {
    const returned = returnFukumenzanSessionDigit(placed, 0);

    expect(returned.puzzleState.placedDigits[0]).toBeNull();
    expect(returned.returnCount).toBe(1);
    expect(returned.history).toHaveLength(2);
  });

  test("空の文字には同じ session を返すこと", () => {
    const next = returnFukumenzanSessionDigit(placed, 1);

    expect(next).toBe(placed);
  });
});

describe("toggleFukumenzanSessionCross", () => {
  const session = createFukumenzanSession(problem, startedAt);

  test("× を付けて数え、待ったで戻せるようにすること", () => {
    const crossed = toggleFukumenzanSessionCross(session, 0, 0);

    expect(crossed.puzzleState.crossedDigits[0]).toEqual([0]);
    expect(crossed.crossToggleCount).toBe(1);
    expect(canUndoFukumenzanSession(crossed)).toBe(true);
  });
});

describe("undoFukumenzanSession", () => {
  const session = placeDigits(createFukumenzanSession(problem, startedAt), [
    [0, 9],
    [1, 8],
  ]);

  test("直前の盤面操作を1つ取り消し、待ったを数えること", () => {
    const undone = undoFukumenzanSession(session);

    expect(undone.puzzleState.placedDigits).toEqual([
      9,
      null,
      null,
      null,
      null,
    ]);
    expect(undone.undoCount).toBe(1);
    expect(undone.placeCount).toBe(2);
  });

  describe("取り消せる操作が無い場合", () => {
    const initial = createFukumenzanSession(problem, startedAt);

    test("何もせず、同じ session を返すこと", () => {
      const next = undoFukumenzanSession(initial);

      expect(next).toBe(initial);
    });
  });
});

describe("restartFukumenzanSession", () => {
  const session = toggleFukumenzanSessionCross(
    placeDigits(createFukumenzanSession(problem, startedAt), [[0, 9]]),
    1,
    3,
  );

  test("札と × を全部消して待ったの履歴を消し、盤面を戻した回数を数えること", () => {
    const restarted = restartFukumenzanSession(session);

    expect(restarted.puzzleState).toEqual(
      createFukumenzanSession(problem, startedAt).puzzleState,
    );
    expect(restarted.history).toEqual([]);
    expect(restarted.restartCount).toBe(1);
    expect(canRestartFukumenzanSession(restarted)).toBe(false);
  });

  describe("× だけを付けた場合", () => {
    const crossedOnly = toggleFukumenzanSessionCross(
      createFukumenzanSession(problem, startedAt),
      0,
      0,
    );

    test("盤面を戻せること", () => {
      const canRestart = canRestartFukumenzanSession(crossedOnly);

      expect(canRestart).toBe(true);
    });
  });

  describe("盤面が初めのままの場合", () => {
    const initial = createFukumenzanSession(problem, startedAt);

    test("何もせず、回数も数えないこと", () => {
      const next = restartFukumenzanSession(initial);

      expect(next).toBe(initial);
    });
  });
});

describe("getFukumenzanSessionResult", () => {
  const cleared = placeDigits(
    returnFukumenzanSessionDigit(
      placeDigits(createFukumenzanSession(problem, startedAt), [[0, 1]]),
      0,
    ),
    solvingPlacements,
    61_000,
  );
  const playing = createFukumenzanSession(problem, startedAt);

  test("クリアまでの経過時間とプレイの事実を返すこと", () => {
    const result = getFukumenzanSessionResult(cleared);

    expect(result).toEqual({
      elapsedMs: 60_000,
      undoCount: 0,
      restartCount: 0,
      placeCount: 6,
      returnCount: 1,
      crossToggleCount: 0,
    });
  });

  test("プレイ中は null を返すこと", () => {
    const result = getFukumenzanSessionResult(playing);

    expect(result).toBeNull();
  });
});

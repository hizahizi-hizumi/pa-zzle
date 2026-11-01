// @vitest-environment node

import type { IceFloorMazeProblem } from "@/games/ice-floor-maze/problem/problem";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  canRestartIceFloorMazeSession,
  canUndoIceFloorMazeSession,
  createIceFloorMazeSession,
  getIceFloorMazeSessionResult,
  type IceFloorMazeSession,
  restartIceFloorMazeSession,
  slideIceFloorMazeSessionPiece,
  undoIceFloorMazeSession,
} from "@/games/ice-floor-maze/session/session";

// #  1  #  3  4
// 5  6  7  #  #
// 10 11 #  #  #
// 15 16 S  G  19
// #  21 22 23 #
// 開始位置 17 から下・右・上の3手でゴール 18 に止まる。上は岩ですぐ止まり、右はゴールを通り過ぎて 19 で止まる。
const problem: IceFloorMazeProblem = {
  board: parseIceFloorMazeBoard(["#.#..", "...##", "..###", ".....", "#...#"]),
  start: 17,
  goal: 18,
};
const solution: readonly IceFloorMazeDirection[] = ["down", "right", "up"];

// 0  1  b
// 3  c  5
// 6  7  8
// 開始位置 0 から右へ滑るともろい岩 2 が崩れ、続けて下へ滑ると薄い氷 4 を通って割る。ゴール 8 へは下・右の2手。
const elementProblem: IceFloorMazeProblem = {
  board: parseIceFloorMazeBoard(["..b", ".c.", "..."]),
  start: 0,
  goal: 8,
};

function slideInOrder(
  session: IceFloorMazeSession,
  directions: readonly IceFloorMazeDirection[],
  movedAt: number,
): IceFloorMazeSession {
  return directions.reduce(
    (current, direction) =>
      slideIceFloorMazeSessionPiece(current, direction, movedAt).session,
    session,
  );
}

describe("createIceFloorMazeSession", () => {
  test("駒を開始位置に置いてプレイを始めること", () => {
    const result = createIceFloorMazeSession(problem, 1_000);

    expect(result.status).toBe("playing");
    expect(result.puzzleState).toEqual({
      position: 17,
      cells: problem.board.cells,
    });
    expect(result.history).toEqual([]);
    expect(result.moveCount).toBe(0);
  });

  describe("ゴールへ到達できない問題の場合", () => {
    const unreachable = { ...problem, goal: 4 };

    test("受け付けないこと", () => {
      const act = () => createIceFloorMazeSession(unreachable, 1_000);

      expect(act).toThrow();
    });
  });
});

describe("slideIceFloorMazeSessionPiece", () => {
  const session = createIceFloorMazeSession(problem, 1_000);

  test("岩の手前まで滑らせて手数を 1 増やし、元の位置を待ったの履歴に積むこと", () => {
    const result = slideIceFloorMazeSessionPiece(session, "down", 1_100);

    expect(result.outcome).toBe("slid");
    expect(result.session.puzzleState.position).toBe(22);
    expect(result.session.history.map(({ position }) => position)).toEqual([
      17,
    ]);
    expect(result.session.moveCount).toBe(1);
    expect(result.session.status).toBe("playing");
  });

  test("通ったマスと止まったマスを滑りの結果として返すこと", () => {
    const result = slideIceFloorMazeSessionPiece(session, "right", 1_100);

    expect(result.outcome === "slid" && result.slide).toMatchObject({
      status: "slid",
      direction: "right",
      from: 17,
      to: 19,
      path: [18, 19],
    });
  });

  test("ゴールを通り過ぎただけではクリアにしないこと", () => {
    const result = slideIceFloorMazeSessionPiece(session, "right", 1_100);

    expect(result.session.status).toBe("playing");
    expect(result.session.puzzleState.position).toBe(19);
  });

  test("1マスも動けない向きでは同じ session を返し、成立しなかった滑りを返すこと", () => {
    const result = slideIceFloorMazeSessionPiece(session, "up", 1_100);

    expect(result.outcome).toBe("blocked");
    expect(result.session).toBe(session);
  });

  test("ゴールで止まるとクリアし終了時刻を決めること", () => {
    const result = slideIceFloorMazeSessionPiece(
      slideInOrder(session, ["down", "right"], 1_100),
      "up",
      2_000,
    );

    expect(result.session.status).toBe("cleared");
    expect(result.session.puzzleState.position).toBe(18);
    expect(result.session.finishedAt).toBe(2_000);
    expect(result.session.moveCount).toBe(3);
  });

  describe("クリアした場合", () => {
    const cleared = slideInOrder(session, solution, 2_000);

    test("操作を受け付けないこと", () => {
      const result = slideIceFloorMazeSessionPiece(cleared, "down", 2_100);

      expect(result).toEqual({ outcome: "ignored", session: cleared });
    });
  });
});

describe("要素のある問題の場合", () => {
  const session = createIceFloorMazeSession(elementProblem, 1_000);
  const changed = slideInOrder(session, ["right", "down"], 1_100);

  test("崩したもろい岩と割った薄い氷を今の盤面に残すこと", () => {
    const result = slideInOrder(session, ["right", "down"], 1_100);

    expect(result.puzzleState.position).toBe(7);
    expect(result.puzzleState.cells[2]).toBe("ice");
    expect(result.puzzleState.cells[4]).toBe("water");
  });

  test("待ったで直前の滑りの要素の変化も戻すこと", () => {
    const result = undoIceFloorMazeSession(changed);

    expect(result.puzzleState.position).toBe(1);
    expect(result.puzzleState.cells[2]).toBe("ice");
    expect(result.puzzleState.cells[4]).toBe("thin-ice");
  });

  test("待ったを重ねると、どの要素も変わる前の状態へ戻ること", () => {
    const result = undoIceFloorMazeSession(undoIceFloorMazeSession(changed));

    expect(result.puzzleState).toEqual({
      position: 0,
      cells: elementProblem.board.cells,
    });
  });

  test("盤面を戻すで要素の変化も戻すこと", () => {
    const result = restartIceFloorMazeSession(changed);

    expect(result.puzzleState).toEqual({
      position: 0,
      cells: elementProblem.board.cells,
    });
    expect(result.restartCount).toBe(1);
  });

  describe("要素を変えて開始位置へ戻った場合", () => {
    const returned = slideInOrder(session, ["right", "left"], 1_100);

    test("盤面を戻せること", () => {
      const result = canRestartIceFloorMazeSession(returned);

      expect(returned.puzzleState.position).toBe(0);
      expect(result).toBe(true);
    });
  });
});

describe("undoIceFloorMazeSession", () => {
  const session = slideInOrder(
    createIceFloorMazeSession(problem, 1_000),
    ["down", "right"],
    1_100,
  );

  test("直前に止まっていた位置へ戻し、総手数を減らさず待ったを数えること", () => {
    const result = undoIceFloorMazeSession(session);

    expect(result.puzzleState.position).toBe(22);
    expect(result.history.map(({ position }) => position)).toEqual([17]);
    expect(result.moveCount).toBe(2);
    expect(result.undoCount).toBe(1);
  });

  describe("履歴が無い場合", () => {
    const fresh = createIceFloorMazeSession(problem, 1_000);

    test("同じ session を返すこと", () => {
      const result = undoIceFloorMazeSession(fresh);

      expect(result).toBe(fresh);
    });
  });

  describe("クリアした場合", () => {
    const cleared = slideInOrder(session, ["up"], 2_000);

    test("同じ session を返すこと", () => {
      const result = undoIceFloorMazeSession(cleared);

      expect(result).toBe(cleared);
    });
  });
});

describe("restartIceFloorMazeSession", () => {
  const session = slideInOrder(
    createIceFloorMazeSession(problem, 1_000),
    ["down", "right"],
    1_100,
  );

  test("駒を開始位置へ戻し、総手数と経過時間の起点を引き継いで盤面を戻すを数えること", () => {
    const result = restartIceFloorMazeSession(session);

    expect(result.puzzleState.position).toBe(17);
    expect(result.history).toEqual([]);
    expect(result.moveCount).toBe(2);
    expect(result.restartCount).toBe(1);
    expect(result.startedAt).toBe(1_000);
  });

  describe("駒が開始位置にいる場合", () => {
    const fresh = createIceFloorMazeSession(problem, 1_000);

    test("同じ session を返し回数も数えないこと", () => {
      const result = restartIceFloorMazeSession(fresh);

      expect(result).toBe(fresh);
    });
  });
});

describe("canUndoIceFloorMazeSession", () => {
  const fresh = createIceFloorMazeSession(problem, 1_000);
  const moved = slideInOrder(fresh, ["down"], 1_100);
  const cleared = slideInOrder(fresh, solution, 2_000);
  const cases = [
    ["動かす前", fresh, false],
    ["動かした後", moved, true],
    ["クリアした後", cleared, false],
  ] as const;

  test.each(cases)("%sは %s を返すこと", (_, session, expected) => {
    const result = canUndoIceFloorMazeSession(session);

    expect(result).toBe(expected);
  });
});

describe("canRestartIceFloorMazeSession", () => {
  const fresh = createIceFloorMazeSession(problem, 1_000);
  const moved = slideInOrder(fresh, ["down"], 1_100);
  const returned = slideInOrder(fresh, ["down", "up"], 1_100);
  const cleared = slideInOrder(fresh, solution, 2_000);
  const cases = [
    ["動かす前", fresh, false],
    ["開始位置から離れた後", moved, true],
    ["滑って開始位置へ戻った後", returned, false],
    ["クリアした後", cleared, false],
  ] as const;

  test.each(cases)("%sは %s を返すこと", (_, session, expected) => {
    const result = canRestartIceFloorMazeSession(session);

    expect(result).toBe(expected);
  });
});

describe("getIceFloorMazeSessionResult", () => {
  const session = createIceFloorMazeSession(problem, 1_000);

  describe("プレイ中の場合", () => {
    test("null を返すこと", () => {
      const result = getIceFloorMazeSessionResult(session);

      expect(result).toBeNull();
    });
  });

  describe("待ったと盤面を戻すを使ってクリアした場合", () => {
    const undone = undoIceFloorMazeSession(
      slideInOrder(session, ["right"], 1_200),
    );
    const restarted = restartIceFloorMazeSession(
      slideInOrder(undone, ["down"], 1_300),
    );
    const cleared = slideInOrder(restarted, solution, 9_000);

    test("取り消した手と盤面を戻す前の手も含む総手数と各操作の回数とクリアまでの経過時間を返すこと", () => {
      const result = getIceFloorMazeSessionResult(cleared);

      expect(result).toEqual({
        elapsedMs: 8_000,
        moveCount: 5,
        undoCount: 1,
        restartCount: 1,
      });
    });
  });
});

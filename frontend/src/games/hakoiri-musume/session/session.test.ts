import {
  formatHakoiriMusumeBoard,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  type HakoiriMusumeDirection,
  hakoiriMusumeDirections,
  isHakoiriMusumeCleared,
  listHakoiriMusumePieceDestinations,
  moveHakoiriMusumePiece,
  placeHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
} from "@/games/hakoiri-musume/puzzle/state";
import {
  canRestartHakoiriMusumeSession,
  canUndoHakoiriMusumeSession,
  createHakoiriMusumeSession,
  getHakoiriMusumeSessionResult,
  type HakoiriMusumeSession,
  moveHakoiriMusumeSessionPiece,
  restartHakoiriMusumeSession,
  undoHakoiriMusumeSession,
} from "@/games/hakoiri-musume/session/session";

/** 1手。`pieceIndex` 番目の駒を、左上が `cell` に来るまで動かす。 */
type Move = { pieceIndex: number; cell: number };

/** 1手を「1つの駒を空いたマスの続く所へ動かす」として、始めの盤面から娘が出口の前に着くまでの最短の手の並び。 */
function findShortestSolution(start: HakoiriMusumeState): Move[] {
  const reached = new Map<
    string,
    { state: HakoiriMusumeState; previous: string | null; move: Move | null }
  >();
  const startKey = formatHakoiriMusumeBoard(start.pieces);
  reached.set(startKey, { state: start, previous: null, move: null });
  const queue = [startKey];
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const { state } = reached.get(key)!;
    if (isHakoiriMusumeCleared(state)) {
      const moves: Move[] = [];
      for (
        let entry = reached.get(key)!;
        entry.move;
        entry = reached.get(entry.previous!)!
      ) {
        moves.unshift(entry.move);
      }
      return moves;
    }
    state.pieces.forEach((_, pieceIndex) => {
      for (const cell of listHakoiriMusumePieceDestinations(
        state,
        pieceIndex,
      )) {
        const next = placeHakoiriMusumePiece(state, pieceIndex, cell);
        const nextKey = formatHakoiriMusumeBoard(next.pieces);
        if (!reached.has(nextKey)) {
          reached.set(nextKey, {
            state: next,
            previous: key,
            move: { pieceIndex, cell },
          });
          queue.push(nextKey);
        }
      }
    });
  }
  throw new Error("The daughter cannot reach the exit");
}

/** 駒を `cell` まで1マスずつ動かす向きの並び。ほかの駒は動かさない。 */
function findStepDirections(
  state: HakoiriMusumeState,
  pieceIndex: number,
  cell: number,
): HakoiriMusumeDirection[] {
  const routes = new Map<number, HakoiriMusumeDirection[]>([
    [state.pieces[pieceIndex]!.cell, []],
  ]);
  const queue = [state];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    const route = routes.get(current.pieces[pieceIndex]!.cell)!;
    if (current.pieces[pieceIndex]!.cell === cell) {
      return route;
    }
    for (const direction of hakoiriMusumeDirections) {
      const next = moveHakoiriMusumePiece(current, pieceIndex, direction);
      if (next && !routes.has(next.pieces[pieceIndex]!.cell)) {
        routes.set(next.pieces[pieceIndex]!.cell, [...route, direction]);
        queue.push(next);
      }
    }
  }
  throw new Error(`Piece ${pieceIndex} cannot reach ${cell}`);
}

function moveInOrder(
  session: HakoiriMusumeSession,
  steps: readonly (readonly [number, HakoiriMusumeDirection])[],
): HakoiriMusumeSession {
  return steps.reduce(
    (current, [pieceIndex, direction], index) =>
      moveHakoiriMusumeSessionPiece(
        current,
        pieceIndex,
        direction,
        1_000 + index,
      ).session,
    session,
  );
}

const easyProblem = {
  pieces: parseHakoiriMusumeBoard("vAAvwAAwv..vwhiws..s")!,
};

describe("合意の2例の最短解をたどった場合", () => {
  const cases = [
    ["易しい例", "vAAvwAAwv..vwhiws..s", 13],
    ["横刀立馬", "vAAvwAAwvhivwssws..s", 81],
  ] as const;

  describe.each(cases)("%s", (_, text, optimalMoveCount) => {
    const problem = { pieces: parseHakoiriMusumeBoard(text)! };
    const solution = findShortestSolution(
      createHakoiriMusumeInitialState(problem.pieces),
    );
    let session: HakoiriMusumeSession;

    beforeEach(() => {
      session = createHakoiriMusumeSession(problem, 0);
      solution.forEach(({ pieceIndex, cell }, moveIndex) => {
        for (const direction of findStepDirections(
          session.puzzleState,
          pieceIndex,
          cell,
        )) {
          session = moveHakoiriMusumeSessionPiece(
            session,
            pieceIndex,
            direction,
            (moveIndex + 1) * 1_000,
          ).session;
        }
      });
    });

    test("最短手数が合意の手数であること", () => {
      const moveCount = solution.length;

      expect(moveCount).toBe(optimalMoveCount);
    });

    test("1マスずつたどるとクリアになり、指した手の数が最短手数と一致すること", () => {
      const result = getHakoiriMusumeSessionResult(session);

      expect(session.status).toBe("cleared");
      expect(result).toEqual({
        elapsedMs: optimalMoveCount * 1_000,
        moveCount: optimalMoveCount,
        undoCount: 0,
        restartCount: 0,
      });
    });
  });
});

// 易しい例の駒の番号
// 0: 左上の縦長 1: 娘 2: 右上の縦長 3: 左中の縦長 4: 右中の縦長 5: 横長 6: 左下の小駒 7: 右下の小駒
describe("moveHakoiriMusumeSessionPiece", () => {
  describe("同じ駒を続けて動かした場合", () => {
    let session: HakoiriMusumeSession;

    beforeEach(() => {
      session = moveInOrder(createHakoiriMusumeSession(easyProblem, 0), [
        [6, "right"],
        [6, "right"],
      ]);
    });

    test("1手として数えること", () => {
      const { moveCount, history } = session;

      expect(moveCount).toBe(1);
      expect(history).toHaveLength(1);
    });

    test("待ったで続けた移動の全部を取り消し、指した手の数は減らさないこと", () => {
      const undone = undoHakoiriMusumeSession(session);

      expect(undone.puzzleState.pieces[6]!.cell).toBe(16);
      expect(undone.moveCount).toBe(1);
      expect(undone.undoCount).toBe(1);
      expect(canUndoHakoiriMusumeSession(undone)).toBe(false);
    });

    test("待ったの後に同じ駒を動かすと新しい1手になること", () => {
      const undone = undoHakoiriMusumeSession(session);

      const moved = moveHakoiriMusumeSessionPiece(undone, 6, "right", 5_000);

      expect(moved.session.moveCount).toBe(2);
    });
  });

  describe("別の駒を動かした場合", () => {
    let session: HakoiriMusumeSession;

    beforeEach(() => {
      session = moveInOrder(createHakoiriMusumeSession(easyProblem, 0), [
        [6, "right"],
        [7, "left"],
        [6, "left"],
      ]);
    });

    test("駒が変わるたびに新しい1手として数えること", () => {
      const { moveCount } = session;

      expect(moveCount).toBe(3);
    });

    test("待ったは直前の1手だけを取り消すこと", () => {
      const undone = undoHakoiriMusumeSession(session);

      expect(undone.puzzleState.pieces[6]!.cell).toBe(17);
      expect(undone.puzzleState.pieces[7]!.cell).toBe(18);
    });
  });

  describe("続けて動かした駒を1手の前の位置へ戻した場合", () => {
    let session: HakoiriMusumeSession;

    beforeEach(() => {
      session = moveInOrder(createHakoiriMusumeSession(easyProblem, 0), [
        [5, "up"],
        [6, "right"],
        [6, "right"],
        [6, "left"],
        [6, "left"],
      ]);
    });

    test("その1手を指さなかったことにし、前の1手を待ったで戻せるまま残すこと", () => {
      const { moveCount, history } = session;
      const undone = undoHakoiriMusumeSession(session);

      expect(moveCount).toBe(1);
      expect(history).toHaveLength(1);
      expect(undone.puzzleState.pieces[5]!.cell).toBe(13);
    });

    test("戻した後に同じ駒を動かすと新しい1手になること", () => {
      const moved = moveHakoiriMusumeSessionPiece(session, 6, "right", 9_000);

      expect(moved.session.moveCount).toBe(2);
      expect(moved.session.history).toHaveLength(2);
    });
  });

  describe("動けない向きの場合", () => {
    const session = createHakoiriMusumeSession(easyProblem, 0);

    test("session を変えずに返すこと", () => {
      const step = moveHakoiriMusumeSessionPiece(session, 0, "up", 1_000);

      expect(step.outcome).toBe("blocked");
      expect(step.session).toBe(session);
    });
  });

  describe("動いた場合", () => {
    const session = createHakoiriMusumeSession(easyProblem, 0);

    test("動いた駒と、動く前と後の左上のマスを返すこと", () => {
      const step = moveHakoiriMusumeSessionPiece(session, 5, "up", 1_000);

      expect(step).toMatchObject({
        outcome: "moved",
        pieceIndex: 5,
        from: 13,
        to: 9,
      });
    });
  });
});

describe("restartHakoiriMusumeSession", () => {
  describe("何手か指した場合", () => {
    let session: HakoiriMusumeSession;

    beforeEach(() => {
      session = moveInOrder(createHakoiriMusumeSession(easyProblem, 0), [
        [6, "right"],
        [7, "left"],
      ]);
    });

    test("始めの並びへ戻し、指した手の数は減らさないこと", () => {
      const restarted = restartHakoiriMusumeSession(session);

      expect(restarted.puzzleState.pieces).toEqual(easyProblem.pieces);
      expect(restarted.moveCount).toBe(2);
      expect(restarted.restartCount).toBe(1);
      expect(canUndoHakoiriMusumeSession(restarted)).toBe(false);
      expect(canRestartHakoiriMusumeSession(restarted)).toBe(false);
    });

    test("戻した後に前の1手の駒を動かすと新しい1手になること", () => {
      const restarted = restartHakoiriMusumeSession(session);

      const moved = moveHakoiriMusumeSessionPiece(restarted, 7, "left", 5_000);

      expect(moved.session.moveCount).toBe(3);
    });
  });

  describe("始めの並びのままの場合", () => {
    const session = createHakoiriMusumeSession(easyProblem, 0);

    test("何もせず回数も数えないこと", () => {
      const restarted = restartHakoiriMusumeSession(session);

      expect(restarted).toBe(session);
    });
  });
});

describe("canRestartHakoiriMusumeSession", () => {
  describe("同じ種類の駒が入れ替わっただけの盤面の場合", () => {
    // 横長を上へよけて、左下と右下の小駒を入れ替えてから横長を戻す
    const session = moveInOrder(createHakoiriMusumeSession(easyProblem, 0), [
      [5, "up"],
      [6, "right"],
      [6, "up"],
      [7, "left"],
      [7, "left"],
      [7, "left"],
      [6, "down"],
      [6, "right"],
      [6, "right"],
      [5, "down"],
    ]);

    test("始めの並びとみなして戻せないこと", () => {
      const canRestart = canRestartHakoiriMusumeSession(session);

      expect(session.puzzleState.pieces[6]!.cell).toBe(19);
      expect(canRestart).toBe(false);
    });
  });
});

describe("クリアした場合", () => {
  // 娘が出口の1段上にいて、下へ1マス動かせばクリアになる盤面
  const problem = { pieces: parseHakoiriMusumeBoard("v..vwssw.AAv.AAws...")! };
  let session: HakoiriMusumeSession;

  beforeEach(() => {
    session = moveInOrder(createHakoiriMusumeSession(problem, 0), [
      [6, "up"],
      [4, "down"],
    ]);
  });

  test("娘が出口の前に着いた時刻で終わること", () => {
    const { status, finishedAt } = session;

    expect(status).toBe("cleared");
    expect(finishedAt).toBe(1_001);
  });

  test("それ以上の移動と待ったを受け付けないこと", () => {
    const step = moveHakoiriMusumeSessionPiece(session, 0, "down", 9_000);
    const undone = undoHakoiriMusumeSession(session);

    expect(step.outcome).toBe("ignored");
    expect(undone).toBe(session);
  });
});

describe("getHakoiriMusumeSessionResult", () => {
  describe("プレイ中の場合", () => {
    const session = createHakoiriMusumeSession(easyProblem, 0);

    test("結果を返さないこと", () => {
      const result = getHakoiriMusumeSessionResult(session);

      expect(result).toBeNull();
    });
  });
});

import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import {
  canRestartReflectionSession,
  canUndoReflectionSession,
  createReflectionSession,
  getReflectionSessionElapsedMs,
  getReflectionSessionResult,
  getReflectionSessionStock,
  type ReflectionSession,
  replayReflectionSession,
  restartReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionStock,
  undoReflectionSession,
} from "@/games/reflection/session/session";

// 3×3 の盤面の各マスの番号:
// 0 1 2
// 3 4 5
// 6 7 8
function createProblem(rows: readonly string[]): ReflectionProblem {
  const solution = parseReflectionBoard(rows);
  return {
    size: solution.size,
    inventory: countReflectionBoardPieces(solution),
    clues: computeReflectionClues(solution),
    solution,
  };
}

/** 解は 0 に `/`、8 にブラックホール。 */
const problem = createProblem(["/..", "...", "..@"]);

const startedAt = 1_000;

const initial = createReflectionSession(problem, startedAt);

function placeFromStock(
  session: ReflectionSession,
  piece: ReflectionPiece,
  cellIndex: number,
  operatedAt = startedAt,
): ReflectionSession {
  const selected =
    session.selection?.type === "stock" && session.selection.piece === piece
      ? session
      : tapReflectionSessionStock(session, piece, operatedAt);
  return tapReflectionSessionCell(selected, cellIndex, operatedAt);
}

function tapCells(
  session: ReflectionSession,
  cellIndices: readonly number[],
): ReflectionSession {
  return cellIndices.reduce(
    (current, cellIndex) =>
      tapReflectionSessionCell(current, cellIndex, startedAt),
    session,
  );
}

function isEmptyBoard(session: ReflectionSession): boolean {
  return session.board.cells.every((cell) => cell === null);
}

/** 解と違う位置の 4 に `/` を置いた状態。 */
const slashAtCenter = placeFromStock(initial, "slash", 4);

describe("createReflectionSession", () => {
  test("空の盤面・全ピースがストックにある状態で始めること", () => {
    const session = createReflectionSession(problem, startedAt);

    expect(session.status).toBe("playing");
    expect(isEmptyBoard(session)).toBe(true);
    expect(getReflectionSessionStock(session)).toEqual(problem.inventory);
    expect(session.selection).toBeNull();
  });

  describe("外周ヒントが解と合わない問題の場合", () => {
    const invalidProblem = { ...problem, clues: problem.clues.slice(1) };

    test("受け付けないこと", () => {
      const act = () => createReflectionSession(invalidProblem, startedAt);

      expect(act).toThrow();
    });
  });
});

describe("tapReflectionSessionStock", () => {
  describe("何も選んでいない場合", () => {
    test("押した種類を選ぶこと", () => {
      const next = tapReflectionSessionStock(initial, "slash", startedAt);

      expect(next.selection).toEqual({ type: "stock", piece: "slash" });
      expect(next.inputCount).toBe(1);
    });

    test("残りが無い種類は選ばないこと", () => {
      const next = tapReflectionSessionStock(initial, "reflector", startedAt);

      expect(next).toBe(initial);
    });
  });

  describe("同じ種類を選んでいる場合", () => {
    const selected = tapReflectionSessionStock(initial, "slash", startedAt);

    test("選択を解除すること", () => {
      const next = tapReflectionSessionStock(selected, "slash", startedAt);

      expect(next.selection).toBeNull();
      expect(next.inputCount).toBe(2);
    });
  });

  describe("盤面のピースを選んでいる場合", () => {
    const selected = tapReflectionSessionCell(slashAtCenter, 4, startedAt);

    test("押した種類によらず、選んだピースをストックへ戻し置き直しに数えること", () => {
      const next = tapReflectionSessionStock(selected, "black-hole", startedAt);

      expect(next.board.cells[4]).toBeNull();
      expect(getReflectionSessionStock(next).slash).toBe(1);
      expect(next.selection).toBeNull();
      expect(next.relocationCount).toBe(1);
    });
  });
});

describe("tapReflectionSessionCell", () => {
  describe("ストックの種類を選んでいる場合", () => {
    const selectedSlash = tapReflectionSessionStock(
      initial,
      "slash",
      startedAt,
    );
    const twoSlashes = createReflectionSession(
      createProblem(["/./", "...", "..."]),
      startedAt,
    );
    const selectedOneOfTwoSlashes = tapReflectionSessionStock(
      twoSlashes,
      "slash",
      startedAt,
    );
    const selectedBlackHole = tapReflectionSessionStock(
      slashAtCenter,
      "black-hole",
      startedAt,
    );

    test("空きマスへ置き、残りが無くなれば選択を解除すること", () => {
      const next = tapReflectionSessionCell(selectedSlash, 4, startedAt);

      expect(next.board.cells[4]).toBe("slash");
      expect(getReflectionSessionStock(next).slash).toBe(0);
      expect(next.selection).toBeNull();
      expect(next.relocationCount).toBe(0);
    });

    test("同じ種類が残っていれば選択を保つこと", () => {
      const next = tapReflectionSessionCell(
        selectedOneOfTwoSlashes,
        4,
        startedAt,
      );

      expect(next.selection).toEqual({ type: "stock", piece: "slash" });
    });

    test("別の種類のピースがあるマスでは、元のピースをストックへ戻して置き、置き直しに数えること", () => {
      const next = tapReflectionSessionCell(selectedBlackHole, 4, startedAt);

      expect(next.board.cells[4]).toBe("black-hole");
      expect(getReflectionSessionStock(next).slash).toBe(1);
      expect(next.relocationCount).toBe(1);
    });
  });

  describe("何も選んでいない場合", () => {
    test("空きマスを押しても何もしないこと", () => {
      const next = tapReflectionSessionCell(initial, 4, startedAt);

      expect(next).toBe(initial);
    });

    test("ピースのあるマスを選ぶこと", () => {
      const next = tapReflectionSessionCell(slashAtCenter, 4, startedAt);

      expect(next.selection).toEqual({ type: "cell", cellIndex: 4 });
    });
  });

  describe("盤面のピースを選んでいる場合", () => {
    const selectedSlash = tapReflectionSessionCell(slashAtCenter, 4, startedAt);
    const selectedSlashWithBlackHole = tapReflectionSessionCell(
      placeFromStock(slashAtCenter, "black-hole", 1),
      4,
      startedAt,
    );

    test("空きマスへ移し、置き直しに数えること", () => {
      const next = tapReflectionSessionCell(selectedSlash, 1, startedAt);

      expect(next.board.cells[4]).toBeNull();
      expect(next.board.cells[1]).toBe("slash");
      expect(next.selection).toBeNull();
      expect(next.relocationCount).toBe(1);
    });

    test("別のピースと入れ替え、1回の置き直しに数えること", () => {
      const next = tapReflectionSessionCell(
        selectedSlashWithBlackHole,
        1,
        startedAt,
      );

      expect(next.board.cells[4]).toBe("black-hole");
      expect(next.board.cells[1]).toBe("slash");
      expect(next.relocationCount).toBe(1);
    });

    test("同じマスを押すと盤面を変えずに選択を解除すること", () => {
      const next = tapReflectionSessionCell(selectedSlash, 4, startedAt);

      expect(next.selection).toBeNull();
      expect(next.board).toBe(slashAtCenter.board);
    });
  });
});

describe("全ピースを置いた場合", () => {
  const cleared = placeFromStock(
    placeFromStock(initial, "slash", 0),
    "black-hole",
    8,
    9_000,
  );
  const allPlacedWrongly = placeFromStock(slashAtCenter, "black-hole", 8);

  test("全ピースを置いて外周ヒントが揃うとクリアすること", () => {
    const { status, finishedAt } = cleared;

    expect(status).toBe("cleared");
    expect(finishedAt).toBe(9_000);
  });

  test("クリア後の操作を受け付けないこと", () => {
    const next = tapReflectionSessionCell(cleared, 0, 9_500);

    expect(next).toBe(cleared);
    expect(canUndoReflectionSession(cleared)).toBe(false);
    expect(canRestartReflectionSession(cleared)).toBe(false);
  });

  test("全ピースを置いても外周ヒントが揃わなければクリアしないこと", () => {
    const stock = getReflectionSessionStock(allPlacedWrongly);

    expect(stock.slash + stock["black-hole"]).toBe(0);
    expect(allPlacedWrongly.status).toBe("playing");
  });
});

describe("getReflectionSessionResult", () => {
  const movedThenCleared = placeFromStock(
    tapCells(slashAtCenter, [4, 0]),
    "black-hole",
    8,
    31_000,
  );

  test("クリアしたプレイの事実を返すこと", () => {
    const result = getReflectionSessionResult(movedThenCleared);

    expect(result).toEqual({
      elapsedMs: 30_000,
      relocationCount: 1,
      restartCount: 0,
      undoCount: 0,
      inputCount: 6,
    });
  });

  test("プレイ中は結果を返さないこと", () => {
    const result = getReflectionSessionResult(initial);

    expect(result).toBeNull();
  });
});

describe("undoReflectionSession", () => {
  const twoPlaced = placeFromStock(slashAtCenter, "black-hole", 1);
  const onlySelected = tapReflectionSessionStock(initial, "slash", startedAt);

  test("直前の盤面操作を取り消し、置き直しと待ったを1回ずつ数えること", () => {
    const next = undoReflectionSession(slashAtCenter);

    expect(next.board.cells[4]).toBeNull();
    expect(next.undoCount).toBe(1);
    expect(next.relocationCount).toBe(1);
    expect(canUndoReflectionSession(next)).toBe(false);
  });

  test("何段でも取り消せること", () => {
    const next = undoReflectionSession(undoReflectionSession(twoPlaced));

    expect(isEmptyBoard(next)).toBe(true);
    expect(next.undoCount).toBe(2);
  });

  test("選択だけの変更は取り消さないこと", () => {
    const next = undoReflectionSession(onlySelected);

    expect(canUndoReflectionSession(onlySelected)).toBe(false);
    expect(next).toBe(onlySelected);
  });
});

describe("restartReflectionSession", () => {
  test("全ピースをストックへ戻し、置き直しに数えず、待ったの履歴を消すこと", () => {
    const next = restartReflectionSession(slashAtCenter);

    expect(isEmptyBoard(next)).toBe(true);
    expect(next.restartCount).toBe(1);
    expect(next.relocationCount).toBe(0);
    expect(next.startedAt).toBe(startedAt);
    expect(canUndoReflectionSession(next)).toBe(false);
  });

  test("盤面が空なら何もしないこと", () => {
    const next = restartReflectionSession(initial);

    expect(canRestartReflectionSession(initial)).toBe(false);
    expect(next).toBe(initial);
  });
});

describe("replayReflectionSession", () => {
  test("同じ問題を記録なしの新しいプレイとして始めること", () => {
    const next = replayReflectionSession(slashAtCenter, 5_000);

    expect(next.problem).toBe(problem);
    expect(next.startedAt).toBe(5_000);
    expect(next.inputCount).toBe(0);
    expect(isEmptyBoard(next)).toBe(true);
  });
});

describe("getReflectionSessionElapsedMs", () => {
  test("プレイ中は現在時刻までの経過時間を返すこと", () => {
    const elapsedMs = getReflectionSessionElapsedMs(initial, 4_000);

    expect(elapsedMs).toBe(3_000);
  });
});

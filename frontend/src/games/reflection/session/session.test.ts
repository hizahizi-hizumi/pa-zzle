import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import {
  canRestartReflectionSession,
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionResult,
  getReflectionSessionStock,
  type ReflectionSession,
  removeReflectionSessionPiece,
  restartReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionClue,
  tapReflectionSessionStock,
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
  return session.puzzleState.cells.every((cell) => cell === null);
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

    test("同じ種類を押すと、選んだピースをストックへ戻し置き直しに数えること", () => {
      const next = tapReflectionSessionStock(selected, "slash", startedAt);

      expect(next.puzzleState.cells[4]).toBeNull();
      expect(getReflectionSessionStock(next).slash).toBe(1);
      expect(next.selection).toBeNull();
      expect(next.relocationCount).toBe(1);
    });

    test("別の種類を押すと、その種類に置き換えて選んでいたピースをストックへ戻し、置き直しに数えること", () => {
      const next = tapReflectionSessionStock(selected, "black-hole", startedAt);

      expect(next.puzzleState.cells[4]).toBe("black-hole");
      expect(getReflectionSessionStock(next)).toMatchObject({
        slash: 1,
        "black-hole": 0,
      });
      expect(next.selection).toBeNull();
      expect(next.relocationCount).toBe(1);
    });

    test("残りが無い別の種類を押しても何もしないこと", () => {
      const next = tapReflectionSessionStock(selected, "reflector", startedAt);

      expect(next).toBe(selected);
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

      expect(next.puzzleState.cells[4]).toBe("slash");
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

    test("ピースのあるマスでは置き換えず、そのピースを選ぶこと", () => {
      const next = tapReflectionSessionCell(selectedBlackHole, 4, startedAt);

      expect(next.puzzleState).toBe(selectedBlackHole.puzzleState);
      expect(next.selection).toEqual({ type: "cell", cellIndex: 4 });
      expect(next.relocationCount).toBe(0);
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

      expect(next.puzzleState.cells[4]).toBeNull();
      expect(next.puzzleState.cells[1]).toBe("slash");
      expect(next.selection).toBeNull();
      expect(next.relocationCount).toBe(1);
    });

    test("別のピースと入れ替え、1回の置き直しに数えること", () => {
      const next = tapReflectionSessionCell(
        selectedSlashWithBlackHole,
        1,
        startedAt,
      );

      expect(next.puzzleState.cells[4]).toBe("black-hole");
      expect(next.puzzleState.cells[1]).toBe("slash");
      expect(next.relocationCount).toBe(1);
    });

    test("同じマスを押すと盤面を変えずに選択を解除すること", () => {
      const next = tapReflectionSessionCell(selectedSlash, 4, startedAt);

      expect(next.selection).toBeNull();
      expect(next.puzzleState).toBe(slashAtCenter.puzzleState);
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
      laserCheckCount: 0,
      inputCount: 6,
    });
  });

  test("プレイ中は結果を返さないこと", () => {
    const result = getReflectionSessionResult(initial);

    expect(result).toBeNull();
  });
});

describe("restartReflectionSession", () => {
  test("全ピースをストックへ戻し、置き直しに数えず、経過時間を引き継ぐこと", () => {
    const next = restartReflectionSession(slashAtCenter);

    expect(isEmptyBoard(next)).toBe(true);
    expect(next.restartCount).toBe(1);
    expect(next.relocationCount).toBe(0);
    expect(next.startedAt).toBe(startedAt);
  });

  test("盤面が空なら何もしないこと", () => {
    const next = restartReflectionSession(initial);

    expect(canRestartReflectionSession(initial)).toBe(false);
    expect(next).toBe(initial);
  });
});

describe("tapReflectionSessionClue", () => {
  const topLeft = { side: "top", index: 0 } as const;
  const leftTop = { side: "left", index: 0 } as const;
  const checking = tapReflectionSessionClue(slashAtCenter, topLeft);

  test("押した位置の光路を表示し、光路を確かめた回数を数えること", () => {
    const next = tapReflectionSessionClue(slashAtCenter, topLeft);

    expect(next.laserEntry).toEqual(topLeft);
    expect(next.laserCheckCount).toBe(1);
    expect(next.puzzleState).toBe(slashAtCenter.puzzleState);
    expect(next.inputCount).toBe(slashAtCenter.inputCount);
  });

  test("別の位置を押すと、その位置の光路へ切り替えて数えること", () => {
    const next = tapReflectionSessionClue(checking, leftTop);

    expect(next.laserEntry).toEqual(leftTop);
    expect(next.laserCheckCount).toBe(2);
  });

  test("表示中の位置をもう一度押すと、数えずに閉じること", () => {
    const next = tapReflectionSessionClue(checking, topLeft);

    expect(next.laserEntry).toBeNull();
    expect(next.laserCheckCount).toBe(1);
  });

  describe("光路を表示したまま盤面が変わる場合", () => {
    const cases = [
      ["置く", placeFromStock(checking, "black-hole", 1)],
      ["盤面を戻す", restartReflectionSession(checking)],
    ] as const;

    test.each(cases)("光路を閉じること: %s", (_, next) => {
      const { laserEntry, laserCheckCount } = next;

      expect(laserEntry).toBeNull();
      expect(laserCheckCount).toBe(1);
    });
  });

  describe("ストックの種類を選んでいる場合", () => {
    const selecting = tapReflectionSessionStock(initial, "slash", startedAt);

    test("選択を保つこと", () => {
      const next = tapReflectionSessionClue(selecting, topLeft);

      expect(next.selection).toEqual({ type: "stock", piece: "slash" });
    });
  });
});

describe("removeReflectionSessionPiece", () => {
  const selectingPlaced = tapReflectionSessionCell(slashAtCenter, 4, startedAt);

  test("マスのピースをストックへ戻し、置き直しに数えること", () => {
    const next = removeReflectionSessionPiece(slashAtCenter, 4, startedAt);

    expect(next.puzzleState.cells[4]).toBeNull();
    expect(next.relocationCount).toBe(1);
  });

  test("選んでいた盤面のピースの選択を解除すること", () => {
    const next = removeReflectionSessionPiece(selectingPlaced, 4, startedAt);

    expect(next.selection).toBeNull();
  });

  test("空きマスでは何もしないこと", () => {
    const next = removeReflectionSessionPiece(slashAtCenter, 0, startedAt);

    expect(next).toBe(slashAtCenter);
  });
});

describe("clearReflectionSessionSelection", () => {
  const selecting = tapReflectionSessionStock(initial, "slash", startedAt);

  test("選択を解除し、操作として数えること", () => {
    const next = clearReflectionSessionSelection(selecting);

    expect(next.selection).toBeNull();
    expect(next.inputCount).toBe(selecting.inputCount + 1);
  });

  test("何も選んでいなければ何もしないこと", () => {
    const next = clearReflectionSessionSelection(initial);

    expect(next).toBe(initial);
  });
});

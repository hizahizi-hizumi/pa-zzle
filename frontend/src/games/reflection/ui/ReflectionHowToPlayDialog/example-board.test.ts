import { countReflectionBoardPieces } from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import { getReflectionSessionStock } from "@/games/reflection/session/session";
import type { ReflectionCueTarget } from "@/games/reflection/ui/board/cue";
import {
  clearReflectionExampleSelection,
  createReflectionExampleBoard,
  getReflectionExampleHint,
  getReflectionExampleLaser,
  hasReflectionExampleChanged,
  judgeReflectionExampleCompletion,
  listReflectionExampleClueMatches,
  listReflectionExampleReachableBoards,
  type ReflectionExampleBoard,
  removeReflectionExamplePiece,
  tapReflectionExample,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/example-board";
import {
  blackHoleRuleExamples,
  completionRuleExample,
  countRuleExamples,
  moveOperationExample,
  placeOperationExample,
  type ReflectionHowToPlayExample,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";

/** 例が見せる手のうち、先頭から `count` 手を順に押した姿。 */
function playHand(
  example: ReflectionHowToPlayExample,
  count: number,
): ReflectionExampleBoard {
  return example.hand
    .slice(0, count)
    .reduce(
      (board, target) => tapReflectionExample(board, example, target),
      createReflectionExampleBoard(example),
    );
}

describe("createReflectionExampleBoard", () => {
  const example = completionRuleExample;
  const board = createReflectionExampleBoard(example);

  test("本番と同じく、解き終えた盤面から外周の数字と手持ちを求めること", () => {
    const { problem } = board.session;

    expect(problem.clues).toEqual(computeReflectionClues(example.solution));
    expect(problem.inventory).toEqual(
      countReflectionBoardPieces(example.solution),
    );
  });

  test("例の始まりの盤面から、何も選ばず光路も出さずに始めること", () => {
    const { session } = board;

    expect(session.puzzleState).toEqual(example.board);
    expect(session.selection).toBeNull();
    expect(session.laserEntry).toBeNull();
  });

  test("ストックに、始まりの盤面に置いていないピースを残すこと", () => {
    const stock = getReflectionSessionStock(board.session);

    expect(stock["black-hole"]).toBe(1);
    expect(stock.slash).toBe(0);
  });

  test("手がかりを例が見せる手の最初の所に付けること", () => {
    const hint = getReflectionExampleHint(board, example);

    expect(hint).toEqual(example.hand[0]);
  });
});

describe("tapReflectionExample", () => {
  describe("例が見せる手のとおりに押した場合", () => {
    const example = placeOperationExample;
    const afterFirst = playHand(example, 1);
    const afterAll = playHand(example, example.hand.length);

    test("手がかりを次に押す所へ移すこと", () => {
      const hint = getReflectionExampleHint(afterFirst, example);

      expect(hint).toEqual(example.hand[1]);
    });

    test("手を打ち終えたら手がかりを消すこと", () => {
      const hint = getReflectionExampleHint(afterAll, example);

      expect(hint).toBeNull();
    });

    test("本番の操作と同じく、同じ種類が残る間は選んだまま続けて置くこと", () => {
      const { cells } = afterAll.session.puzzleState;

      expect(cells[0]).toBe("slash");
      expect(cells[8]).toBe("slash");
    });
  });

  describe("例が見せる手から外れた所を押した場合", () => {
    const example = moveOperationExample;
    const offHand: ReflectionCueTarget = { type: "cell", cellIndex: 8 };
    const board = tapReflectionExample(
      createReflectionExampleBoard(example),
      example,
      offHand,
    );
    const deselected = tapReflectionExample(board, example, offHand);

    test("手がかりを出さないこと", () => {
      const hint = getReflectionExampleHint(board, example);

      expect(hint).toBeNull();
    });

    test("選ぶ前に戻したら、最初の手がかりをまた出すこと", () => {
      const hint = getReflectionExampleHint(deselected, example);

      expect(hint).toEqual(example.hand[0]);
    });
  });

  describe("何も変わらない所を押した場合", () => {
    const example = moveOperationExample;
    const board = createReflectionExampleBoard(example);
    const next = tapReflectionExample(board, example, {
      type: "cell",
      cellIndex: 4,
    });

    test("姿を変えないこと", () => {
      expect(next).toBe(board);
    });
  });

  describe("外周の数字を押した場合", () => {
    const [, example] = countRuleExamples;
    const entry = example.focusEntry ?? { side: "left", index: 0 };
    const lit = tapReflectionExample(
      createReflectionExampleBoard(example),
      example,
      { type: "clue", entry },
    );
    const closed = tapReflectionExample(lit, example, { type: "clue", entry });

    test("本番と同じく、今の盤面でその位置から入れた光路を出すこと", () => {
      const laser = getReflectionExampleLaser(lit);

      expect(laser).toEqual({
        entry,
        trace: traceReflectionLaser(example.board, entry),
      });
    });

    test("もう一度押すと光路を閉じ、最初の手がかりをまた出すこと", () => {
      const laser = getReflectionExampleLaser(closed);
      const hint = getReflectionExampleHint(closed, example);

      expect(laser).toBeNull();
      expect(hint).toEqual(example.hand[0]);
    });
  });
});

describe("removeReflectionExamplePiece", () => {
  const example = moveOperationExample;
  const board = removeReflectionExamplePiece(
    createReflectionExampleBoard(example),
    example,
    0,
  );

  test("本番と同じく、マスのピースをストックに戻すこと", () => {
    const stock = getReflectionSessionStock(board.session);

    expect(board.session.puzzleState.cells[0]).toBeNull();
    expect(stock.slash).toBe(1);
  });

  test("例が見せる手ではないので、手がかりを出さないこと", () => {
    const hint = getReflectionExampleHint(board, example);

    expect(hint).toBeNull();
  });
});

describe("hasReflectionExampleChanged", () => {
  const example = moveOperationExample;
  const selected = playHand(example, 1);
  const moved = playHand(example, 2);
  const [lightExample] = countRuleExamples;
  const lit = playHand(lightExample, 1);

  test("選んだだけでは変わったとみなさないこと", () => {
    const changed = hasReflectionExampleChanged(selected, example);

    expect(changed).toBe(false);
  });

  test("盤面が変わったら変わったとみなすこと", () => {
    const changed = hasReflectionExampleChanged(moved, example);

    expect(changed).toBe(true);
  });

  test("光路を出したら変わったとみなすこと", () => {
    const changed = hasReflectionExampleChanged(lit, lightExample);

    expect(changed).toBe(true);
  });
});

describe("listReflectionExampleClueMatches", () => {
  const [example] = countRuleExamples;
  const board = createReflectionExampleBoard(example);

  test("本番の盤面と同じく、今の盤面の光で合っている数字を求めること", () => {
    const matches = listReflectionExampleClueMatches(board);

    expect(matches).toEqual(
      listReflectionClueMatches(
        example.board,
        computeReflectionClues(example.solution),
      ),
    );
  });
});

describe("judgeReflectionExampleCompletion", () => {
  const example = completionRuleExample;
  const misplaced = [
    { type: "stock", piece: "black-hole" },
    { type: "cell", cellIndex: 8 },
  ] as const satisfies readonly ReflectionCueTarget[];

  test.each([
    {
      name: "手持ちが残る間は途中とすること",
      board: createReflectionExampleBoard(example),
      expected: "incomplete",
    },
    {
      name: "例が見せる手を打ち終えたら、本番の判定で完成とすること",
      board: playHand(example, example.hand.length),
      expected: "solved",
    },
    {
      name: "置き切って合わない数字が残れば、合わないとすること",
      board: misplaced.reduce(
        (board: ReflectionExampleBoard, target) =>
          tapReflectionExample(board, example, target),
        createReflectionExampleBoard(example),
      ),
      expected: "unsolved",
    },
  ])("$name", ({ board, expected }) => {
    const completion = judgeReflectionExampleCompletion(board);

    expect(completion).toBe(expected);
  });
});

describe("clearReflectionExampleSelection", () => {
  const example = moveOperationExample;
  const selected = playHand(example, 1);
  const cleared = clearReflectionExampleSelection(selected, example);

  test("本番と同じく選んでいる物を解き、始まりの姿に戻れば最初の手がかりをまた出すこと", () => {
    const hint = getReflectionExampleHint(cleared, example);

    expect(cleared.session.selection).toBeNull();
    expect(hint).toEqual(example.hand[0]);
  });
});

describe("listReflectionExampleReachableBoards", () => {
  const [example] = blackHoleRuleExamples;
  const cellCount = example.board.cells.length;

  test("始まりの盤面・ピースを戻した盤面・ピースをほかのマスへ移した盤面を並べること", () => {
    const boards = listReflectionExampleReachableBoards(example);

    const holes = boards.map((board) => board.cells.indexOf("black-hole"));

    expect(boards).toHaveLength(1 + 1 + (cellCount - 1));
    expect(new Set(holes)).toEqual(
      new Set([-1, ...Array.from({ length: cellCount }, (_, index) => index)]),
    );
  });
});

import {
  chordMinesweeperExampleCell,
  createMinesweeperExampleBoard,
  findMinesweeperExampleNextMove,
  isMinesweeperExampleChanged,
  isMinesweeperExampleCleared,
  judgeMinesweeperExampleCandidates,
  listMinesweeperExampleSolveSteps,
  listMinesweeperExampleVisibleCells,
  revealMinesweeperExampleCell,
  toggleMinesweeperExampleFlag,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import {
  chordOperationExample,
  completionRuleExample,
  flagOperationExample,
  goalFigure,
  mineCountRuleExample,
  numberRuleExample,
  revealOperationExample,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";

describe("createMinesweeperExampleBoard", () => {
  describe("文字で書いた盤面の場合", () => {
    const rows = ["*x.F", "of.o"];

    test("地雷・開いたマス・旗・踏んだ地雷を、マスの番号で読むこと", () => {
      const example = createMinesweeperExampleBoard(rows);

      expect(example).toEqual({
        board: { rows: 2, columns: 4, mineCellIndices: [0, 1, 3] },
        puzzle: {
          revealedCellIndices: [4, 7],
          flaggedCellIndices: [3, 5],
          steppedMineCellIndices: [1],
        },
      });
    });
  });

  describe("知らない文字がある場合", () => {
    const rows = ["*?"];

    test("盤面を作らずに知らせること", () => {
      const create = () => createMinesweeperExampleBoard(rows);

      expect(create).toThrow("Unknown minesweeper how-to-play mark: ?");
    });
  });
});

describe("listMinesweeperExampleSolveSteps", () => {
  const goal = createMinesweeperExampleBoard(goalFigure);

  test("地雷を踏まずに開いていき、最後の姿で完成すること", () => {
    const steps = listMinesweeperExampleSolveSteps(goal);

    expect(
      steps.every((step) => step.puzzle.steppedMineCellIndices.length === 0),
    ).toBe(true);
    expect(isMinesweeperExampleCleared(steps.at(-1) ?? goal)).toBe(true);
    expect(steps.slice(0, -1).some(isMinesweeperExampleCleared)).toBe(false);
  });

  test("どの姿も、前の姿より開いたマスが増えること", () => {
    const steps = listMinesweeperExampleSolveSteps(goal);

    const counts = [goal, ...steps].map(
      (step) => step.puzzle.revealedCellIndices.length,
    );
    expect(
      counts.every(
        (count, index) => index === 0 || count > (counts[index - 1] ?? 0),
      ),
    ).toBe(true);
  });

  test("完成した最後の姿では、本番と同じく閉じていた地雷を見せること", () => {
    const steps = listMinesweeperExampleSolveSteps(goal);

    const mines = listMinesweeperExampleVisibleCells(
      steps.at(-1) ?? goal,
    ).flatMap((cell, cellIndex) => (cell.state === "mine" ? [cellIndex] : []));
    expect(mines).toEqual(goal.board.mineCellIndices);
  });
});

describe("judgeMinesweeperExampleCandidates", () => {
  describe("数字のルールの例の場合", () => {
    const example = createMinesweeperExampleBoard(numberRuleExample.rows);

    test("閉じたマスごとに、地雷のマスを地雷、ほかを地雷ではないとすること", () => {
      const candidates = judgeMinesweeperExampleCandidates(example);

      expect([...candidates]).toEqual([
        [1, "mine"],
        [2, "mine"],
        [3, "safe"],
        [7, "safe"],
      ]);
    });
  });

  describe("地雷の数のルールの例の場合", () => {
    const example = createMinesweeperExampleBoard(mineCountRuleExample.rows);

    test("数字の届かない左上の角を含めて、閉じたマスごとに札を付けること", () => {
      const candidates = judgeMinesweeperExampleCandidates(example);

      expect([...candidates]).toEqual([
        [0, "safe"],
        [1, "safe"],
        [3, "safe"],
        [4, "mine"],
      ]);
    });
  });

  describe("旗を置いたマスがある場合", () => {
    const example = toggleMinesweeperExampleFlag(
      createMinesweeperExampleBoard(flagOperationExample.rows),
      1,
    );

    test("押しても開かない旗のマスには札を付けないこと", () => {
      const candidates = judgeMinesweeperExampleCandidates(example);

      expect([...candidates.keys()]).toEqual([0, 2, 3, 4, 5]);
    });
  });

  describe("地雷ではないマスをすべて開いた場合", () => {
    const example = revealMinesweeperExampleCell(
      revealMinesweeperExampleCell(
        createMinesweeperExampleBoard(numberRuleExample.rows),
        3,
      ),
      7,
    );

    test("残りの地雷を本番の見え方で見せるので、札を付けないこと", () => {
      const candidates = judgeMinesweeperExampleCandidates(example);

      expect(candidates.size).toBe(0);
    });
  });
});

describe("findMinesweeperExampleNextMove", () => {
  const initial = createMinesweeperExampleBoard(numberRuleExample.rows);

  describe("最初の姿の場合", () => {
    test("例が見せる最初の手を返すこと", () => {
      const move = findMinesweeperExampleNextMove(
        initial,
        numberRuleExample.moves,
      );

      expect(move).toEqual({ cellIndex: 3, action: "reveal" });
    });
  });

  describe("最初の手を打った場合", () => {
    const example = revealMinesweeperExampleCell(initial, 3);

    test("次の手を返すこと", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        numberRuleExample.moves,
      );

      expect(move).toEqual({ cellIndex: 7, action: "reveal" });
    });
  });

  describe("例の手と違う地雷を踏んだ場合", () => {
    const example = revealMinesweeperExampleCell(initial, 1);

    test("まだ打っていない最初の手を返し続けること", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        numberRuleExample.moves,
      );

      expect(move).toEqual({ cellIndex: 3, action: "reveal" });
    });
  });

  describe("完成した場合", () => {
    const example = revealMinesweeperExampleCell(
      revealMinesweeperExampleCell(initial, 3),
      7,
    );

    test("手を返さないこと", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        numberRuleExample.moves,
      );

      expect(move).toBeNull();
    });
  });

  describe("まとめて開く例で、1を押した場合", () => {
    const example = chordMinesweeperExampleCell(
      createMinesweeperExampleBoard(chordOperationExample.rows),
      5,
    );

    test("手を打ち終えたとすること", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        chordOperationExample.moves,
      );

      expect(move).toBeNull();
    });
  });

  describe("旗の例で、旗を置いた場合", () => {
    const example = toggleMinesweeperExampleFlag(
      createMinesweeperExampleBoard(flagOperationExample.rows),
      1,
    );

    test("手を打ち終えたとすること", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        flagOperationExample.moves,
      );

      expect(move).toBeNull();
    });
  });

  describe("旗の例で、旗を置くマスを普通に押して開いた場合", () => {
    const example = revealMinesweeperExampleCell(
      createMinesweeperExampleBoard(flagOperationExample.rows),
      1,
    );

    test("地雷を踏まずに開き、旗を置けなくなった手を返さないこと", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        flagOperationExample.moves,
      );

      expect(example.puzzle.steppedMineCellIndices).toEqual([]);
      expect(move).toBeNull();
    });
  });

  describe("まとめて開く例で、旗を外した場合", () => {
    const flagRemoved = toggleMinesweeperExampleFlag(
      createMinesweeperExampleBoard(chordOperationExample.rows),
      1,
    );
    const flagReplaced = toggleMinesweeperExampleFlag(flagRemoved, 1);

    test("旗の数がそろわず押しても開かない間は手を返さず、旗を置き直すと返し直すこと", () => {
      const whileRemoved = findMinesweeperExampleNextMove(
        flagRemoved,
        chordOperationExample.moves,
      );
      const afterReplaced = findMinesweeperExampleNextMove(
        flagReplaced,
        chordOperationExample.moves,
      );

      expect(whileRemoved).toBeNull();
      expect(afterReplaced).toEqual({ cellIndex: 5, action: "chord" });
    });
  });

  describe("数字のルールの例で、手がかりのマスに旗を置いた場合", () => {
    const example = toggleMinesweeperExampleFlag(
      createMinesweeperExampleBoard(numberRuleExample.rows),
      3,
    );

    test("旗のマスは押しても開かないので、手を返さないこと", () => {
      const move = findMinesweeperExampleNextMove(
        example,
        numberRuleExample.moves,
      );

      expect(move).toBeNull();
    });
  });
});

describe("revealMinesweeperExampleCell", () => {
  describe("開き方の例の右下を開いた場合", () => {
    const example = createMinesweeperExampleBoard(revealOperationExample.rows);

    test("周りに地雷の無いマスから続けて開き、上の段を閉じたまま残すこと", () => {
      const next = revealMinesweeperExampleCell(example, 11);

      expect(next.puzzle.revealedCellIndices).toEqual([
        4, 5, 6, 7, 8, 9, 10, 11,
      ]);
      expect(isMinesweeperExampleCleared(next)).toBe(false);
    });
  });

  describe("完成のルールの例の最後のマスを開いた場合", () => {
    const example = createMinesweeperExampleBoard(completionRuleExample.rows);

    test("踏んだ地雷があっても完成すること", () => {
      const next = revealMinesweeperExampleCell(example, 3);

      expect(isMinesweeperExampleCleared(next)).toBe(true);
      expect(next.puzzle.steppedMineCellIndices).toEqual([1]);
    });
  });

  describe("完成した盤面の場合", () => {
    const example = revealMinesweeperExampleCell(
      createMinesweeperExampleBoard(completionRuleExample.rows),
      3,
    );

    test("本番と同じく何も変えないこと", () => {
      const next = revealMinesweeperExampleCell(example, 2);

      expect(next).toBe(example);
    });
  });

  describe("旗を置いたマスを開こうとした場合", () => {
    const example = toggleMinesweeperExampleFlag(
      createMinesweeperExampleBoard(flagOperationExample.rows),
      0,
    );

    test("本番と同じく開かないこと", () => {
      const next = revealMinesweeperExampleCell(example, 0);

      expect(next).toBe(example);
    });
  });
});

describe("chordMinesweeperExampleCell", () => {
  describe("まとめて開く例の1を押した場合", () => {
    const example = createMinesweeperExampleBoard(chordOperationExample.rows);

    test("1の周りの残りの4マスを開き、離れたマスを閉じたまま残すこと", () => {
      const next = chordMinesweeperExampleCell(example, 5);

      expect(next.puzzle.revealedCellIndices).toEqual([0, 2, 4, 5, 6]);
      expect(isMinesweeperExampleCleared(next)).toBe(false);
    });
  });
});

describe("isMinesweeperExampleChanged", () => {
  const initial = createMinesweeperExampleBoard(flagOperationExample.rows);

  test("旗を置くと、最初の姿から変わったとすること", () => {
    const changed = isMinesweeperExampleChanged(
      toggleMinesweeperExampleFlag(initial, 1),
      initial,
    );

    expect(changed).toBe(true);
  });

  test("旗を置いて外すと、最初の姿に戻ったとすること", () => {
    const changed = isMinesweeperExampleChanged(
      toggleMinesweeperExampleFlag(toggleMinesweeperExampleFlag(initial, 1), 1),
      initial,
    );

    expect(changed).toBe(false);
  });
});

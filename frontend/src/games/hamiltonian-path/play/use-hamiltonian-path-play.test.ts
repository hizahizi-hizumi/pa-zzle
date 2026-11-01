import { act, cleanup, renderHook } from "@testing-library/react";

import {
  createHamiltonianPathResult,
  useHamiltonianPathPlay,
} from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import { selectHamiltonianPathProblemForDifficulty } from "@/games/hamiltonian-path/problem-selection";
import { findHamiltonianPathDirection } from "@/games/hamiltonian-path/puzzle/board";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useHamiltonianPathPlay> };

const difficulty = "1";
const initialSeed = "use-hamiltonian-path-play-a";
const otherSeed = "use-hamiltonian-path-play-b";
const initial = selectHamiltonianPathProblemForDifficulty(
  difficulty,
  initialSeed,
);
const other = selectHamiltonianPathProblemForDifficulty(difficulty, otherSeed);
const { solution } = generateHamiltonianPathProblem(initial.identity);

/** マスを1つずつ押して離す。 */
function tapAll(result: HookResult, cells: readonly number[]): void {
  for (const cell of cells) {
    act(() => {
      result.current.beginStroke(cell);
      result.current.endStroke();
    });
  }
}

/** `cells` の先頭を押し、残りのマスを順になぞって離すまでを、1回の入力として流す。 */
function drag(
  result: HookResult,
  [pressed, ...cells]: readonly number[],
): void {
  act(() => {
    result.current.beginStroke(pressed!);
    let from = pressed!;
    for (const to of cells) {
      result.current.traceStroke({ from, to, horizontalFirst: true });
      from = to;
    }
    result.current.endStroke();
  });
}

/** 盤面の始点から上下左右に2マス以上離れた有効マス。 */
function findCellAwayFromStart(): number {
  const { size, start, walls } = initial.problem;
  const startRow = Math.floor(start / size);
  const startColumn = start % size;
  return Array.from({ length: size * size }, (_, cell) => cell).find(
    (cell) =>
      !walls.includes(cell) &&
      Math.abs(Math.floor(cell / size) - startRow) +
        Math.abs((cell % size) - startColumn) >=
        2,
  )!;
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useHamiltonianPathPlay", () => {
  let result: HookResult;

  beforeEach(() => {
    vi.mocked(createProblemSeed).mockReturnValueOnce(initialSeed);
    ({ result } = renderHook(() => useHamiltonianPathPlay(difficulty)));
  });

  test("seed で選んだ問題の、道が始点だけの盤面でプレイを始めること", () => {
    const { board, path, progress, problemIdentity } = result.current;

    expect(board).toEqual(initial.problem);
    expect(path).toEqual([initial.problem.start]);
    expect(progress).toBe("playing");
    expect(problemIdentity).toEqual(initial.identity);
  });

  test("先端に隣り合うマスを押すと道を延ばすこと", () => {
    tapAll(result, [solution[1]!]);

    expect(result.current.path).toEqual(solution.slice(0, 2));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRestart).toBe(true);
    expect(result.current.isDeadEnd).toBe(false);
  });

  test("1回のなぞりで通ったマスへ順に道を延ばし、待った1回で取り消せること", () => {
    drag(result, solution.slice(0, 5));
    const tracedPath = result.current.path;
    act(() => result.current.undo());

    expect(tracedPath).toEqual(solution.slice(0, 5));
    expect(result.current.path).toEqual([initial.problem.start]);
  });

  describe("先端から離れたマスを押した場合", () => {
    const cell = findCellAwayFromStart();

    test("道を変えず、阻まれた操作として先端と理由を残すこと", () => {
      tapAll(result, [cell]);

      expect(result.current.path).toEqual([initial.problem.start]);
      expect(result.current.blockedMove).toMatchObject({
        reason: "not-adjacent",
        head: initial.problem.start,
        direction: null,
      });
    });

    test("そのままなぞって先端の隣のマスへ入ると道を延ばすこと", () => {
      drag(result, [cell, solution[1]!]);

      expect(result.current.path).toEqual(solution.slice(0, 2));
    });
  });

  describe("阻まれた操作を残している場合", () => {
    const cell = findCellAwayFromStart();

    beforeEach(() => {
      tapAll(result, [solution[1]!, cell]);
    });

    const cases = [
      ["待った", "undo"],
      ["盤面を戻す", "restart"],
      ["リセット", "replay"],
    ] as const;

    test.each(cases)("%sで阻まれた操作を消すこと", (_, operation) => {
      act(() => result.current[operation]());

      expect(result.current.blockedMove).toBeNull();
    });
  });

  describe("道を延ばした後の場合", () => {
    const direction = findHamiltonianPathDirection(
      initial.problem.size,
      solution[3]!,
      solution[2]!,
    )!;

    beforeEach(() => {
      tapAll(result, solution.slice(1, 4));
    });

    test("来た向きへ先端を動かすと道を1マス縮めること", () => {
      act(() => result.current.moveHeadToward(direction));

      expect(result.current.path).toEqual(solution.slice(0, 3));
    });

    test("道の途中のマスを押すとそこまで巻き戻すこと", () => {
      tapAll(result, [solution[1]!]);

      expect(result.current.path).toEqual(solution.slice(0, 2));
    });

    test("待ったで直前の1操作を取り消すこと", () => {
      act(() => result.current.undo());

      expect(result.current.path).toEqual(solution.slice(0, 3));
    });

    test("盤面を戻すと道を始点だけにして待ったできなくなること", () => {
      act(() => result.current.restart());

      expect(result.current.path).toEqual([initial.problem.start]);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRestart).toBe(false);
    });
  });

  describe("全有効マスを通った場合", () => {
    beforeEach(() => {
      tapAll(result, solution.slice(1));
    });

    test("クリアして完成演出へ進むこと", () => {
      const { status, progress, completedAt } = result.current;

      expect(status).toBe("cleared");
      expect(progress).toBe("clearing");
      expect(completedAt).not.toBeNull();
    });

    test("プレイの事実と問題の作業の量から評価を返すこと", () => {
      const { startedAt, completedAt } = result.current;
      const playResult = result.current.result;

      expect(playResult).toEqual(
        createHamiltonianPathResult(
          {
            elapsedMs: completedAt! - startedAt,
            backtrackCount: 0,
            retractedCellCount: 0,
            undoCount: 0,
            restartCount: 0,
            inputCount: solution.length - 1,
          },
          initial.workload,
        ),
      );
    });

    test("完成演出を終えると結果表示へ進むこと", () => {
      act(() => result.current.completeClearAnimation());

      expect(result.current.progress).toBe("result");
    });

    test("リセットで同じ問題を新しいプレイとして始めること", () => {
      act(() => result.current.replay());

      expect(result.current.progress).toBe("playing");
      expect(result.current.path).toEqual([initial.problem.start]);
      expect(result.current.problemIdentity).toEqual(initial.identity);
    });
  });

  describe("引き直してからクリアした場合", () => {
    beforeEach(() => {
      tapAll(result, solution.slice(1, 4));
      act(() => result.current.restart());
      drag(result, solution);
    });

    test("盤面を戻した後に同じ道を引き直した分は引き直しに数えないこと", () => {
      const playResult = result.current.result;

      expect(playResult).toMatchObject({
        backtrackCount: 0,
        retractedCellCount: 3,
        restartCount: 1,
        inputCount: 4,
      });
    });
  });

  describe("プレイ中の場合", () => {
    test("評価を返さないこと", () => {
      const playResult = result.current.result;

      expect(playResult).toBeNull();
    });
  });

  describe("別の問題を始めた場合", () => {
    beforeEach(() => {
      vi.mocked(createProblemSeed).mockReturnValueOnce(otherSeed);
    });

    test("今の問題を避けて選んだ問題で始めること", () => {
      act(() => result.current.startNewProblem());

      expect(createProblemId(result.current.problemIdentity)).not.toBe(
        createProblemId(initial.identity),
      );
      expect(result.current.board).toEqual(other.problem);
    });
  });
});

describe("useHamiltonianPathPlay に最初の問題を渡した場合", () => {
  let result: HookResult;

  beforeEach(() => {
    ({ result } = renderHook(() => useHamiltonianPathPlay(difficulty, other)));
  });

  test("渡した問題で始めること", () => {
    const { board, problemIdentity } = result.current;

    expect(board).toEqual(other.problem);
    expect(problemIdentity).toEqual(other.identity);
  });
});

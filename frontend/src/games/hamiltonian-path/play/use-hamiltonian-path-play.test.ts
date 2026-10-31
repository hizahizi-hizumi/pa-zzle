import { act, cleanup, renderHook } from "@testing-library/react";

import { useHamiltonianPathPlay } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import { selectHamiltonianPathProblemForDifficulty } from "@/games/hamiltonian-path/problem-selection";
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

function extendAll(result: HookResult, cells: readonly number[]): void {
  for (const cell of cells) {
    act(() => result.current.extendPath(cell));
  }
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

  test("先端に隣り合うマスへ道を延ばすこと", () => {
    act(() => result.current.extendPath(solution[1]!));

    expect(result.current.path).toEqual(solution.slice(0, 2));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRestart).toBe(true);
  });

  describe("道を延ばした後の場合", () => {
    beforeEach(() => {
      extendAll(result, solution.slice(1, 4));
    });

    test("先端を直前のマスへ動かすと道を1マス縮めること", () => {
      act(() => result.current.moveHead(solution[2]!));

      expect(result.current.path).toEqual(solution.slice(0, 3));
    });

    test("道の途中のマスまで巻き戻すこと", () => {
      act(() => result.current.rewindPath(solution[1]!));

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
      extendAll(result, solution.slice(1));
    });

    test("クリアして完成演出へ進み、評価は持たないこと", () => {
      const { status, progress, completedAt } = result.current;

      expect(status).toBe("cleared");
      expect(progress).toBe("clearing");
      expect(completedAt).not.toBeNull();
      expect(result.current.result).toBeNull();
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

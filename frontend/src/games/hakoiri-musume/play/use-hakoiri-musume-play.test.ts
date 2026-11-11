import {
  act,
  cleanup,
  type RenderHookResult,
  renderHook,
} from "@testing-library/react";

import {
  type HakoiriMusumePlay,
  useHakoiriMusumePlay,
} from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import type { HakoiriMusumePooledProblem } from "@/games/hakoiri-musume/problem/problem-pool";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";

// 問題集から引く問題は、seed をそのまま identity の seed にした同じ盤面の問題にする（どの問題を引いたかを seed で見分ける）。
vi.mock("@/games/hakoiri-musume/problem-selection", async () => {
  const { parseHakoiriMusumeBoard } = await import(
    "@/games/hakoiri-musume/puzzle/board"
  );
  return {
    selectHakoiriMusumeProblemForDifficulty: (
      _difficulty: string,
      seed: string,
    ) => ({
      problem: { pieces: parseHakoiriMusumeBoard("v..vwssw.AAv.AAws...")! },
      identity: { generatorVersion: "1", seed, conditions: {} },
      workload: { optimalMoveCount: 1, preparationLength: 0 },
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * 娘が出口の1段上にいて、真下が空いている盤面（最短1手）。
 * 駒の番号: 0 左上の縦長、1 右上の縦長、2・3 上の小駒、4 娘、5 右の縦長、6 左下の小駒。
 */
const problem: HakoiriMusumePooledProblem = {
  problem: { pieces: parseHakoiriMusumeBoard("v..vwssw.AAv.AAws...")! },
  identity: {
    generatorVersion: "1",
    seed: "v..vwssw.AAv.AAws...",
    conditions: {},
  },
  workload: { optimalMoveCount: 1, preparationLength: 0 },
};

describe("useHakoiriMusumePlay", () => {
  let result: RenderHookResult<HakoiriMusumePlay, unknown>["result"];

  beforeEach(() => {
    result = renderHook(() => useHakoiriMusumePlay("1", problem)).result;
  });

  describe("同じ駒を続けて動かした場合", () => {
    test("1手と数え、待ったでまとめて戻すこと", () => {
      act(() => {
        result.current.movePiece(6, ["right"]);
        result.current.movePiece(6, ["right"]);
      });
      const afterMoves = result.current.moveCount;
      act(() => result.current.undo());

      expect(afterMoves).toBe(1);
      expect(result.current.pieces[6]).toEqual({ kind: "small", cell: 16 });
      expect(result.current.moveCount).toBe(1);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe("娘を出口の前へ運んだ場合", () => {
    test("クリア演出を経てから、最短手数との差を含む結果を出すこと", () => {
      act(() => result.current.movePiece(4, ["down"]));
      const progressWhileClearing = result.current.progress;
      act(() => result.current.completeClearAnimation());

      expect(progressWhileClearing).toBe("clearing");
      expect(result.current.progress).toBe("result");
      expect(result.current.result).toMatchObject({
        moveCount: 1,
        optimalMoveCount: 1,
        moveDelta: 0,
      });
    });
  });

  describe("待ったで取り消した手の後にクリアした場合", () => {
    test("指した手の数と別に、完成した盤面までの手の数を出すこと", () => {
      act(() => result.current.movePiece(6, ["right"]));
      act(() => result.current.undo());
      act(() => result.current.movePiece(4, ["down"]));

      expect(result.current.result).toMatchObject({
        moveCount: 2,
        completionMoveCount: 1,
      });
    });
  });

  describe("駒が移った場合", () => {
    test("移るたびに別の id の知らせを出し、動けない入力では変えず、待ったで消すこと", () => {
      act(() => result.current.movePiece(6, ["right"]));
      const first = result.current.stepNotice;
      act(() => result.current.movePiece(6, ["right"]));
      const second = result.current.stepNotice;
      act(() => result.current.movePiece(0, ["up"]));
      const afterBlocked = result.current.stepNotice;
      act(() => result.current.undo());

      expect(first).toMatchObject({
        pieceIndex: 6,
        kind: "small",
        from: 16,
        to: 17,
        cellCount: 1,
      });
      expect(second?.id).not.toBe(first?.id);
      expect(afterBlocked).toBe(second);
      expect(result.current.stepNotice).toBeNull();
    });
  });

  describe("1回の入力で続けて移った場合", () => {
    test("動けない向きの手前まで動かし、移ったマスの数を持つ知らせを1つ出すこと", () => {
      act(() =>
        result.current.movePiece(6, ["right", "right", "right", "right"]),
      );

      expect(result.current.pieces[6]).toEqual({ kind: "small", cell: 19 });
      expect(result.current.moveCount).toBe(1);
      expect(result.current.stepNotice).toMatchObject({
        pieceIndex: 6,
        from: 16,
        to: 19,
        cellCount: 3,
      });
    });
  });

  describe("動けない向きの場合", () => {
    test("手数も盤面も変えないこと", () => {
      act(() => result.current.movePiece(0, ["up"]));

      expect(result.current.pieces).toEqual(problem.problem.pieces);
      expect(result.current.moveCount).toBe(0);
    });
  });

  describe("盤面を戻した場合", () => {
    test("始めの盤面へ戻し、手数を引き継いで回数を数え、知らせを消すこと", () => {
      act(() => {
        result.current.movePiece(6, ["right"]);
        result.current.movePiece(0, ["down"]);
      });

      act(() => result.current.restart());

      expect(result.current.pieces).toEqual(problem.problem.pieces);
      expect(result.current.moveCount).toBe(2);
      expect(result.current.restartCount).toBe(1);
      expect(result.current.stepNotice).toBeNull();
      expect(result.current.canRestart).toBe(false);
    });
  });

  describe("リセットした場合", () => {
    test("同じ問題の新しいプレイを始めること", () => {
      const { problemIdentity } = result.current;
      act(() => result.current.movePiece(6, ["right"]));

      act(() => result.current.replay());

      expect(result.current.problemIdentity).toBe(problemIdentity);
      expect(result.current.pieces).toEqual(problem.problem.pieces);
      expect(result.current.moveCount).toBe(0);
      expect(result.current.restartCount).toBe(0);
      expect(result.current.stepNotice).toBeNull();
    });
  });
});

describe("最初に避ける問題を渡し、最初に引いた seed がその問題を指す場合", () => {
  let result: RenderHookResult<HakoiriMusumePlay, unknown>["result"];

  beforeEach(() => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("hakoiri-avoided")
      .mockReturnValueOnce("hakoiri-other");
    const avoidedProblemId = createProblemId({
      generatorVersion: "1",
      seed: "hakoiri-avoided",
      conditions: {},
    });
    ({ result } = renderHook(() =>
      useHakoiriMusumePlay("1", undefined, avoidedProblemId),
    ));
  });

  test("seed を引き直して避ける問題と別の問題で始めること", () => {
    expect(result.current.problemIdentity.seed).toBe("hakoiri-other");
  });
});

describe("別の問題で最初に引いた seed が今と同じ問題を指す場合", () => {
  let result: RenderHookResult<HakoiriMusumePlay, unknown>["result"];

  beforeEach(() => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("hakoiri-current")
      .mockReturnValueOnce("hakoiri-current")
      .mockReturnValueOnce("hakoiri-other");
    ({ result } = renderHook(() => useHakoiriMusumePlay("1")));
  });

  test("seed を引き直して今と別の問題を始めること", () => {
    act(() => result.current.startNewProblem());

    expect(result.current.problemIdentity.seed).toBe("hakoiri-other");
  });
});

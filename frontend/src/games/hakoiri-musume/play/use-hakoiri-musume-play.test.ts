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

afterEach(cleanup);

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
  optimalMoveCount: 1,
};

describe("useHakoiriMusumePlay", () => {
  let result: RenderHookResult<HakoiriMusumePlay, unknown>["result"];

  beforeEach(() => {
    result = renderHook(() => useHakoiriMusumePlay("1", problem)).result;
  });

  describe("同じ駒を続けて動かした場合", () => {
    test("1手と数え、待ったでまとめて戻すこと", () => {
      act(() => {
        result.current.movePiece(6, "right");
        result.current.movePiece(6, "right");
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
      act(() => result.current.movePiece(4, "down"));
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

  describe("駒が移った場合", () => {
    test("移るたびに別の id の知らせを出し、動けない入力では変えず、待ったで消すこと", () => {
      act(() => result.current.movePiece(6, "right"));
      const first = result.current.stepNotice;
      act(() => result.current.movePiece(6, "right"));
      const second = result.current.stepNotice;
      act(() => result.current.movePiece(0, "up"));
      const afterBlocked = result.current.stepNotice;
      act(() => result.current.undo());

      expect(first).toMatchObject({
        pieceIndex: 6,
        kind: "small",
        from: 16,
        to: 17,
      });
      expect(second?.id).not.toBe(first?.id);
      expect(afterBlocked).toBe(second);
      expect(result.current.stepNotice).toBeNull();
    });
  });

  describe("動けない向きの場合", () => {
    test("手数も盤面も変えないこと", () => {
      act(() => result.current.movePiece(0, "up"));

      expect(result.current.pieces).toEqual(problem.problem.pieces);
      expect(result.current.moveCount).toBe(0);
    });
  });
});

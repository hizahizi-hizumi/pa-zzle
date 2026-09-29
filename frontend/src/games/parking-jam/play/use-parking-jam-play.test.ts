import { act, cleanup, renderHook } from "@testing-library/react";

import {
  assessParkingJamDifficulty,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import { useParkingJamPlay } from "@/games/parking-jam/play/use-parking-jam-play";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import * as problemSeed from "@/games/problem-seed";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useParkingJamPlay>;

describe("useParkingJamPlay", () => {
  const difficultyCases = [
    ["1", "parking-jam-level-1-selection"],
    ["2", "parking-jam-level-2-selection"],
    ["3", "parking-jam-level-3-selection"],
    ["4", "parking-jam-level-4-selection"],
    ["5", "parking-jam-level-5-selection"],
  ] as const;

  describe.each(difficultyCases)("%s の場合", (difficulty, seed) => {
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);
      ({ result } = renderHook(() => useParkingJamPlay(difficulty)));
    });

    test("対応するレベルの問題集の問題でプレイを開始すること", () => {
      const generated = restoreParkingJamProblem(
        result.current.problemIdentity,
      );

      const assessment = assessParkingJamDifficulty(
        generated.difficultyAnalysis,
      );

      expect(assessment).toMatchObject({ status: "classified", difficulty });
      expect(result.current.problemSource).toBe("pool");
      expect(result.current.board).toEqual(generated.problem.board);
    });
  });

  describe("開始時に問題を指定する場合", () => {
    const given = selectParkingJamProblemForDifficulty("5", "given-problem");
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "parking-jam-level-1-selection",
      );
      ({ result } = renderHook(() => useParkingJamPlay("1", given)));
    });

    test("指定した問題でプレイを開始すること", () => {
      const { problemIdentity, problemSource, board } = result.current;

      expect(problemIdentity).toEqual(given.identity);
      expect(problemSource).toBe("given");
      expect(board).toEqual(given.problem.board);
    });

    test("新しい問題は開始時のレベルの問題集から選ぶこと", () => {
      act(() => result.current.startNewProblem());

      expect(result.current.problemSource).toBe("pool");
      expect(result.current.problemIdentity).toEqual(
        selectParkingJamProblemForDifficulty(
          "1",
          "parking-jam-level-1-selection",
        ).identity,
      );
    });
  });

  describe("問題を最後まで解く場合", () => {
    const difficulty: ParkingJamDifficulty = "3";
    let result: { current: HookResult };
    let solution: ReturnType<
      typeof restoreParkingJamProblem
    >["solvabilityAnalysis"]["solution"];

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "parking-jam-level-3-selection",
      );
      ({ result } = renderHook(() => useParkingJamPlay(difficulty)));
      solution = restoreParkingJamProblem(result.current.problemIdentity)
        .solvabilityAnalysis.solution;
    });

    test("車と方向を直接指定する操作だけでクリアできること", () => {
      for (const move of solution) {
        act(() => result.current.attemptMove(move.vehicleId, move.direction));
      }

      expect(result.current.status).toBe("cleared");
      expect(result.current.progress).toBe("clearing");
      expect(result.current.state.remainingVehicleIds).toEqual([]);
      expect(result.current.successfulMoveCount).toBe(solution.length);
      expect(result.current.failedMoveCount).toBe(0);
    });

    test("最後の出庫演出が完了してから結果へ進むこと", () => {
      for (const move of solution) {
        act(() => result.current.attemptMove(move.vehicleId, move.direction));
      }
      act(() => result.current.completeClearAnimation());

      expect(result.current.progress).toBe("result");
      expect(result.current.result?.score.total).toBeGreaterThanOrEqual(0);
    });

    test("採点の基準時間を問題の初期に塞がれた車から求めること", () => {
      const { features } = restoreParkingJamProblem(
        result.current.problemIdentity,
      ).difficultyAnalysis;
      for (const move of solution) {
        act(() => result.current.attemptMove(move.vehicleId, move.direction));
      }

      const speedReference = result.current.result?.speedReference;

      expect(speedReference).toEqual({
        vehicleCount: features.vehicleCount,
        initialBlockedVehicleCount:
          features.vehicleCount - features.initialLegalVehicleCount,
      });
    });

    test("クリア前は同じ問題の新しいプレイを始めず計数を保つこと", () => {
      const firstMove = solution[0];
      if (!firstMove) throw new Error("Expected a solution move");
      act(() =>
        result.current.attemptMove(firstMove.vehicleId, firstMove.direction),
      );
      act(() => result.current.undo());

      act(() => result.current.replay());

      expect(result.current.undoCount).toBe(1);
      expect(result.current.moveAttemptCount).toBe(1);
    });

    test("盤面が進んだときだけやり直し可能になること", () => {
      const firstMove = solution[0];
      if (!firstMove) throw new Error("Expected a solution move");

      expect(result.current.canRestart).toBe(false);
      act(() =>
        result.current.attemptMove(firstMove.vehicleId, firstMove.direction),
      );

      expect(result.current.canRestart).toBe(true);
      act(() => result.current.undo());

      expect(result.current.canRestart).toBe(false);
    });
  });
});

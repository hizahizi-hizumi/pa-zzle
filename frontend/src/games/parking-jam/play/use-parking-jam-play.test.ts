import { act, cleanup, renderHook } from "@testing-library/react";

import {
  assessParkingJamDifficulty,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import * as problemSeed from "@/games/problem-seed";
import { useParkingJamPlay } from "./use-parking-jam-play";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useParkingJamPlay>;

describe("useParkingJamPlay", () => {
  const difficultyCases = [
    ["easy", "parking-jam-easy-selection"],
    ["normal", "parking-jam-normal-selection"],
    ["hard", "parking-jam-hard-selection"],
  ] as const;

  describe.each(difficultyCases)("%s の場合", (difficulty, seed) => {
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);
      ({ result } = renderHook(() => useParkingJamPlay(difficulty)));
    });

    test("対応する難易度の問題でプレイを開始すること", () => {
      const generated = restoreParkingJamProblem(
        result.current.problemIdentity,
      );
      const assessment = assessParkingJamDifficulty(
        generated.difficultyAnalysis,
      );

      expect(assessment).toMatchObject({ status: "rated", difficulty });
    });
  });

  describe("問題を最後まで解く場合", () => {
    const difficulty: ParkingJamDifficulty = "normal";
    let result: { current: HookResult };
    let solution: ReturnType<
      typeof restoreParkingJamProblem
    >["solvabilityAnalysis"]["solution"];

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "parking-jam-normal-selection",
      );
      ({ result } = renderHook(() => useParkingJamPlay(difficulty)));
      solution = restoreParkingJamProblem(result.current.problemIdentity)
        .solvabilityAnalysis.solution;
    });

    test("車を選んで方向を指定する操作だけでクリアできること", () => {
      for (const move of solution) {
        act(() => result.current.selectVehicle(move.vehicleId));
        act(() => result.current.attemptDirection(move.direction));
      }

      expect(result.current.status).toBe("cleared");
      expect(result.current.state.remainingVehicleIds).toEqual([]);
      expect(result.current.successfulMoveCount).toBe(solution.length);
      expect(result.current.failedMoveCount).toBe(0);
    });

    test("盤面が進んだときだけやり直し可能になること", () => {
      const firstMove = solution[0];
      if (!firstMove) throw new Error("Expected a solution move");

      expect(result.current.canRestart).toBe(false);

      act(() => result.current.selectVehicle(firstMove.vehicleId));
      act(() => result.current.attemptDirection(firstMove.direction));

      expect(result.current.canRestart).toBe(true);

      act(() => result.current.undo());

      expect(result.current.canRestart).toBe(false);
    });

    test("別の車を選択したとき直前操作のフィードバックを閉じること", () => {
      const firstMove = solution[0];
      const secondMove = solution[1];
      if (!firstMove || !secondMove) {
        throw new Error("Expected at least two solution moves");
      }

      act(() => result.current.selectVehicle(firstMove.vehicleId));
      act(() => result.current.attemptDirection(firstMove.direction));
      expect(result.current.operation?.type).toBe("exited");

      act(() => result.current.selectVehicle(secondMove.vehicleId));

      expect(result.current.operation).toBeNull();
    });
  });
});

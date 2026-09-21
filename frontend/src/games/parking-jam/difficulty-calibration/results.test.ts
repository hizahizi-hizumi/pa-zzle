// @vitest-environment jsdom
import {
  clearParkingJamCalibrationResults,
  loadParkingJamCalibrationResults,
  type ParkingJamCalibrationComparisonResult,
  saveParkingJamCalibrationResults,
} from "./results";

const result: ParkingJamCalibrationComparisonResult = {
  comparisonId: "scale-vs-structure",
  left: {
    problemId: "small-deep",
    elapsedMs: 10_000,
    firstMoveMs: 1_000,
    failedMoveCount: 1,
    undoCount: 0,
    restartCount: 0,
  },
  right: {
    problemId: "large-shallow",
    elapsedMs: 12_000,
    firstMoveMs: 2_000,
    failedMoveCount: 0,
    undoCount: 1,
    restartCount: 0,
  },
  judgement: "left-harder",
};

describe("calibration result storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearParkingJamCalibrationResults();
  });

  test("比較結果を保存して復元できること", () => {
    saveParkingJamCalibrationResults([result]);
    const restored = loadParkingJamCalibrationResults();

    expect(restored).toEqual([result]);
  });

  describe("localStorageを利用できない環境の場合", () => {
    beforeEach(() => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
    });

    test("同一セッション内のメモリへ保存できること", () => {
      saveParkingJamCalibrationResults([result]);
      const restored = loadParkingJamCalibrationResults();

      expect(restored).toEqual([result]);
    });
  });
});

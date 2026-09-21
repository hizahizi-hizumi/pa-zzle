import type {
  ParkingJamDifficultyCalibrationComparison,
  ParkingJamDifficultyCalibrationProblemId,
} from "../difficulty-calibration";

const STORAGE_KEY = "pa-zzle:parking-jam:difficulty-calibration:r3";

export type ParkingJamCalibrationTrialResult = {
  problemId: ParkingJamDifficultyCalibrationProblemId;
  elapsedMs: number;
  firstMoveMs: number | null;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

export type ParkingJamCalibrationJudgement =
  | "left-harder"
  | "similar"
  | "right-harder";

export type ParkingJamCalibrationComparisonResult = {
  comparisonId: ParkingJamDifficultyCalibrationComparison["id"];
  left: ParkingJamCalibrationTrialResult;
  right: ParkingJamCalibrationTrialResult;
  judgement: ParkingJamCalibrationJudgement;
};

let memoryResults: ParkingJamCalibrationComparisonResult[] = [];

function readLocalStorage(): ParkingJamCalibrationComparisonResult[] | null {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? (parsed as ParkingJamCalibrationComparisonResult[])
      : [];
  } catch {
    return null;
  }
}

function writeLocalStorage(
  results: readonly ParkingJamCalibrationComparisonResult[],
): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    return true;
  } catch {
    return false;
  }
}

export function loadParkingJamCalibrationResults(): ParkingJamCalibrationComparisonResult[] {
  if (typeof window === "undefined") return [...memoryResults];
  const stored = readLocalStorage();
  return stored === null ? [...memoryResults] : stored;
}

export function saveParkingJamCalibrationResults(
  results: readonly ParkingJamCalibrationComparisonResult[],
): void {
  memoryResults = [...results];
  if (typeof window !== "undefined") writeLocalStorage(results);
}

export function clearParkingJamCalibrationResults(): void {
  memoryResults = [];
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Memory storage remains the fallback when browser storage is unavailable.
  }
}

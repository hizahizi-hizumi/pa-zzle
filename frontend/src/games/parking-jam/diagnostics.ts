import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
  type ParkingJamDifficultyAssessment,
} from "@/games/parking-jam/difficulty";
import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import {
  restoreParkingJamProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import {
  PARKING_JAM_GENERATOR_VERSION,
  type ParkingJamProblemIdentity,
} from "@/games/parking-jam/problem/problem";

export const PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION = 3;

export type ParkingJamDiagnosticSnapshot = {
  formatVersion: typeof PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION;
  game: "parking-jam";
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  difficultyModelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
  difficultyAssessment: ParkingJamDifficultyAssessment;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
  buildRevision: string | null;
};

/**
 * 遊んでいる問題を identity から解析し直して内部診断の snapshot を作る。
 * プレイ時には解析しないため、診断を開いたときだけ呼ぶ。
 */
export function createParkingJamDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  buildRevision: string | null;
}): ParkingJamDiagnosticSnapshot {
  const { difficultyAnalysis } = restoreParkingJamProblem(problemIdentity);
  return {
    formatVersion: PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION,
    game: "parking-jam",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    difficultyAssessment: assessParkingJamDifficulty(difficultyAnalysis),
    difficultyAnalysis: {
      ...difficultyAnalysis,
      features: { ...difficultyAnalysis.features },
    },
    buildRevision,
  };
}

export function serializeParkingJamDiagnosticSnapshot(
  snapshot: ParkingJamDiagnosticSnapshot,
): string {
  return JSON.stringify(snapshot, null, 2);
}

// 内部診断が有効なビルドで、特定の問題を遊ぶための URL クエリ。
// 例: ?seed=pj5-current-32&board=8x8&vehicles=11&openings=4x3&fixed=0x1&blocking=0.5&attempt=1
const problemQueryKeys = [
  "seed",
  "board",
  "vehicles",
  "openings",
  "fixed",
  "blocking",
  "attempt",
] as const;

export function hasParkingJamProblemQuery(params: URLSearchParams): boolean {
  return problemQueryKeys.some((key) => params.has(key));
}

export function formatParkingJamProblemQuery(
  identity: ParkingJamProblemIdentity,
): string {
  const { conditions } = identity;
  return new URLSearchParams({
    seed: identity.seed,
    board: `${conditions.width}x${conditions.height}`,
    vehicles: String(conditions.vehicleCount),
    openings: `${conditions.roadOpeningCount}x${conditions.roadOpeningSpan}`,
    fixed: `${conditions.fixedAreaCount}x${conditions.fixedAreaLength}`,
    blocking: String(conditions.blockingPlacementProbability),
    attempt: String(identity.generationAttempt),
  }).toString();
}

function parseNumberPair(
  value: string | null,
): readonly [number, number] | null {
  const match = value?.match(/^(\d+)x(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * URL クエリから問題 identity を読み、その問題を復元できることまで確かめる。
 * 値が欠けている・生成器が問題を作れない場合は null を返す。
 */
export function parseParkingJamProblemQuery(
  params: URLSearchParams,
): ParkingJamProblemIdentity | null {
  const seed = params.get("seed");
  const board = parseNumberPair(params.get("board"));
  const openings = parseNumberPair(params.get("openings"));
  const fixed = parseNumberPair(params.get("fixed"));
  const vehicleCount = parseNumber(params.get("vehicles"));
  const blockingPlacementProbability = parseNumber(params.get("blocking"));
  const generationAttempt = parseNumber(params.get("attempt"));
  if (
    !seed ||
    !board ||
    !openings ||
    !fixed ||
    vehicleCount === null ||
    blockingPlacementProbability === null ||
    generationAttempt === null
  ) {
    return null;
  }

  const identity: ParkingJamProblemIdentity = {
    generatorVersion: PARKING_JAM_GENERATOR_VERSION,
    seed,
    conditions: {
      width: board[0],
      height: board[1],
      vehicleCount,
      roadOpeningCount: openings[0],
      roadOpeningSpan: openings[1],
      fixedAreaCount: fixed[0],
      fixedAreaLength: fixed[1],
      blockingPlacementProbability,
    },
    generationAttempt,
  };
  try {
    restoreParkingJamProblemWithoutAnalysis(identity);
  } catch {
    return null;
  }
  return identity;
}

import {
  createParkingJamDiagnosticSnapshot,
  formatParkingJamProblemQuery,
  hasParkingJamProblemQuery,
  PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION,
  parseParkingJamProblemQuery,
  serializeParkingJamDiagnosticSnapshot,
} from "@/games/parking-jam/diagnostics";
import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";

const selected = selectParkingJamProblemForDifficulty(
  "3",
  "parking-jam-diagnostics",
);

describe("createParkingJamDiagnosticSnapshot", () => {
  const snapshot = createParkingJamDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });

  test("問題identityから解析し直した難易度特徴と判定を保持すること", () => {
    const { difficultyAnalysis } = restoreParkingJamProblem(selected.identity);

    const serialized = serializeParkingJamDiagnosticSnapshot(snapshot);

    expect(snapshot.formatVersion).toBe(PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION);
    expect(snapshot.formatVersion).toBe(3);
    expect(snapshot.problemIdentity).toEqual(selected.identity);
    expect(snapshot.difficultyAnalysis).toEqual(difficultyAnalysis);
    expect(snapshot.difficultyModelVersion).toBe(
      PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    );
    expect(snapshot.difficultyAssessment).toMatchObject({
      status: "classified",
      difficulty: "3",
    });
    expect(serialized).toContain('"difficultyAssessment"');
  });
});

describe("parseParkingJamProblemQuery", () => {
  const studyIdentity: ParkingJamProblemIdentity = {
    generatorVersion: "2",
    seed: "pj5-current-32",
    conditions: {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 0.5,
    },
    generationAttempt: 1,
  };
  const query = formatParkingJamProblemQuery(studyIdentity);

  test("書き出したクエリを読み込むと同じ identity に戻ること", () => {
    const identity = parseParkingJamProblemQuery(new URLSearchParams(query));

    expect(identity).toEqual(studyIdentity);
  });

  test("人が読める形のクエリにすること", () => {
    const params = new URLSearchParams(query);

    const summary = Object.fromEntries(params);

    expect(summary).toEqual({
      seed: "pj5-current-32",
      board: "8x8",
      vehicles: "11",
      openings: "4x3",
      fixed: "0x1",
      blocking: "0.5",
      attempt: "1",
    });
  });

  const invalidQueries = [
    ["値が欠けている", "seed=pj5-current-3&board=8x8"],
    ["盤面の形式が違う", query.replace("board=8x8", "board=8")],
    ["生成器が作れない条件", query.replace("vehicles=11", "vehicles=40")],
  ] as const;

  test.each(invalidQueries)(
    "復元できないクエリを拒否すること: %s",
    (_label, invalidQuery) => {
      const identity = parseParkingJamProblemQuery(
        new URLSearchParams(invalidQuery),
      );

      expect(identity).toBeNull();
    },
  );
});

describe("hasParkingJamProblemQuery", () => {
  const cases = [
    ["seed=abc", true],
    ["attempt=1", true],
    ["", false],
    ["utm=abc", false],
  ] as const;

  test.each(cases)(
    "問題指定のクエリを含むかを判定すること: %s",
    (query, expected) => {
      const result = hasParkingJamProblemQuery(new URLSearchParams(query));

      expect(result).toBe(expected);
    },
  );
});

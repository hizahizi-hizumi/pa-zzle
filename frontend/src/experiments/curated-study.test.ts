import { describe, expect, test } from "vitest";
import {
  type CuratedStudyGameId,
  curatedStudyGames,
  getCuratedCandidatePlayUrl,
  getCuratedRandomPlayUrl,
} from "@/experiments/curated-study";
import {
  decodeNanpurePoolProblem,
  findNanpurePoolEntryByProblemId,
  toNanpurePoolIdentity,
} from "@/games/nanpure/problem/problem-pool";
import {
  findParkingJamPoolEntryByProblemId,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

const gameIds = ["nanpure", "parking-jam"] as const;
const setIds = ["a", "b"] as const;

const eachCandidate = gameIds.flatMap((gameId) =>
  setIds.flatMap((setId) =>
    curatedStudyGames[gameId].sets[setId].map((candidate) => ({
      gameId,
      setId,
      candidate,
    })),
  ),
);

function getCandidateIdentity(
  gameId: CuratedStudyGameId,
  candidate: { difficulty: "1" | "2" | "3" | "4" | "5"; problemId: string },
) {
  if (gameId === "nanpure") {
    const entry = findNanpurePoolEntryByProblemId(
      candidate.difficulty,
      candidate.problemId,
    );
    return entry === null ? null : toNanpurePoolIdentity(entry);
  }
  const entry = findParkingJamPoolEntryByProblemId(
    candidate.difficulty,
    candidate.problemId,
  );
  return entry === null ? null : toParkingJamPoolIdentity(entry);
}

describe("curatedStudyGames", () => {
  test.each(gameIds)(
    "%s の比較セットは重複せず、レベル配列が対応すること",
    (gameId) => {
      const a = curatedStudyGames[gameId].sets.a;
      const b = curatedStudyGames[gameId].sets.b;
      const levels = ["3", "4", "5", "3", "4", "5"];

      expect(a.map(({ difficulty }) => difficulty)).toEqual(levels);
      expect(b.map(({ difficulty }) => difficulty)).toEqual(levels);
      expect(new Set([...a, ...b].map(({ problemId }) => problemId)).size).toBe(
        a.length + b.length,
      );
    },
  );

  test.each(eachCandidate)(
    "$gameId / $setId の $candidate.problemId は元問題集に存在し、IDとseedが一致すること",
    ({ gameId, candidate }) => {
      const identity = getCandidateIdentity(gameId, candidate);
      expect(identity).not.toBeNull();
      expect(identity?.seed).toBe(candidate.seed);
      expect(identity && createProblemId(identity)).toBe(candidate.problemId);
    },
  );

  test.each(gameIds)(
    "%s の比較セットは問題の規模を対応させること",
    (gameId) => {
      for (let index = 0; index < 6; index += 1) {
        const a = curatedStudyGames[gameId].sets.a[index];
        const b = curatedStudyGames[gameId].sets.b[index];
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        if (!a || !b) continue;
        if (gameId === "nanpure") {
          const entryA = findNanpurePoolEntryByProblemId(
            a.difficulty,
            a.problemId,
          );
          const entryB = findNanpurePoolEntryByProblemId(
            b.difficulty,
            b.problemId,
          );
          expect(entryA).not.toBeNull();
          expect(entryB).not.toBeNull();
          if (!entryA || !entryB) continue;
          const cluesA = decodeNanpurePoolProblem(entryA[2]).clues;
          const cluesB = decodeNanpurePoolProblem(entryB[2]).clues;
          expect(cluesA.filter((value) => value !== null).length).toBe(
            cluesB.filter((value) => value !== null).length,
          );
          continue;
        }
        const identityA = getCandidateIdentity(gameId, a);
        const identityB = getCandidateIdentity(gameId, b);
        expect(identityA).not.toBeNull();
        expect(identityB).not.toBeNull();
        if (!identityA || !identityB) continue;
        if (
          !("width" in identityA.conditions) ||
          !("width" in identityB.conditions)
        )
          continue;
        const {
          width,
          height,
          vehicleCount,
          fixedAreaCount,
          roadOpeningCount,
        } = identityA.conditions;
        expect(identityB.conditions).toMatchObject({
          width,
          height,
          vehicleCount,
          fixedAreaCount,
          roadOpeningCount,
        });
      }
    },
  );
});

describe("getCuratedCandidatePlayUrl", () => {
  test.each(eachCandidate)(
    "$gameId / $setId の候補 $candidate.problemId を既存プレイ画面で開くこと",
    ({ gameId, candidate }) => {
      expect(getCuratedCandidatePlayUrl(gameId, candidate)).toBe(
        `/puzzles/${gameId}/play/${candidate.difficulty}?problem=${candidate.problemId}`,
      );
    },
  );
});

describe("getCuratedRandomPlayUrl", () => {
  test.each(gameIds)(
    "%s のランダム出題に問題IDを指定しないこと",
    (gameId: CuratedStudyGameId) => {
      expect(getCuratedRandomPlayUrl(gameId, "3")).toBe(
        `/puzzles/${gameId}/play/3`,
      );
    },
  );
});

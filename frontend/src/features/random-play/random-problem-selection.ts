import {
  randomProblemSettings,
  randomProblemStatuses,
} from "@/features/random-play/random-problem-settings";
import {
  readPlayAttempts,
  readPlayRecords,
} from "@/features/records/read-play-history";
import {
  deriveGameZukan,
  getZukanProblemStatus,
  type ZukanGameSource,
} from "@/features/zukan/zukan-collection";
import type { DifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";

export function listRandomProblemCandidates(
  game: ZukanGameSource,
  difficulty: DifficultyLevel,
  avoidedProblemId?: ProblemId,
): readonly ProblemId[] {
  const selected = randomProblemSettings.getEffective(game.id);
  const pool = game.listPoolProblemIds(difficulty);
  if (selected.length === randomProblemStatuses.length) {
    return pool.filter((id) => id !== avoidedProblemId);
  }
  const zukan = deriveGameZukan(game, readPlayRecords(), readPlayAttempts());
  const section = zukan.sections.find((item) => item.difficulty === difficulty);
  if (!section) return [];
  const statuses = new Set(selected);
  return section.problems
    .filter(
      (problem) =>
        problem.problemId !== avoidedProblemId &&
        statuses.has(getZukanProblemStatus(problem)),
    )
    .map((problem) => problem.problemId);
}

export function selectRandomProblemId(
  game: ZukanGameSource,
  difficulty: DifficultyLevel,
  avoidedProblemId?: ProblemId,
): ProblemId | null {
  const candidates = listRandomProblemCandidates(
    game,
    difficulty,
    avoidedProblemId,
  );
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export function selectAnyRandomProblemId(
  game: ZukanGameSource,
  difficulty: DifficultyLevel,
  avoidedProblemId?: ProblemId,
): ProblemId | null {
  const candidates = game
    .listPoolProblemIds(difficulty)
    .filter((id) => id !== avoidedProblemId);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

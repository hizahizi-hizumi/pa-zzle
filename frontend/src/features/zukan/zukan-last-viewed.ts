import {
  type GameZukan,
  getZukanProblemStatus,
  type ZukanProblemStatus,
} from "@/features/zukan/zukan-collection";
import type { DifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import {
  type GameResultLevel,
  getGameResultLevel,
  isHigherGameResultLevel,
} from "@/games/result";

export type ZukanViewedStatus = Exclude<ZukanProblemStatus, "untouched">;

export type ZukanViewedSection = Readonly<Record<ProblemId, ZukanViewedStatus>>;

/** 持たない難易度は、まだ見たことが無いものとする。 */
export type ZukanViewedStatuses = Partial<
  Record<DifficultyLevel, ZukanViewedSection>
>;

export type ZukanProblemChange =
  | { kind: "newly-solved"; previousStatus: "attempted" | "untouched" }
  | { kind: "raised"; previousStatus: GameResultLevel };

export type ZukanChanges = {
  /** 変化の無い難易度は持たない。 */
  byDifficulty: Partial<
    Record<DifficultyLevel, ReadonlyMap<ProblemId, ZukanProblemChange>>
  >;
};

export const noZukanChanges: ZukanChanges = { byDifficulty: {} };

export function listZukanViewedStatuses(
  zukan: GameZukan,
  difficulties: readonly DifficultyLevel[],
): ZukanViewedStatuses {
  const statuses: ZukanViewedStatuses = {};
  for (const { difficulty, problems } of zukan.sections) {
    if (!difficulties.includes(difficulty)) {
      continue;
    }
    const section: Record<ProblemId, ZukanViewedStatus> = {};
    for (const problem of problems) {
      const status = getZukanProblemStatus(problem);
      if (status !== "untouched") {
        section[problem.problemId] = status;
      }
    }
    statuses[difficulty] = section;
  }
  return statuses;
}

export function listUnchangedZukanDifficulties(
  zukan: GameZukan,
  changes: ZukanChanges,
): DifficultyLevel[] {
  return zukan.sections
    .map(({ difficulty }) => difficulty)
    .filter((difficulty) => changes.byDifficulty[difficulty] === undefined);
}

function findProblemChange(
  level: GameResultLevel,
  previousStatus: ZukanViewedStatus | undefined,
): ZukanProblemChange | null {
  if (previousStatus === undefined || previousStatus === "attempted") {
    return {
      kind: "newly-solved",
      previousStatus: previousStatus ?? "untouched",
    };
  }
  return isHigherGameResultLevel(level, previousStatus)
    ? { kind: "raised", previousStatus }
    : null;
}

export function findZukanChanges(
  zukan: GameZukan,
  lastViewed: ZukanViewedStatuses | null,
): ZukanChanges {
  if (lastViewed === null) {
    return noZukanChanges;
  }

  const changes: ZukanChanges = { byDifficulty: {} };
  for (const { difficulty, problems } of zukan.sections) {
    const sectionChanges = new Map<ProblemId, ZukanProblemChange>();
    for (const problem of problems) {
      if (problem.kind !== "solved") {
        continue;
      }
      // 前回の状態に無い難易度は、その難易度の問題を前回は解いていなかったものとする。
      const change = findProblemChange(
        getGameResultLevel(problem.bestScore),
        lastViewed[difficulty]?.[problem.problemId],
      );
      if (change === null) {
        continue;
      }
      sectionChanges.set(problem.problemId, change);
    }
    if (sectionChanges.size > 0) {
      changes.byDifficulty[difficulty] = sectionChanges;
    }
  }
  return changes;
}

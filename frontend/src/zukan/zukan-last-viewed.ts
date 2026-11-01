import type { DifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import {
  type GameResultLevel,
  getGameResultLevel,
  isHigherGameResultLevel,
} from "@/games/result";
import {
  type GameZukan,
  getZukanProblemStatus,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";

/** 図鑑を見たときの1問の状態として残すもの。未挑戦の問題は残さない。 */
export type ZukanViewedStatus = Exclude<ZukanProblemStatus, "untouched">;

/** 図鑑の1つの難易度を見たときの状態。解いた問題の評価段階と挑戦中の問題を、問題 ID で引く。 */
export type ZukanViewedSection = Readonly<Record<ProblemId, ZukanViewedStatus>>;

/**
 * 図鑑を見たときの状態を難易度ごとに持ったもの。次に開いたときに変化を求めるのに使う。
 * 持たない難易度は、まだ見たことが無いものとする。
 */
export type ZukanViewedStatuses = Partial<
  Record<DifficultyLevel, ZukanViewedSection>
>;

/** 前回図鑑を見たときから、1問に起きた変化と、変化する前の状態。 */
export type ZukanProblemChange =
  | { kind: "newly-solved"; previousStatus: "attempted" | "untouched" }
  | { kind: "raised"; previousStatus: GameResultLevel };

/** 前回図鑑を見たときからの変化。 */
export type ZukanChanges = {
  /** 変化のあった難易度ごとの、変化した問題の問題 ID と変化。変化の無い難易度は持たない。 */
  byDifficulty: Partial<
    Record<DifficultyLevel, ReadonlyMap<ProblemId, ZukanProblemChange>>
  >;
  newlySolvedCount: number;
  raisedCount: number;
};

export const noZukanChanges: ZukanChanges = {
  byDifficulty: {},
  newlySolvedCount: 0,
  raisedCount: 0,
};

/** 図鑑の難易度 `difficulties` の今の状態を、見たときの状態として残す形にする。 */
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

/** 図鑑の難易度のうち、前回からの変化 `changes` の無い難易度。 */
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

/**
 * 前回図鑑を見たときの状態 `lastViewed` から、今の図鑑までに新しく解いた問題と評価段階が上がった問題を求める。
 * 前回の状態が無ければ変化なしとし、前回の状態に無い難易度は、その難易度の問題を前回は解いていなかったものとする。
 * 評価規則が変わって段階が下がった問題は変化に数えない。
 */
export function findZukanChanges(
  zukan: GameZukan,
  lastViewed: ZukanViewedStatuses | null,
): ZukanChanges {
  if (lastViewed === null) {
    return noZukanChanges;
  }

  const changes: ZukanChanges = {
    byDifficulty: {},
    newlySolvedCount: 0,
    raisedCount: 0,
  };
  for (const { difficulty, problems } of zukan.sections) {
    const sectionChanges = new Map<ProblemId, ZukanProblemChange>();
    for (const problem of problems) {
      if (problem.kind !== "solved") {
        continue;
      }
      const change = findProblemChange(
        getGameResultLevel(problem.bestScore),
        lastViewed[difficulty]?.[problem.problemId],
      );
      if (change === null) {
        continue;
      }
      sectionChanges.set(problem.problemId, change);
      if (change.kind === "newly-solved") {
        changes.newlySolvedCount += 1;
      } else {
        changes.raisedCount += 1;
      }
    }
    if (sectionChanges.size > 0) {
      changes.byDifficulty[difficulty] = sectionChanges;
    }
  }
  return changes;
}

import {
  type DifficultyLevel,
  difficultyLevels,
  parseDifficultyLevel,
} from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { type GameResultLevel, getGameResultLevel } from "@/games/result";
import {
  type ClearedProblemSource,
  toClearedProblem,
} from "@/records/cleared-problem";
import {
  getAbandonedPlayAttempts,
  type PlayAttempt,
} from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordClearPerformance } from "@/records/play-record-definition";

export type ZukanPlaySource = ClearedProblemSource & {
  /** 試行の問題を今の問題集で引けないときは `null` を返す。 */
  attemptProblemPlayTarget: (
    attempt: PlayAttempt,
  ) => { difficulty: string; problemId: ProblemId } | null;
};

export type ZukanGameSource = ZukanPlaySource & {
  /** 問題集の並び順で返す。 */
  listPoolProblemIds: (difficulty: DifficultyLevel) => readonly ProblemId[];
};

type ZukanProblemSlot = {
  number: number;
  difficulty: DifficultyLevel;
  problemId: ProblemId;
};

export type ZukanSolvedProblem = ZukanProblemSlot & {
  kind: "solved";
  bestScore: number;
  fastestElapsedMs: number;
  /** 手数を数えないゲームでは `null`。 */
  fewestMoves: ClearMoves | null;
  /** ミスを数えないゲームでは `null`。 */
  fewestMistakes: number | null;
  firstCompletedAt: number;
};

export type ZukanUnsolvedProblem = ZukanProblemSlot & {
  kind: "unsolved";
  attempted: boolean;
};

export type ZukanProblem = ZukanSolvedProblem | ZukanUnsolvedProblem;

export type ZukanDifficultySection = {
  difficulty: DifficultyLevel;
  /** 番号の順。 */
  problems: readonly ZukanProblem[];
  solvedCount: number;
};

export type GameZukan = {
  /** 難易度の昇順。 */
  sections: readonly ZukanDifficultySection[];
  problemCount: number;
  solvedCount: number;
  latestPlayedDifficulty: DifficultyLevel | null;
};

function toProblemKey(
  difficulty: DifficultyLevel,
  problemId: ProblemId,
): string {
  return `${difficulty}:${problemId}`;
}

type PlayableProblem = { difficulty: DifficultyLevel; problemId: ProblemId };

function toPlayableProblem(
  target: { difficulty: string; problemId: ProblemId } | null,
): PlayableProblem | null {
  const difficulty = parseDifficultyLevel(target?.difficulty);
  return target === null || difficulty === undefined
    ? null
    : { difficulty, problemId: target.problemId };
}

type LatestPlay = { playedAt: number; difficulty: DifficultyLevel };

function pickLatestPlay(
  latest: LatestPlay | null,
  candidate: LatestPlay,
): LatestPlay {
  return latest === null || candidate.playedAt > latest.playedAt
    ? candidate
    : latest;
}

type SolvedProblemTally = Pick<
  ZukanSolvedProblem,
  | "bestScore"
  | "fastestElapsedMs"
  | "fewestMoves"
  | "fewestMistakes"
  | "firstCompletedAt"
>;

type ClearMoves = NonNullable<PlayRecordClearPerformance["moves"]>;

function pickFewerMistakes(
  current: number | null,
  candidate: number | null,
): number | null {
  if (current === null || candidate === null) {
    return current ?? candidate;
  }
  return Math.min(current, candidate);
}

function pickFewerMoves(
  current: ClearMoves | null,
  candidate: ClearMoves | null,
): ClearMoves | null {
  if (current === null || candidate === null) {
    return current ?? candidate;
  }
  return candidate.completionMoveCount < current.completionMoveCount
    ? candidate
    : current;
}

function addClear(
  tally: SolvedProblemTally | undefined,
  score: number,
  performance: PlayRecordClearPerformance,
  completedAt: number,
): SolvedProblemTally {
  if (tally === undefined) {
    return {
      bestScore: score,
      fastestElapsedMs: performance.elapsedMs,
      fewestMoves: performance.moves ?? null,
      fewestMistakes: performance.mistakeCount ?? null,
      firstCompletedAt: completedAt,
    };
  }
  return {
    bestScore: Math.max(tally.bestScore, score),
    fastestElapsedMs: Math.min(tally.fastestElapsedMs, performance.elapsedMs),
    fewestMoves: pickFewerMoves(tally.fewestMoves, performance.moves ?? null),
    fewestMistakes: pickFewerMistakes(
      tally.fewestMistakes,
      performance.mistakeCount ?? null,
    ),
    firstCompletedAt: Math.min(tally.firstCompletedAt, completedAt),
  };
}

type ZukanPlays = {
  tallies: ReadonlyMap<string, SolvedProblemTally>;
  attemptedProblems: ReadonlyMap<string, PlayableProblem>;
  latestPlay: LatestPlay | null;
};

function collectZukanPlays(
  game: ZukanPlaySource,
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): ZukanPlays {
  const tallies = new Map<string, SolvedProblemTally>();
  const attemptedProblems = new Map<string, PlayableProblem>();
  let latestPlay: LatestPlay | null = null;

  for (const record of records) {
    if (record.gameId !== game.id) {
      continue;
    }
    const problem = toClearedProblem(record, game);
    if (problem === null) continue;
    const key = toProblemKey(problem.difficulty, problem.problemId);
    tallies.set(
      key,
      addClear(
        tallies.get(key),
        problem.score,
        problem.performance,
        record.completedAt,
      ),
    );
    latestPlay = pickLatestPlay(latestPlay, {
      playedAt: record.completedAt,
      difficulty: problem.difficulty,
    });
  }

  for (const attempt of getAbandonedPlayAttempts(attempts, records)) {
    if (attempt.gameId !== game.id) {
      continue;
    }
    const problem = toPlayableProblem(game.attemptProblemPlayTarget(attempt));
    if (problem === null) {
      continue;
    }
    attemptedProblems.set(
      toProblemKey(problem.difficulty, problem.problemId),
      problem,
    );
    latestPlay = pickLatestPlay(latestPlay, {
      playedAt: attempt.abandonment.abandonedAt,
      difficulty: problem.difficulty,
    });
  }

  return { tallies, attemptedProblems, latestPlay };
}

export function deriveGameZukan(
  game: ZukanGameSource,
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): GameZukan {
  const { tallies, attemptedProblems, latestPlay } = collectZukanPlays(
    game,
    records,
    attempts,
  );

  let number = 0;
  const sections = difficultyLevels.map(
    ({ id: difficulty }): ZukanDifficultySection => {
      const problems = game
        .listPoolProblemIds(difficulty)
        .map((problemId): ZukanProblem => {
          number += 1;
          const key = toProblemKey(difficulty, problemId);
          const tally = tallies.get(key);
          return tally
            ? { kind: "solved", number, difficulty, problemId, ...tally }
            : {
                kind: "unsolved",
                number,
                difficulty,
                problemId,
                attempted: attemptedProblems.has(key),
              };
        });
      return {
        difficulty,
        problems,
        solvedCount: problems.filter(({ kind }) => kind === "solved").length,
      };
    },
  );

  return {
    sections,
    problemCount: number,
    solvedCount: sections.reduce(
      (total, section) => total + section.solvedCount,
      0,
    ),
    latestPlayedDifficulty: latestPlay?.difficulty ?? null,
  };
}

export type ZukanContinuation = {
  /** 最も新しくクリアまたは離脱したプレイの難易度。そのゲームの図鑑の `latestPlayedDifficulty` と同じ。 */
  difficulty: DifficultyLevel;
  /** そのプレイをクリアまたは離脱した時刻。 */
  playedAt: number;
  attemptedCount: number;
};

/** 図鑑と同じ履歴を使い、問題集の全問は並べない。 */
export function deriveZukanContinuation(
  game: ZukanPlaySource,
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): ZukanContinuation | null {
  const { tallies, attemptedProblems, latestPlay } = collectZukanPlays(
    game,
    records,
    attempts,
  );
  if (latestPlay === null) {
    return null;
  }
  let attemptedCount = 0;
  for (const [key, { difficulty }] of attemptedProblems) {
    if (difficulty === latestPlay.difficulty && !tallies.has(key)) {
      attemptedCount += 1;
    }
  }
  return { ...latestPlay, attemptedCount };
}

export type ZukanProblemStatus = GameResultLevel | "attempted" | "untouched";

export function getZukanProblemStatus(
  problem: ZukanProblem,
): ZukanProblemStatus {
  if (problem.kind === "solved") {
    return getGameResultLevel(problem.bestScore);
  }
  return problem.attempted ? "attempted" : "untouched";
}

export function countZukanProblemsByStatus(
  problems: readonly ZukanProblem[],
  getStatus: (
    problem: ZukanProblem,
  ) => ZukanProblemStatus = getZukanProblemStatus,
): Record<ZukanProblemStatus, number> {
  const counts: Record<ZukanProblemStatus, number> = {
    perfect: 0,
    great: 0,
    good: 0,
    clear: 0,
    attempted: 0,
    untouched: 0,
  };
  for (const problem of problems) {
    counts[getStatus(problem)] += 1;
  }
  return counts;
}

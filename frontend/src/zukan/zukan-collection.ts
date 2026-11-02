import {
  type DifficultyLevel,
  difficultyLevels,
  parseDifficultyLevel,
} from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { type GameResultLevel, getGameResultLevel } from "@/games/result";
import {
  getAbandonedPlayAttempts,
  type PlayAttempt,
} from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import {
  getPlayRecordMetricValue,
  PLAY_SCORE_METRIC_ID,
  type PlayRecordClearPerformance,
  type PlayRecordDefinition,
} from "@/records/play-record-definition";

/** 記録と試行のうち図鑑に使うものを選ぶのに要る、1ゲーム分のカタログ項目の部分。 */
export type ZukanPlaySource = {
  /** 記録の `gameId` と同じ値。 */
  id: string;
  /** 記録の問題を今の問題集で引けるときだけ、その難易度と問題 ID を返す。 */
  recordProblemPlayTarget: (
    record: PlayRecord,
  ) => { difficulty: string; problemId: ProblemId } | null;
  /** 離脱した試行の問題を今の問題集で引けるときだけ、その難易度と問題 ID を返す。 */
  attemptProblemPlayTarget: (
    attempt: PlayAttempt,
  ) => { difficulty: string; problemId: ProblemId } | null;
  /** そのゲームの記録定義。記録の評価点とクリアの成績を読むのに使う。 */
  playRecordDefinition: PlayRecordDefinition;
};

/** 図鑑を記録から導くのに要る、1ゲーム分のカタログ項目の部分。 */
export type ZukanGameSource = ZukanPlaySource & {
  /** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
  listPoolProblemIds: (difficulty: DifficultyLevel) => readonly ProblemId[];
};

type ZukanProblemSlot = {
  /** 問題集の並び順（難易度の昇順、難易度の中は問題集の並び）でゲームの中を通して1から数えた番号。表示にだけ使う。 */
  number: number;
  difficulty: DifficultyLevel;
  problemId: ProblemId;
};

/** クリアしたことのある1問。 */
export type ZukanSolvedProblem = ZukanProblemSlot & {
  kind: "solved";
  /** クリアした記録の評価点のうち最も高いもの。 */
  bestScore: number;
  /** クリアした記録のうち最も速いクリアまでの経過時間。 */
  fastestElapsedMs: number;
  /** クリアした記録のうち最も少ない完成までの手数と、その問題の最短手数。手数を数えないゲームでは `null`。 */
  fewestMoves: ClearMoves | null;
  /** クリアした記録のうち最も少ないミスの数。ミスを数えないゲームでは `null`。 */
  fewestMistakes: number | null;
  /** 初めてクリアした時刻（`PlayRecord.completedAt`）。 */
  firstClearedAt: number;
};

/** まだクリアしていない1問。 */
export type ZukanUnsolvedProblem = ZukanProblemSlot & {
  kind: "unsolved";
  /** 途中でやめたことがあるか。 */
  attempted: boolean;
};

export type ZukanProblem = ZukanSolvedProblem | ZukanUnsolvedProblem;

/** 1つの難易度の問題集の全問。 */
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
  /** 図鑑に使った完了記録と離脱した試行のうち、最も新しくクリアまたは離脱したプレイの難易度。どちらも無ければ `null`。 */
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
  | "firstClearedAt"
>;

type ClearMoves = NonNullable<PlayRecordClearPerformance["moves"]>;

/** 少ない方を選ぶ。片方が無ければもう一方を選ぶ。 */
function pickFewerMistakes(
  current: number | null,
  candidate: number | null,
): number | null {
  if (current === null || candidate === null) {
    return current ?? candidate;
  }
  return Math.min(current, candidate);
}

/** 完成までの手数の少ない方を選ぶ。片方が無ければもう一方を選ぶ。 */
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
      firstClearedAt: completedAt,
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
    firstClearedAt: Math.min(tally.firstClearedAt, completedAt),
  };
}

/** 図鑑に使う履歴を、問題ごとのクリアの成績・離脱したことのある問題・最後のプレイへまとめたもの。 */
type ZukanPlays = {
  tallies: ReadonlyMap<string, SolvedProblemTally>;
  attemptedProblems: ReadonlyMap<string, PlayableProblem>;
  latestPlay: LatestPlay | null;
};

/**
 * 完了記録・離脱した試行のうち、図鑑に使うものをまとめる。
 * 別のゲームの記録と、今の問題集で引けない記録・試行（生成器の版違い・旧難易度・問題集から外れた問題）は使わない。
 */
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
    const problem = toPlayableProblem(game.recordProblemPlayTarget(record));
    const score = getPlayRecordMetricValue(
      record,
      game.playRecordDefinition,
      PLAY_SCORE_METRIC_ID,
    );
    const performance = game.playRecordDefinition.getClearPerformance(record);
    if (problem === null || score === null || performance === null) {
      continue;
    }
    const key = toProblemKey(problem.difficulty, problem.problemId);
    tallies.set(
      key,
      addClear(tallies.get(key), score, performance, record.completedAt),
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

/** 問題集の全問と、完了記録・離脱した試行から、ゲームの図鑑を導く。 */
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

/** ゲームの続き。図鑑に使う履歴のうち最後のプレイの難易度と、その難易度の挑戦中の問題の数。 */
export type ZukanContinuation = {
  /** 最も新しくクリアまたは離脱したプレイの難易度。そのゲームの図鑑の `latestPlayedDifficulty` と同じ。 */
  difficulty: DifficultyLevel;
  /** そのプレイをクリアまたは離脱した時刻。 */
  playedAt: number;
  /** その難易度で、離脱したことがありまだクリアしていない問題の数。図鑑のその難易度で挑戦中の問題の数と同じ。 */
  attemptedCount: number;
};

/**
 * 完了記録・離脱した試行から、ゲームの続きを導く。図鑑に使う履歴が無ければ `null` を返す。
 * 図鑑と同じ履歴を使い、問題集の全問は並べない。
 */
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

/** 図鑑の1問の状態。クリアした問題は最高スコアの評価段階で表す。 */
export type ZukanProblemStatus = GameResultLevel | "attempted" | "untouched";

export function getZukanProblemStatus(
  problem: ZukanProblem,
): ZukanProblemStatus {
  if (problem.kind === "solved") {
    return getGameResultLevel(problem.bestScore);
  }
  return problem.attempted ? "attempted" : "untouched";
}

/**
 * 問題の数を状態ごとに数える。数の無い状態は0とする。
 * `getStatus` を渡すと、今の状態の代わりにその状態で数える。
 */
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

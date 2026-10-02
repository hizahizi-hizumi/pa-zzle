import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import type {
  ReflectionProblemIdentity,
  ReflectionSolveWorkload,
} from "@/games/reflection/problem/problem";
import type {
  ReflectionPooledProblem,
  ReflectionProblemPoolReference,
} from "@/games/reflection/problem/problem-pool";
import {
  restoreReflectionProblem,
  selectReflectionProblemForDifficulty,
} from "@/games/reflection/problem-selection";
import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  type ReflectionLaserTrace,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  calculateReflectionPlayScore,
  calculateReflectionSpeedFullScoreMs,
  calculateReflectionSpeedZeroScoreMs,
  calculateReflectionTimeDeltaMs,
} from "@/games/reflection/score";
import {
  canRestartReflectionSession,
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionElapsedMs,
  getReflectionSessionResult,
  getReflectionSessionStock,
  type ReflectionSession,
  type ReflectionSessionResult,
  removeReflectionSessionPiece,
  replayReflectionSession,
  restartReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionClue,
  tapReflectionSessionStock,
} from "@/games/reflection/session/session";

const elapsedTimeTickMs = 1_000;

/** 表示中の光路。今の盤面で、外周の `entry` から入れた光がどう進むか。 */
export type ReflectionLaserView = {
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

/** 遊んでいる問題の出どころ。`given` は開始時に identity で指定された問題。 */
export type ReflectionProblemSource = "selected" | "given";

/**
 * 画面の進行。`clearing` は盤面が揃ってから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type ReflectionProgress = "playing" | "clearing" | "result";

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type ReflectionResult = ReflectionSessionResult & {
  workload: ReflectionSolveWorkload;
  speedFullScoreMs: number;
  speedZeroScoreMs: number;
  timeDeltaMs: number;
  score: number;
};

/**
 * - `workload` / `poolReference`: 問題集から出した問題の作業の量と、問題集の中の位置。
 *   問題集に無い identity を指定して生成した問題（内部診断）では `null` で、評価できない。
 */
type ReflectionPlayState = {
  session: ReflectionSession;
  progress: ReflectionProgress;
  problemIdentity: ReflectionProblemIdentity;
  problemSource: ReflectionProblemSource;
  workload: ReflectionSolveWorkload | null;
  poolReference: ReflectionProblemPoolReference | null;
};

function createPooledPlayState(
  { problem, identity, workload, poolReference }: ReflectionPooledProblem,
  problemSource: ReflectionProblemSource,
  startedAt: number,
): ReflectionPlayState {
  return {
    session: createReflectionSession(problem, startedAt),
    progress: "playing",
    problemIdentity: identity,
    problemSource,
    workload,
    poolReference,
  };
}

function createSelectedPlayState(
  difficulty: ReflectionDifficulty,
  avoidedProblemId: ProblemId | undefined,
  startedAt: number,
): ReflectionPlayState {
  const { problem } = selectProblemAvoiding(
    (seed) => selectReflectionProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  );
  return createPooledPlayState(problem, "selected", startedAt);
}

function createGivenPlayState(
  problemIdentity: ReflectionProblemIdentity,
  startedAt: number,
): ReflectionPlayState {
  const pooled = restoreReflectionProblem(problemIdentity);
  if (pooled) {
    return createPooledPlayState(pooled, "given", startedAt);
  }

  // 問題集に無い identity も診断のために遊べるよう、生成器で作り直す。作業の量が無いので評価はしない。
  const generated = generateReflectionProblem(problemIdentity);
  return {
    session: createReflectionSession(generated.problem, startedAt),
    progress: "playing",
    problemIdentity: generated.identity,
    problemSource: "given",
    workload: null,
    poolReference: null,
  };
}

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createReflectionResult(
  sessionResult: ReflectionSessionResult,
  workload: ReflectionSolveWorkload,
): ReflectionResult {
  return {
    ...sessionResult,
    workload,
    speedFullScoreMs: calculateReflectionSpeedFullScoreMs(workload),
    speedZeroScoreMs: calculateReflectionSpeedZeroScoreMs(workload),
    timeDeltaMs: calculateReflectionTimeDeltaMs({
      elapsedMs: sessionResult.elapsedMs,
      workload,
    }),
    score: calculateReflectionPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      workload,
    }),
  };
}

/**
 * 難易度のプレイを始める。`initialProblemIdentity` を渡すと、最初の1問だけその問題を出す。
 * 渡さなければ難易度の問題集から `avoidedProblemId` の問題を避けて選ぶ。
 * `restart` は同じプレイのまま全ピースをストックへ戻し（盤面を戻す）、
 * `replay` は同じ問題を新しいプレイとして始め（やり直す）、`startNewProblem` は遊んでいる問題を避けて同じ難易度の別の問題を始める。
 * `tapClue` は外周ヒントの光路を表示し、盤面が揃うと `progress` が `clearing` になる。
 * クリアすると `result` に評価を返す。問題集に無い問題を指定したときは作業の量が無いので `result` は `null` のまま。
 */
export function useReflectionPlay(
  difficulty: ReflectionDifficulty,
  initialProblemIdentity?: ReflectionProblemIdentity,
  avoidedProblemId?: ProblemId,
) {
  const [play, setPlay] = useState<ReflectionPlayState>(() =>
    initialProblemIdentity
      ? createGivenPlayState(initialProblemIdentity, Date.now())
      : createSelectedPlayState(difficulty, avoidedProblemId, Date.now()),
  );
  const [now, setNow] = useState(() => Date.now());
  const { session, progress } = play;

  useEffect(() => {
    if (session.status !== "playing") return;

    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      elapsedTimeTickMs,
    );

    return () => window.clearInterval(timer);
  }, [session.status]);

  const updateSession = useCallback(
    (update: (current: ReflectionSession) => ReflectionSession) => {
      setPlay((current) => {
        const next = update(current.session);
        if (next === current.session) return current;

        return {
          ...current,
          session: next,
          progress: next.status === "cleared" ? "clearing" : current.progress,
        };
      });
    },
    [],
  );

  const tapStock = useCallback(
    (piece: ReflectionPiece) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      updateSession((current) =>
        tapReflectionSessionStock(current, piece, operatedAt),
      );
    },
    [updateSession],
  );

  const tapCell = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      updateSession((current) =>
        tapReflectionSessionCell(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const tapClue = useCallback(
    (entry: ReflectionEntry) => {
      updateSession((current) => tapReflectionSessionClue(current, entry));
    },
    [updateSession],
  );

  const removePiece = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      updateSession((current) =>
        removeReflectionSessionPiece(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const clearSelection = useCallback(() => {
    updateSession(clearReflectionSessionSelection);
  }, [updateSession]);

  const restart = useCallback(() => {
    updateSession(restartReflectionSession);
  }, [updateSession]);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: replayReflectionSession(current.session, startedAt),
      progress: "playing",
    }));
  }, []);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const currentProblemIdentity = play.problemIdentity;
  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(
      createSelectedPlayState(
        difficulty,
        createProblemId(currentProblemIdentity),
        startedAt,
      ),
    );
  }, [currentProblemIdentity, difficulty]);

  const stock = useMemo(() => getReflectionSessionStock(session), [session]);
  const sessionResult = useMemo(
    () => getReflectionSessionResult(session),
    [session],
  );
  const { workload } = play;
  const result = useMemo(
    () =>
      sessionResult && workload
        ? createReflectionResult(sessionResult, workload)
        : null,
    [sessionResult, workload],
  );
  const laser = useMemo<ReflectionLaserView | null>(() => {
    const entry = session.laserEntry;
    return entry
      ? { entry, trace: traceReflectionLaser(session.board, entry) }
      : null;
  }, [session.laserEntry, session.board]);

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    problemSource: play.problemSource,
    workload,
    poolReference: play.poolReference,
    status: session.status,
    progress,
    board: session.board,
    clues: session.problem.clues,
    inventory: session.problem.inventory,
    stock,
    selection: session.selection,
    laser,
    elapsedMs: getReflectionSessionElapsedMs(session, now),
    canRestart: canRestartReflectionSession(session),
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    sessionResult,
    result,
    tapStock,
    tapCell,
    tapClue,
    removePiece,
    clearSelection,
    restart,
    replay,
    completeClearAnimation,
    startNewProblem,
  };
}

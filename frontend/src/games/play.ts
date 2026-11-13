import { useEffect, useState } from "react";
import {
  type GameSession,
  type GameSessionStatus,
  getSessionElapsedMs,
} from "@/games/session";

/**
 * `clearing` はクリアしてから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type GameProgress = "playing" | "clearing" | "result";

export function getProgressAfterSessionChange(
  progress: GameProgress,
  status: GameSessionStatus,
): GameProgress {
  return status === "cleared" && progress === "playing" ? "clearing" : progress;
}

type PlayProgressState<Session> = {
  session: Session;
  progress: GameProgress;
};

type SessionWithStatus = Pick<GameSession<unknown, unknown>, "status">;

export function applyPlaySession<
  Session extends SessionWithStatus,
  State extends PlayProgressState<Session>,
>(state: State, session: Session): State {
  return session === state.session
    ? state
    : {
        ...state,
        session,
        progress: getProgressAfterSessionChange(state.progress, session.status),
      };
}

export function startPlaySession<
  Session extends SessionWithStatus,
  State extends PlayProgressState<Session>,
>(state: State, session: Session): State {
  return {
    ...state,
    session,
    progress: getProgressAfterSessionChange("playing", session.status),
  };
}

export function completePlayClearAnimation<
  State extends { progress: GameProgress },
>(state: State): State {
  return state.progress === "clearing"
    ? { ...state, progress: "result" }
    : state;
}

const elapsedTimeTickMs = 1_000;

export function useSessionElapsedMs(
  session: Pick<
    GameSession<unknown, unknown>,
    "status" | "startedAt" | "finishedAt"
  >,
): number {
  const [now, setNow] = useState(() => Date.now());
  const playing = session.status === "playing";

  useEffect(() => {
    if (!playing) {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      elapsedTimeTickMs,
    );

    return () => window.clearInterval(timer);
  }, [playing]);

  return getSessionElapsedMs(session, now);
}

export type GamePlay<Difficulty, ProblemIdentity, Session, Result> = {
  difficulty: Difficulty;
  problemIdentity: ProblemIdentity;
  session: Session;
  status: GameSessionStatus;
  progress: GameProgress;
  startedAt: number;
  completedAt: number | null;
  elapsedMs: number;
  result: Result | null;
  replay: () => void;
  startNewProblem: () => void;
  completeClearAnimation: () => void;
};

export type RestartableGamePlay = {
  canRestart: boolean;
  restart: () => void;
};

export type UndoableGamePlay = {
  /** 取り消せる盤面操作があるプレイ中だけ `true`。 */
  canUndo: boolean;
  undo: () => void;
};

export type ResultRecordImprovement = {
  id: string;
  label: string;
  previous: string;
  current: string;
  improvement: string;
};

/** 結果画面で使う表示値。記録の保存形式や表示定義を共通ゲームへ持ち込まない。 */
export type ResultRecordFeedback =
  | { kind: "none" }
  | { kind: "first-record" }
  | { kind: "failed" }
  | { kind: "updated"; improvements: readonly ResultRecordImprovement[] };

export type GamePlayResultScreenProps<Difficulty, Result> = {
  difficulty: Difficulty;
  result: Result;
  recordFeedback: ResultRecordFeedback;
  /** 省略すると押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenGameHome: () => void;
  /** 省略すると検証情報を開く操作を出さない。 */
  onOpenDiagnostics?: () => void;
};

export type GamePlayScreenProps<Difficulty, Result> = Omit<
  GamePlayResultScreenProps<Difficulty, Result>,
  "result" | "onReplay"
> & {
  onBackToAppHome: () => void;
  progress: GameProgress;
  elapsedMs: number;
  result: Result | null;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
};

export type RestartableGamePlayScreenProps = {
  canRestart: boolean;
  onRestart: () => void;
};

export type UndoableGamePlayScreenProps = {
  canUndo: boolean;
  onUndo: () => void;
};

import { type ReactNode, useEffect, useState } from "react";

import {
  type GameSession,
  type GameSessionStatus,
  getSessionElapsedMs,
} from "@/games/session";

/**
 * 画面の進行。`clearing` はクリアしてから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type GameProgress = "playing" | "clearing" | "result";

/** session が変わった後の進行。プレイ中にクリアしたら完成演出へ進む。 */
export function getProgressAfterSessionChange(
  progress: GameProgress,
  status: GameSessionStatus,
): GameProgress {
  return status === "cleared" && progress === "playing" ? "clearing" : progress;
}

/** プレイフックが state に持つ、session と進行。 */
type PlayProgressState<Session> = {
  session: Session;
  progress: GameProgress;
};

type SessionWithStatus = Pick<GameSession<unknown, unknown>, "status">;

/** 操作で変わった session を反映する。session が変わらなければ state をそのまま返す。 */
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

/** 同じ問題の新しいプレイの session で始め直す。 */
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

/** 完成演出を終え、結果表示へ進める。完成演出中でなければ state をそのまま返す。 */
export function completePlayClearAnimation<
  State extends { progress: GameProgress },
>(state: State): State {
  return state.progress === "clearing"
    ? { ...state, progress: "result" }
    : state;
}

const elapsedTimeTickMs = 1_000;

/** 表示する経過時間。プレイ中は1秒ごとに進め、クリアすると止める。 */
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

/**
 * 全ゲームのプレイフック `use<Game>Play` が返す、1問のプレイの進行と共通の操作。
 * 各ゲームはこれにゲーム固有の盤面・操作を足した `<Game>Play` を返す。
 */
export type GamePlay<Difficulty, ProblemIdentity, Session, Result> = {
  difficulty: Difficulty;
  problemIdentity: ProblemIdentity;
  session: Session;
  status: GameSessionStatus;
  progress: GameProgress;
  startedAt: number;
  /** クリアした時刻。プレイ中は `null`。 */
  completedAt: number | null;
  elapsedMs: number;
  /** クリアしたプレイの評価。プレイ中は `null`。 */
  result: Result | null;
  /** 同じ問題を新しいプレイとして始める（リセット）。プレイ中でもクリア後でも使える。 */
  replay: () => void;
  /** 同じ難易度で、今の問題を避けて別の問題を始める。 */
  startNewProblem: () => void;
  /** 完成演出を終え、結果表示へ進める。 */
  completeClearAnimation: () => void;
};

/** 盤面を戻せるゲームのプレイが足す操作。 */
export type RestartableGamePlay = {
  /** 盤面が初期状態でないプレイ中だけ `true`。 */
  canRestart: boolean;
  /** 同じプレイのまま盤面を初期状態へ戻す。`canRestart` が `false` なら何もせず、回数も数えない。 */
  restart: () => void;
};

/** 待ったのあるゲームのプレイが足す操作。 */
export type UndoableGamePlay = {
  /** 取り消せる盤面操作があるプレイ中だけ `true`。 */
  canUndo: boolean;
  /** 直前の盤面操作を1つ取り消す。`canUndo` が `false` なら何もしない。 */
  undo: () => void;
};

/**
 * 全ゲームの結果画面 `<Game>ResultScreen` が受け取る、難易度・評価と結果からの操作。
 * 難易度は値で受け取り、表示名は結果画面が決める。
 */
export type GamePlayResultScreenProps<Difficulty, Result> = {
  difficulty: Difficulty;
  result: Result;
  /** 記録を保存した直後の自己ベスト更新などの告知。 */
  recordOutcomeNotice: ReactNode;
  /** 同じ問題を遊び直す。省略すると押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  /** 省略すると検証情報を開く操作を出さない。 */
  onOpenDiagnostics?: () => void;
};

/**
 * 全ゲームのプレイ画面 `<Game>Play` が受け取る、1問のプレイの進行と共通の操作。
 * 各ゲームはこれに盤面とゲーム固有の操作を足し、盤面を戻せるなら `RestartableGamePlayScreenProps`、
 * 待ったがあるなら `UndoableGamePlayScreenProps` も足す。盤面は `progress` が `playing` の間だけ操作を受け付ける。
 */
export type GamePlayScreenProps<Difficulty, Result> = Omit<
  GamePlayResultScreenProps<Difficulty, Result>,
  "result" | "onReplay"
> & {
  progress: GameProgress;
  elapsedMs: number;
  /** クリアしたプレイの評価。`progress` が `result` でも `null` の間は結果画面を出さず、盤面を見せておく。 */
  result: Result | null;
  /** 同じ問題を新しいプレイとして始める（リセット）。 */
  onReplay: () => void;
};

/** 盤面を戻せるゲームのプレイ画面が足す props。 */
export type RestartableGamePlayScreenProps = {
  canRestart: boolean;
  onRestart: () => void;
};

/** 待ったのあるゲームのプレイ画面が足す props。 */
export type UndoableGamePlayScreenProps = {
  canUndo: boolean;
  onUndo: () => void;
};

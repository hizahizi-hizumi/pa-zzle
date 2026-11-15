import type { GameProgress } from "@/games/play";
import {
  createProblemId,
  type ProblemId,
  type ProblemIdentity,
} from "@/games/problem-id";
import type { GameSession } from "@/games/session";
import { isRecordObject } from "@/lib/type-guards";

type PersistablePlayState = {
  session: GameSession<unknown, unknown>;
  problemIdentity: ProblemIdentity;
  progress: GameProgress;
};

export type PlayStateCodec<State> = {
  serialize: (state: State) => unknown;
  deserialize: (value: unknown, initial: State) => State | null;
};

const storagePrefix = "pa-zzle.active-play.v1.";

/** 画面の戻る・進む・再読み込みで、同じタブの進行中の挑戦を復元する。 */
export function restorePlayState<State extends PersistablePlayState>(
  gameId: string,
  problemId: ProblemId | undefined,
  createInitialState: () => State,
  codec?: PlayStateCodec<State>,
): State {
  const key = `${storagePrefix}${gameId}`;
  const initial = createInitialState();
  if (problemId === undefined) return initial;
  try {
    const storedText = window.sessionStorage.getItem(key);
    if (!storedText) return initial;
    const stored: unknown = JSON.parse(storedText);
    if (!isRecordObject(stored) || stored.problemId !== problemId)
      return initial;
    const candidate = codec
      ? codec.deserialize(stored.state, initial)
      : stored.state;
    if (
      !isRecordObject(candidate) ||
      !isRecordObject(candidate.session) ||
      !isRecordObject(candidate.problemIdentity) ||
      createProblemId(candidate.problemIdentity) !== problemId ||
      typeof candidate.session.startedAt !== "number" ||
      !Number.isFinite(candidate.session.startedAt) ||
      candidate.session.startedAt <= 0 ||
      !["playing", "cleared"].includes(String(candidate.session.status)) ||
      !["playing", "clearing", "result"].includes(String(candidate.progress)) ||
      // 問題集更新で異なる盤面になった場合は古い入力を復元しない。
      JSON.stringify(candidate.session.problem) !==
        JSON.stringify(initial.session.problem)
    ) {
      return initial;
    }
    // クリア直後の再読み込みでは結果の確定をやり直せるようにする。
    return (
      candidate.session.status === "cleared"
        ? { ...candidate, progress: "result" }
        : candidate
    ) as State;
  } catch {
    return initial;
  }
}

/** 入力、履歴、採点に必要な進行状態をタブ内に保存する。 */
export function savePlayState<State extends PersistablePlayState>(
  gameId: string,
  problemId: ProblemId | undefined,
  state: State,
  codec?: PlayStateCodec<State>,
): void {
  if (problemId === undefined) return;
  const key = `${storagePrefix}${gameId}`;
  try {
    if (state.progress === "result") {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          problemId,
          state: codec ? codec.serialize(state) : state,
        }),
      );
    }
  } catch {
    // 保存が利用できない環境でもプレイは継続する。
  }
}

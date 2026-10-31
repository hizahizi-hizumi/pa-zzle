/** 1問のプレイが続いているか、クリアしたか。 */
export type GameSessionStatus = "playing" | "cleared";

/**
 * 全ゲームの `<Game>Session` が共有する形。各ゲームはこれにプレイの事実（手数・ミスなど）を足す。
 * `puzzleState` は今の盤面で、ゲーム固有の `puzzle/` の状態型を入れる。
 */
export type GameSession<Problem, PuzzleState> = {
  status: GameSessionStatus;
  problem: Problem;
  puzzleState: PuzzleState;
  startedAt: number;
  /** クリアした時刻。プレイ中は `null`。 */
  finishedAt: number | null;
};

type SessionTiming = Pick<
  GameSession<unknown, unknown>,
  "startedAt" | "finishedAt"
>;

/** 始めてから `now` まで、クリアしていればクリアまでの経過時間。 */
export function getSessionElapsedMs(
  session: SessionTiming,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

/** クリアまでの経過時間。プレイ中は `null`。 */
export function getClearedSessionElapsedMs(
  session: SessionTiming & Pick<GameSession<unknown, unknown>, "status">,
): number | null {
  return session.status === "cleared" && session.finishedAt !== null
    ? getSessionElapsedMs(session, session.finishedAt)
    : null;
}

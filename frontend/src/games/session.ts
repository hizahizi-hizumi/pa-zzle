export type GameSessionStatus = "playing" | "cleared";

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

export function getSessionElapsedMs(
  session: SessionTiming,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getClearedSessionElapsedMs(
  session: SessionTiming & Pick<GameSession<unknown, unknown>, "status">,
): number | null {
  return session.status === "cleared" && session.finishedAt !== null
    ? getSessionElapsedMs(session, session.finishedAt)
    : null;
}

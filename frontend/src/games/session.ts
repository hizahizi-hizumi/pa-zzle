export type GameSessionStatus = "playing" | "cleared";

export type GameSession<Problem, PuzzleState> = {
  status: GameSessionStatus;
  problem: Problem;
  puzzleState: PuzzleState;
  startedAt: number;
  clearedAt: number | null;
};

type SessionTiming = Pick<
  GameSession<unknown, unknown>,
  "startedAt" | "clearedAt"
>;

export function getSessionElapsedMs(
  session: SessionTiming,
  now: number,
): number {
  return Math.max(0, (session.clearedAt ?? now) - session.startedAt);
}

export function getClearedSessionElapsedMs(
  session: SessionTiming & Pick<GameSession<unknown, unknown>, "status">,
): number | null {
  return session.status === "cleared" && session.clearedAt !== null
    ? getSessionElapsedMs(session, session.clearedAt)
    : null;
}

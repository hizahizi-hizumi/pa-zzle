export type DemoSession = {
  status: "playing" | "cleared";
  startedAt: number;
  mistakeCount: number;
  moveCount: number;
};

export type DemoSessionResult = {
  elapsedMs: number;
  mistakeCount: number;
  score: number;
  praise: "perfect" | "great" | "good";
};

export function recordDemoMistake(session: DemoSession): DemoSession {
  return { ...session, mistakeCount: session.mistakeCount + 1 };
}

export function getDemoSessionResult(
  session: DemoSession,
  completedAt: number,
): DemoSessionResult {
  const elapsedMs = completedAt - session.startedAt;
  const score = Math.max(0, 100 - session.mistakeCount * 5);

  return {
    elapsedMs,
    mistakeCount: session.mistakeCount,
    score,
    praise: score === 100 ? "perfect" : score >= 80 ? "great" : "good",
  };
}

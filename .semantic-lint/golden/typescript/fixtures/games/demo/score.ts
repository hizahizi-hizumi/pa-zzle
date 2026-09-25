export type DemoPlayFacts = {
  mistakes: number;
  elapsedMs: number;
};

export type DemoPlayScore = {
  total: number;
  totalLabel: string;
  levelColor: string;
};

export function calculateDemoPlayScore(facts: DemoPlayFacts): DemoPlayScore {
  const total = Math.max(0, 100 - facts.mistakes * 5);

  return {
    total,
    totalLabel: `${total}点`,
    levelColor: total === 100 ? "text-amber-500" : "text-slate-500",
  };
}

export function isDemoPerfectScore(score: DemoPlayScore): boolean {
  return score.total === 100;
}

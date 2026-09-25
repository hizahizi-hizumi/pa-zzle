import type { useScoreBoard } from "./use-score-board";

type ScorePanelProps = ReturnType<typeof useScoreBoard>;

export function ScorePanel({ score, bestScore, reset }: ScorePanelProps) {
  return (
    <section>
      <p>{score}</p>
      <p>{bestScore}</p>
      <button type="button" onClick={reset}>
        リセット
      </button>
    </section>
  );
}

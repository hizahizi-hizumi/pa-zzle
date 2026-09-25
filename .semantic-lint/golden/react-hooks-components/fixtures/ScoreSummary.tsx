import { useEffect, useState } from "react";

type ScoreSummaryProps = {
  score: number;
};

export function ScoreSummary({ score }: ScoreSummaryProps) {
  const [scoreLabel, setScoreLabel] = useState("");

  useEffect(() => {
    setScoreLabel(`${score}点`);
  }, [score]);

  return <p>{scoreLabel}</p>;
}

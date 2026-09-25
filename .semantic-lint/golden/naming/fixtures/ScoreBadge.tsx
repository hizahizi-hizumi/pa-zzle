type ScoreBadgeProps = {
  score: number;
};

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const hoge = score >= 90;
  const level = hoge ? "great" : "clear";
  const val = `${score}点`;

  return <span data-level={level}>{val}</span>;
}

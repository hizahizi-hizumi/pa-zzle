type ScoreBadgeProps = {
  score: number;
  color: string;
  className?: string;
};

export function ScoreBadge({ score, color, className }: ScoreBadgeProps) {
  return (
    <span className={`rounded-full px-2 text-sm ${color} ${className ?? ""}`}>
      {score}点
    </span>
  );
}

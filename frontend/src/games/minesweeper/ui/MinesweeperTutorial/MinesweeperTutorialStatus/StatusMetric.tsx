type StatusMetricProps = {
  label: string;
  value: number;
};

/** 本番の見出しの計測値と同じ書式で、名前と数を並べる。 */
export function StatusMetric({ label, value }: StatusMetricProps) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span>{label}</span>
      <span className="min-w-[2ch] text-left font-medium font-mono text-foreground/80 tabular-nums">
        {value}
      </span>
    </span>
  );
}

type PlayMetricProps = {
  label: string;
  value: string;
};

export function PlayMetric({ label, value }: PlayMetricProps) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span>{label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground/80">
        {value}
      </span>
    </span>
  );
}

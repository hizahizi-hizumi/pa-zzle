type ResultMetricProps = {
  label: string;
  value: string;
};

export function ResultMetric({ label, value }: ResultMetricProps) {
  return (
    <div className="rounded-xl bg-muted/70 px-2 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold tracking-tight">
        {value}
      </dd>
    </div>
  );
}

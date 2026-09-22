type ResultMetricProps = {
  label: string;
  value: string;
  detail?: string;
};

export function ResultMetric({ label, value, detail }: ResultMetricProps) {
  return (
    <div className="rounded-xl bg-muted/55 px-3 py-2 text-center">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-body font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {detail && (
        <dd className="mt-1 text-meta text-muted-foreground">{detail}</dd>
      )}
    </div>
  );
}

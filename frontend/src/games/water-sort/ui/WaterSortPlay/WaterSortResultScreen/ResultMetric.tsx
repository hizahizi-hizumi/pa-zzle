type ResultMetricProps = {
  label: string;
  value: string;
  detail?: string;
};

export function ResultMetric({ label, value, detail }: ResultMetricProps) {
  return (
    <div className="rounded-xl bg-muted/55 px-3 py-2 text-center">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {detail && (
        <dd className="mt-0.5 text-[10px] text-muted-foreground">{detail}</dd>
      )}
    </div>
  );
}

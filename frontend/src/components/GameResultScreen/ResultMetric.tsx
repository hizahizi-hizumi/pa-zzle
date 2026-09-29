export type GameResultMetric = {
  label: string;
  value: string;
  /** 値を読むための補足。基準との差など。 */
  detail?: string;
};

type ResultMetricProps = GameResultMetric;

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

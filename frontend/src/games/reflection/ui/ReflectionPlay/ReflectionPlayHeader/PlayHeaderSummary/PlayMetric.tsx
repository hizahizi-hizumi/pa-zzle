type PlayMetricProps = {
  label: string;
  value: string;
  /** 値がこの桁数に満たなくても、この桁数分の幅を取る。桁が増えたときに周りを動かさないため。 */
  reservedDigits?: number;
};

export function PlayMetric({ label, value, reservedDigits }: PlayMetricProps) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span>{label}</span>
      {/* 見えない「0」の並びと値を同じ位置に重ね、幅を桁の幅そのもので確保する。 */}
      <span className="grid text-left font-mono font-medium tabular-nums text-foreground/80">
        {reservedDigits !== undefined && (
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1"
          >
            {"0".repeat(reservedDigits)}
          </span>
        )}
        <span className="col-start-1 row-start-1">{value}</span>
      </span>
    </span>
  );
}

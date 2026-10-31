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
      {/* 等幅の数字なので、`ch`（「0」の幅）で桁の幅そのものを確保できる。 */}
      <span
        className="text-left font-mono font-medium tabular-nums text-foreground/80"
        style={
          reservedDigits === undefined
            ? undefined
            : { minWidth: `${reservedDigits}ch` }
        }
      >
        {value}
      </span>
    </span>
  );
}

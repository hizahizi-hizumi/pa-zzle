type ZukanChangeSummaryProps = {
  /** 前回から新しく解いた問題の数。 */
  newlySolvedCount: number;
  /** 前回から評価段階が上がった問題の数。 */
  raisedCount: number;
};

/**
 * 前回図鑑を見たときからの変化を、新しく解いた問題と段階が上がった問題の数で1行に示す。
 * 頭の点は、変化をまだ見せていないレベルのカードの点と同じ印で、どこに変化があるかを結びつける。
 * 数は全レベルの変化を合わせた数で、マスを押していく間も数え上げない。変化の無い項目は並べない。称賛の言葉は付けない。
 */
export function ZukanChangeSummary({
  newlySolvedCount,
  raisedCount,
}: ZukanChangeSummaryProps) {
  const items = [
    { label: "新しく解いた", count: newlySolvedCount },
    { label: "段階が上がった", count: raisedCount },
  ].filter(({ count }) => count > 0);

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-supporting text-muted-foreground">
      <span
        aria-hidden="true"
        className="me-1 size-1.5 shrink-0 rounded-full bg-foreground"
      />
      {items.map(({ label, count }, index) => (
        <span key={label} className="whitespace-nowrap">
          {index > 0 && (
            <span aria-hidden="true" className="me-1.5">
              ・
            </span>
          )}
          {label}{" "}
          <span className="font-medium text-foreground tabular-nums">
            {count}
          </span>
          問
        </span>
      ))}
    </p>
  );
}

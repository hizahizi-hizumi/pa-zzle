type ZukanMatchedCountProps = {
  /** 絞り込んでいなければ `null`。 */
  matchedCount: number | null;
  problemCount: number;
};

export function ZukanMatchedCount({
  matchedCount,
  problemCount,
}: ZukanMatchedCountProps) {
  const isFiltering = matchedCount !== null;
  return (
    <p
      aria-hidden={!isFiltering}
      data-matched-count=""
      // 条件を付け外ししても台紙の上の並びを動かさないよう、絞り込んでいない間も最大の桁の場所を取っておき、見えなくする。
      // 横の列に置く PC の幅では、絞り込んでいない間は場所を取らない。
      className={`shrink-0 text-meta whitespace-nowrap text-muted-foreground ${isFiltering ? "" : "invisible lg:hidden"}`}
    >
      該当{" "}
      <span className="inline-grid justify-items-end font-medium text-foreground tabular-nums">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {"0".repeat(String(problemCount).length)}
        </span>
        <span className="col-start-1 row-start-1">{matchedCount ?? 0}</span>
      </span>
      問
    </p>
  );
}

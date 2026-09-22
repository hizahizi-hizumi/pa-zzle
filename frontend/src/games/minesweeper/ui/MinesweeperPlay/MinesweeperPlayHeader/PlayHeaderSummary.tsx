type PlayHeaderSummaryProps = {
  mineCount: number;
  flagCount: number;
};

export function PlayHeaderSummary({
  mineCount,
  flagCount,
}: PlayHeaderSummaryProps) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-play-context">マインスイーパー</h1>
      <div className="mt-1 flex items-center justify-center gap-2 text-play-meta text-muted-foreground">
        <span className="flex items-baseline gap-1 whitespace-nowrap">
          <span>地雷</span>
          <span className="font-mono font-medium tabular-nums text-foreground/80">
            {mineCount}
          </span>
        </span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <span className="flex items-baseline gap-1 whitespace-nowrap">
          <span>旗</span>
          <span className="font-mono font-medium tabular-nums text-foreground/80">
            {flagCount}
          </span>
        </span>
      </div>
    </div>
  );
}

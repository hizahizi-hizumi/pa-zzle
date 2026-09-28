type ReflectionClueMatchStatusProps = {
  /** 手持ちを置き切っても一致していない外周ヒントの本数。置き切っていない間は 0。 */
  unmatchedClueCount: number;
};

/**
 * 手持ちを置き切っても揃っていないときに、一致していない外周ヒントの本数を控えめに知らせる1行。
 * 外周ヒントごとの一致は盤面の外周ヒントの地の色で示し、光路は線だけで見せるので、ここでは繰り返さない。
 * 何も表示しない間も高さを取り、盤面の位置を動かさない。
 */
export function ReflectionClueMatchStatus({
  unmatchedClueCount,
}: ReflectionClueMatchStatusProps) {
  return (
    <p
      aria-live="polite"
      className="flex h-5 items-center justify-center whitespace-nowrap text-play-meta text-muted-foreground"
    >
      {unmatchedClueCount > 0 ? (
        <span>
          合っていない外周ヒントが
          <span className="font-mono font-medium tabular-nums text-foreground/80">
            {unmatchedClueCount}本
          </span>
          あります
        </span>
      ) : null}
    </p>
  );
}

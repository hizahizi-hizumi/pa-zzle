import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";

const levels = ["perfect", "great", "good", "clear"] as const;

type CollectionMockLegendProps = {
  counts: Readonly<Record<GameResultLevel, number>>;
};

/** 全ゲームの「問題ごとの最高評価」。同じ問題を何度遊んでも1問として数える。 */
export function CollectionMockLegend({ counts }: CollectionMockLegendProps) {
  return (
    <div
      className="mt-4 grid grid-cols-4 gap-2"
      aria-label="最高評価ごとの問題数"
    >
      {levels.map((level) => (
        <div key={level} className="min-w-0 border-t border-border pt-2">
          <span
            className={`mb-1.5 block h-1 w-6 rounded-full bg-current ${getGameResultStyle(level).fillColorClassName}`}
            aria-hidden="true"
          />
          <p className="text-xl font-semibold tabular-nums sm:text-2xl">
            {counts[level].toLocaleString("ja-JP")}
          </p>
          <p className="text-meta text-muted-foreground capitalize">{level}</p>
        </div>
      ))}
    </div>
  );
}

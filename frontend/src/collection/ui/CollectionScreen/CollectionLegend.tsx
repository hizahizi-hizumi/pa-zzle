import { getGameResultStyle } from "@/components/game-result-style";
import { type GameResultLevel, gameResultLevels } from "@/games/result";

const levels = [...gameResultLevels].reverse();

type CollectionLegendProps = {
  counts: Readonly<Record<GameResultLevel, number>>;
};

export function CollectionLegend({ counts }: CollectionLegendProps) {
  return (
    <div
      className="mt-4 grid grid-cols-4 gap-2"
      aria-label="最高評価ごとの問題数"
    >
      {levels.map((level) => (
        <div key={level} className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 shrink-0 rounded-[2px] bg-current ${getGameResultStyle(level).fillColorClassName}`}
              aria-hidden="true"
            />
            <span className="font-semibold tabular-nums sm:text-lg">
              {counts[level].toLocaleString("ja-JP")}
            </span>
          </div>
          <span className="text-meta text-muted-foreground capitalize">
            {level}
          </span>
        </div>
      ))}
    </div>
  );
}

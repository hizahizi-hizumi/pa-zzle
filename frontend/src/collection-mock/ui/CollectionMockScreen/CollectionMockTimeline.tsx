import {
  type CollectionMockActivity,
  type CollectionMockJourney,
  collectionMockPeriods,
} from "@/collection-mock/model";
import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import { Button } from "@/components/ui/button";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import type { GameResultLevel } from "@/games/result";

const levels: readonly GameResultLevel[] = [
  "clear",
  "good",
  "great",
  "perfect",
];

type CollectionMockTimelineProps = {
  journey: CollectionMockJourney;
  catalog: readonly GameCatalogEntry[];
  period: number;
  selectedId: string;
  onPeriodChange: (period: number) => void;
  onGameSelect: (id: string) => void;
};

/** 期間中の新しい問題の評価構成と評価更新を、ゲームごとの5期でたどる。 */
export function CollectionMockTimeline({
  journey,
  catalog,
  period,
  selectedId,
  onPeriodChange,
  onGameSelect,
}: CollectionMockTimelineProps) {
  const rows = catalog.map((info) => ({
    info,
    changes: journey.activity[info.id] ?? [],
  }));
  const maxAdded = Math.max(
    1,
    ...rows.flatMap(({ changes }) => changes.map(({ added }) => added)),
  );
  return (
    <section className="mt-6" aria-label="時間ごとの積み重ね">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-heading">時間をたどる</h3>
          <p className="mt-0.5 text-supporting text-muted-foreground">
            いつ、どのパズルに夢中だったか
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={period === collectionMockPeriods.length - 1}
          onClick={() => onPeriodChange(collectionMockPeriods.length - 1)}
        >
          最新へ
        </Button>
      </div>
      <div className="rounded-lg bg-muted/35 px-2 py-3 sm:px-5 sm:py-4">
        <div className="grid grid-cols-[2.75rem_repeat(5,minmax(0,1fr))] gap-1 text-center text-[10px] sm:grid-cols-[8rem_repeat(5,minmax(0,1fr))] sm:text-xs">
          <span />
          {collectionMockPeriods.map((label, index) => (
            <button
              type="button"
              key={label}
              className={`min-w-0 rounded-sm py-2 font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${period === index ? "bg-background text-foreground shadow-xs ring-1 ring-ring" : "text-muted-foreground hover:bg-background/60"}`}
              aria-pressed={period === index}
              aria-label={`${label}の時点を見る`}
              onClick={() => onPeriodChange(index)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-1 grid gap-1">
          {rows.map(({ info, changes }) => (
            <div
              key={info.id}
              className={`grid grid-cols-[2.75rem_repeat(5,minmax(0,1fr))] gap-1 rounded-sm p-0.5 sm:grid-cols-[8rem_repeat(5,minmax(0,1fr))] ${selectedId === info.id ? "bg-background/85" : ""}`}
            >
              <button
                type="button"
                aria-label={`${info.name}を選択`}
                aria-pressed={selectedId === info.id}
                onClick={() => onGameSelect(info.id)}
                className={`flex min-w-0 items-center justify-center rounded-sm py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring sm:justify-start sm:gap-2 sm:px-1 ${selectedId === info.id ? "ring-1 ring-ring" : "hover:bg-background"}`}
              >
                <span className="block size-5 shrink-0 sm:size-6">
                  <GamePictogram svg={info.pictogramSvg} />
                </span>
                <span className="hidden truncate text-xs sm:block">
                  {info.name}
                </span>
              </button>
              {collectionMockPeriods.map((label, index) => {
                const change: CollectionMockActivity | undefined =
                  changes[index];
                const newCount = change?.added ?? 0;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-label={`${info.name} ${label}: 新たに${newCount}問、評価更新${change?.raised ?? 0}問`}
                    aria-pressed={period === index && selectedId === info.id}
                    onClick={() => {
                      onGameSelect(info.id);
                      onPeriodChange(index);
                    }}
                    className={`relative flex h-9 min-w-0 items-end rounded-[3px] px-1 py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring sm:h-10 ${period === index ? "bg-background ring-1 ring-foreground/25" : "bg-background/55 hover:bg-background"} ${index > period ? "opacity-40" : ""}`}
                  >
                    <span className="flex h-full w-full flex-col-reverse gap-px overflow-hidden">
                      {levels.map((level) => {
                        const count = change?.addedByLevel[level] ?? 0;
                        return count > 0 ? (
                          <span
                            key={level}
                            className={`block w-full shrink-0 bg-current ${getGameResultStyle(level).fillColorClassName}`}
                            style={{
                              height: `${Math.max(1, (count / maxAdded) * 100)}%`,
                            }}
                          />
                        ) : null;
                      })}
                    </span>
                    {(change?.raised ?? 0) > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground ring-1 ring-background"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-meta text-muted-foreground">
        <span>色の層：初めて解いたときの評価</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="size-1.5 rounded-full bg-foreground" /> 評価更新
        </span>
      </div>
    </section>
  );
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type {
  CollectionActivity,
  CollectionJourney,
} from "@/collection/collection";
import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import { Button } from "@/components/ui/button";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import { gameResultLevels } from "@/games/result";

const levels = gameResultLevels;
const pageSize = 6;

type CollectionTimelineProps = {
  journey: CollectionJourney;
  catalog: readonly GameCatalogEntry[];
  period: number;
  selectedId: string;
  onPeriodChange: (period: number) => void;
  onGameSelect: (id: string) => void;
};

export function CollectionTimeline({
  journey,
  catalog,
  period,
  selectedId,
  onPeriodChange,
  onGameSelect,
}: CollectionTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const selectedInfo = catalog.find(({ id }) => id === selectedId);
  const selectedActivity = journey.activity[selectedId]?.[period];
  const visibleGames = showAll
    ? catalog
    : catalog.filter(({ id }) => id === selectedId);
  const rows = visibleGames.map((info) => ({
    info,
    changes: journey.activity[info.id] ?? [],
  }));
  const maxAdded = Math.max(
    1,
    ...catalog.flatMap(({ id }) =>
      (journey.activity[id] ?? []).map(({ added }) => added),
    ),
  );
  const months = journey.periods;
  const pageFromEnd = Math.floor((months.length - 1 - period) / pageSize);
  const pageEnd = months.length - pageFromEnd * pageSize;
  const pageStart = Math.max(0, pageEnd - pageSize);
  const visibleMonths = months.slice(pageStart, pageEnd);
  const first = visibleMonths[0];
  const last = visibleMonths.at(-1);
  const rangeLabel =
    first && last
      ? first.year === last.year
        ? `${first.year}年${first.month}〜${last.month}月`
        : `${first.year}年${first.month}月〜${last.year}年${last.month}月`
      : "";

  return (
    <section className="mt-8" aria-label="時間ごとの積み重ね">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-heading">遊んだ時期</h3>
        <div className="flex items-center gap-1">
          {period !== months.length - 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onPeriodChange(months.length - 1)}
            >
              最新へ
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showAll}
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "閉じる" : "全ゲームを見る"}
          </Button>
        </div>
      </div>
      <div className="rounded-lg bg-muted/30 px-2 py-3 sm:px-5 sm:py-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="前の6か月"
            disabled={pageStart === 0}
            onClick={() => onPeriodChange(pageStart - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="text-meta font-medium tabular-nums">
            {rangeLabel}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="次の6か月"
            disabled={pageEnd === months.length}
            onClick={() =>
              onPeriodChange(
                Math.min(months.length - 1, pageEnd + pageSize - 1),
              )
            }
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-[2.75rem_repeat(6,minmax(0,1fr))] gap-1 text-center text-[10px] sm:grid-cols-[8rem_repeat(6,minmax(0,1fr))] sm:text-xs">
          <span />
          {visibleMonths.map((month, index) => (
            <button
              type="button"
              key={month.key}
              className={`min-w-0 rounded-sm py-2 font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${period === pageStart + index ? "bg-background text-foreground shadow-xs ring-1 ring-ring" : "text-muted-foreground hover:bg-background/60"}`}
              aria-pressed={period === pageStart + index}
              aria-label={`${month.label}の時点を見る`}
              onClick={() => onPeriodChange(pageStart + index)}
            >
              {month.month}月
            </button>
          ))}
        </div>
        <div className="mt-2 grid gap-1">
          {rows.map(({ info, changes }) => (
            <div
              key={info.id}
              className={`grid grid-cols-[2.75rem_repeat(6,minmax(0,1fr))] gap-1 rounded-sm p-0.5 sm:grid-cols-[8rem_repeat(6,minmax(0,1fr))] ${selectedId === info.id ? "bg-background/65" : ""}`}
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
              {visibleMonths.map((month, index) => {
                const change: CollectionActivity | undefined =
                  changes[pageStart + index];
                const newCount = change?.added ?? 0;
                return (
                  <button
                    key={month.key}
                    type="button"
                    aria-label={`${info.name} ${month.label}: 初クリア${newCount}問、評価アップ${change?.raised ?? 0}問`}
                    aria-pressed={
                      period === pageStart + index && selectedId === info.id
                    }
                    onClick={() => {
                      onGameSelect(info.id);
                      onPeriodChange(pageStart + index);
                    }}
                    className={`relative flex h-12 min-w-0 items-end rounded-[3px] px-1 py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${period === pageStart + index ? "bg-background ring-1 ring-foreground/25" : "bg-background/55 hover:bg-background"} ${pageStart + index > period ? "opacity-40" : ""}`}
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
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {selectedInfo && selectedActivity && (
        <div
          className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-supporting"
          role="region"
          aria-label="選択中の期間とゲームの記録"
          aria-live="polite"
        >
          <span className="font-semibold">
            {selectedInfo.name} · {months[period]?.label}
          </span>
          <span className="text-muted-foreground tabular-nums">
            初クリア{" "}
            <strong className="text-foreground">
              {selectedActivity.added}問
            </strong>
          </span>
          <span className="text-muted-foreground tabular-nums">
            評価アップ{" "}
            <strong className="text-foreground">
              {selectedActivity.raised}問
            </strong>
          </span>
        </div>
      )}
    </section>
  );
}

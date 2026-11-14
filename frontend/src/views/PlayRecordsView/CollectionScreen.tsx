import { useMemo, useState, useSyncExternalStore } from "react";
import { gameCatalog } from "@/app/game-integration/game-catalog";
import { toClearedProblemSource } from "@/app/game-integration/game-catalog-entry";
import {
  createCollectionJourney,
  totalCollectionCounts,
} from "@/features/collection/collection";
import type { PlayRecord } from "@/features/records/play-record";
import { gameSelectionOrderSetting } from "@/features/settings/game-selection-order-setting";
import { CollectionBreakdown } from "@/views/PlayRecordsView/CollectionScreen/CollectionBreakdown";
import { CollectionLegend } from "@/views/PlayRecordsView/CollectionScreen/CollectionLegend";
import { CollectionTimeline } from "@/views/PlayRecordsView/CollectionScreen/CollectionTimeline";
import { CollectionTowers } from "@/views/PlayRecordsView/CollectionScreen/CollectionTowers";

type CollectionScreenProps = {
  records: readonly PlayRecord[];
  now: number;
};

export function CollectionScreen({ records, now }: CollectionScreenProps) {
  const [period, setPeriod] = useState(-1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const preferredOrder = useSyncExternalStore(
    gameSelectionOrderSetting.subscribe,
    gameSelectionOrderSetting.getSnapshot,
    gameSelectionOrderSetting.getSnapshot,
  );
  const orderedIds = gameSelectionOrderSetting.sortGameIds(
    gameCatalog.map(({ id }) => id),
    preferredOrder,
  );
  const activeId = selectedId ?? orderedIds[0] ?? "";
  const journey = useMemo(
    () =>
      createCollectionJourney(
        records,
        gameCatalog.map(toClearedProblemSource),
        new Date(now),
      ),
    [records, now],
  );
  const activePeriod = period < 0 ? journey.periods.length - 1 : period;
  const currentGames = journey.snapshots[activePeriod] ?? [];
  const items = orderedIds.flatMap((id) => {
    const game = currentGames.find((item) => item.id === id);
    const info = gameCatalog.find((item) => item.id === id);
    return game && info ? [{ game, info }] : [];
  });
  const games = items.map(({ game }) => game);
  const maxGameCount = Math.max(
    1,
    ...(journey.snapshots.at(-1) ?? []).map(({ total }) => total),
  );
  const counts = totalCollectionCounts(games);
  const total = games.reduce((sum, game) => sum + game.total, 0);
  const selectedItem =
    items.find(({ game }) => game.id === activeId) ?? items[0];

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div>
          <p className="text-meta text-muted-foreground">
            {journey.periods[activePeriod]?.label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[clamp(3.25rem,13vw,5rem)] leading-none font-semibold tracking-[-0.06em] tabular-nums">
              {total.toLocaleString("ja-JP")}
            </span>
            <span className="text-sm text-muted-foreground">問</span>
          </div>
        </div>
      </div>
      {total === 0 && (
        <p className="mt-4 text-supporting text-muted-foreground">
          まだクリアした問題がありません
        </p>
      )}
      <section aria-label="ゲームごとの積み重ね" className="mt-6">
        <CollectionTowers
          items={items}
          selectedId={activeId}
          maxCount={maxGameCount}
          onSelect={setSelectedId}
        />
        <CollectionLegend counts={counts} />
      </section>
      {selectedItem && (
        <CollectionBreakdown
          game={selectedItem.game}
          info={selectedItem.info}
        />
      )}
      <CollectionTimeline
        journey={journey}
        catalog={items.map(({ info }) => info)}
        period={activePeriod}
        selectedId={activeId}
        onPeriodChange={setPeriod}
        onGameSelect={setSelectedId}
      />
    </div>
  );
}

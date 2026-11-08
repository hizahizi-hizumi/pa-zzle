import { useMemo, useState } from "react";
import {
  type CollectionMockPersona,
  collectionMockPeriods,
  collectionMockPersonas,
  createCollectionMockJourney,
  totalMockActivity,
  totalMockCounts,
} from "@/collection-mock/model";
import { CollectionMockBreakdown } from "@/collection-mock/ui/CollectionMockScreen/CollectionMockBreakdown";
import { CollectionMockLegend } from "@/collection-mock/ui/CollectionMockScreen/CollectionMockLegend";
import { CollectionMockTimeline } from "@/collection-mock/ui/CollectionMockScreen/CollectionMockTimeline";
import { CollectionMockTowers } from "@/collection-mock/ui/CollectionMockScreen/CollectionMockTowers";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { gameCatalog } from "@/game-catalog/game-catalog";

/** 検討中の記録画面。量と評価の塔を主役に、時期の選択と詳細を一体化した比較用モック。 */
export function CollectionMockScreen() {
  const [persona, setPersona] = useState<CollectionMockPersona>("explorer");
  const [period, setPeriod] = useState(collectionMockPeriods.length - 1);
  const [selectedId, setSelectedId] = useState<string>(gameCatalog[0].id);
  const journey = useMemo(
    () =>
      createCollectionMockJourney(
        persona,
        gameCatalog.map(({ id }) => id),
      ),
    [persona],
  );
  const games = journey.snapshots[period] ?? [];
  const maxGameCount = Math.max(
    1,
    ...(journey.snapshots.at(-1) ?? []).map(({ total }) => total),
  );
  const counts = totalMockCounts(games);
  const total = games.reduce((sum, game) => sum + game.total, 0);
  const currentPeriodChange = totalMockActivity(journey, period);
  const selectedGame = games.find(({ id }) => id === selectedId) ?? games[0];
  const selectedInfo = gameCatalog.find(({ id }) => id === selectedGame?.id);

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-heading">自分のパズルの風景</h2>
          <p className="mt-0.5 text-meta text-muted-foreground">
            2026年 · {collectionMockPeriods[period]}時点
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="collection-mock-persona"
            className="text-meta text-muted-foreground"
          >
            サンプル
          </label>
          <NativeSelect
            id="collection-mock-persona"
            size="sm"
            value={persona}
            onChange={(event) => {
              setPersona(event.target.value as CollectionMockPersona);
              setPeriod(collectionMockPeriods.length - 1);
            }}
            aria-label="遊び方のサンプルを選ぶ"
          >
            {collectionMockPersonas.map(({ id, name }) => (
              <NativeSelectOption key={id} value={id}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex items-end gap-2">
          <span className="text-[clamp(3.5rem,14vw,5.5rem)] leading-none font-semibold tracking-[-0.06em] tabular-nums">
            {total.toLocaleString("ja-JP")}
          </span>
          <span className="pb-2 text-sm text-muted-foreground">解いた問題</span>
        </div>
        <p className="pb-2 text-meta text-muted-foreground">
          {games.filter(({ total: solved }) => solved > 0).length}種類のゲーム
        </p>
      </div>
      <section aria-label="ゲームごとの積み重ね" className="mt-4">
        <h3 className="sr-only">ゲームごとの積み重ね</h3>
        <CollectionMockTowers
          games={games}
          catalog={gameCatalog}
          selectedId={selectedId}
          maxCount={maxGameCount}
          onSelect={setSelectedId}
        />
        <CollectionMockLegend counts={counts} />
      </section>
      <CollectionMockTimeline
        journey={journey}
        catalog={gameCatalog}
        period={period}
        selectedId={selectedId}
        onPeriodChange={setPeriod}
        onGameSelect={setSelectedId}
      />
      <div className="mt-3 grid gap-1.5 rounded-md border border-border px-3 py-2 text-supporting sm:flex sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          {collectionMockPeriods[period]}に
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
          <span className="whitespace-nowrap">
            <strong>{currentPeriodChange.added}</strong> 問を初クリア
          </span>
          <span>
            <strong>{currentPeriodChange.raised}</strong> 問で評価更新
          </span>
        </span>
      </div>
      {selectedGame && selectedInfo && (
        <CollectionMockBreakdown game={selectedGame} info={selectedInfo} />
      )}
      <p className="mt-3 text-right text-meta text-muted-foreground">
        表示数値は比較用のサンプルです
      </p>
    </div>
  );
}

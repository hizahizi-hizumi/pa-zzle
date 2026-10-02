import { type ChangeEvent, type ReactNode, useMemo, useState } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPersonalBests } from "@/records/personal-best";
import {
  type AbandonedPlayAttempt,
  getAbandonedPlayAttempts,
  type PlayAttempt,
} from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import { CopyPlayRecordsButton } from "@/records/ui/PlayRecordsScreen/CopyPlayRecordsButton";
import { EmptyRecords } from "@/records/ui/PlayRecordsScreen/EmptyRecords";
import {
  type PlayHistoryFilter,
  PlayRecordsHistory,
} from "@/records/ui/PlayRecordsScreen/PlayRecordsHistory";
import { PlayRecordsTrend } from "@/records/ui/PlayRecordsScreen/PlayRecordsTrend";
import { getPlayHistoryEntries } from "@/records/ui/PlayRecordsScreen/play-history-entries";
import {
  getPlayRecordMetricDisplay,
  type PlayRecordGame,
  type PlayRecordGameCatalog,
} from "@/records/ui/play-record-display";

type PlayRecordsScreenProps = {
  records: readonly PlayRecord[];
  /** 始めたプレイの記録。離脱したものだけを、履歴でクリアと混ぜて表示できる。 */
  attempts: readonly PlayAttempt[];
  games: PlayRecordGameCatalog;
  emptyAction: ReactNode;
  /** 完了記録または離脱した試行の id で、その問題を再プレイする。 */
  onReplay: (playId: string) => void;
};

type ComparisonOption = {
  key: string;
  label: string;
};

type RecordsMode = "history" | "trend";

function isRecordsMode(value: string): value is RecordsMode {
  return value === "history" || value === "trend";
}

/** その比較文脈で記録画面に出せる、完了記録と離脱した試行。 */
function getGamePlays(
  records: readonly PlayRecord[],
  abandonedAttempts: readonly AbandonedPlayAttempt[],
  game: PlayRecordGame,
) {
  const { definition } = game.playRecordDisplay;
  const attemptDefinition = game.playAttemptDisplay.definition;
  return {
    records: records.filter((record) => definition.isRecord(record)),
    abandonedAttempts: abandonedAttempts.filter((attempt) =>
      attemptDefinition.isAttempt(attempt),
    ),
  };
}

/**
 * 完了記録と離脱した試行の両方から開始条件の選択肢を作る。
 * 完了・離脱した日時の新しいプレイがある開始条件から順に並べる。
 */
function getComparisonOptions(
  records: readonly PlayRecord[],
  abandonedAttempts: readonly AbandonedPlayAttempt[],
  game: PlayRecordGame,
): ComparisonOption[] {
  const options = new Map<string, string>();
  const display = game.playRecordDisplay;
  const plays = getGamePlays(records, abandonedAttempts, game);

  for (const entry of getPlayHistoryEntries(
    plays.records,
    plays.abandonedAttempts,
  )) {
    const key =
      entry.kind === "cleared"
        ? display.definition.getComparisonKey(entry.record)
        : game.playAttemptDisplay.definition.getComparisonKey(entry.attempt);
    const label = key === null ? null : display.getComparisonLabel(key);
    if (key !== null && label !== null && !options.has(key)) {
      options.set(key, label);
    }
  }

  return Array.from(options, ([key, label]) => ({ key, label }));
}

function getLastPlayedAt(
  records: readonly PlayRecord[],
  abandonedAttempts: readonly AbandonedPlayAttempt[],
  game: PlayRecordGame,
): number | null {
  const plays = getGamePlays(records, abandonedAttempts, game);
  return (
    getPlayHistoryEntries(plays.records, plays.abandonedAttempts)[0]
      ?.occurredAt ?? null
  );
}

/** 完了・離脱のどちらでも、最後に遊んだゲーム。まだ遊んでいなければ最初のゲーム。 */
function getLastPlayedGame(
  games: PlayRecordGameCatalog,
  records: readonly PlayRecord[],
  abandonedAttempts: readonly AbandonedPlayAttempt[],
): PlayRecordGame {
  let lastPlayed: { game: PlayRecordGame; playedAt: number } | null = null;
  for (const game of games) {
    const playedAt = getLastPlayedAt(records, abandonedAttempts, game);
    if (
      playedAt !== null &&
      (lastPlayed === null || playedAt > lastPlayed.playedAt)
    ) {
      lastPlayed = { game, playedAt };
    }
  }
  return lastPlayed?.game ?? games[0];
}

export function PlayRecordsScreen({
  records,
  attempts,
  games,
  emptyAction,
  onReplay,
}: PlayRecordsScreenProps) {
  const sortedRecords = useMemo(
    () =>
      [...records].sort((left, right) => right.completedAt - left.completedAt),
    [records],
  );
  const abandonedAttempts = useMemo(
    () => getAbandonedPlayAttempts(attempts, records),
    [attempts, records],
  );
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedComparisonKey, setSelectedComparisonKey] = useState<
    string | null
  >(null);
  const [mode, setMode] = useState<RecordsMode>("history");
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] =
    useState<PlayHistoryFilter>("cleared");
  const game =
    games.find(
      (item) => item.playRecordDisplay.definition.gameId === selectedGameId,
    ) ?? getLastPlayedGame(games, sortedRecords, abandonedAttempts);
  const display = game.playRecordDisplay;
  const { definition } = display;
  const comparisonOptions = getComparisonOptions(
    sortedRecords,
    abandonedAttempts,
    game,
  );
  const effectiveComparisonKey =
    selectedComparisonKey &&
    comparisonOptions.some((option) => option.key === selectedComparisonKey)
      ? selectedComparisonKey
      : (comparisonOptions[0]?.key ?? null);
  const selectedRecords = sortedRecords.filter(
    (record) =>
      definition.isRecord(record) &&
      definition.getComparisonKey(record) === effectiveComparisonKey,
  );
  const personalBests = getPersonalBests(selectedRecords, definition);
  const attemptDisplay = game.playAttemptDisplay;
  // 完了記録の無い比較文脈では、離脱したプレイが見えるようにすべてを表示する。
  const hasClearedRecords = selectedRecords.length > 0;
  const effectiveHistoryFilter: PlayHistoryFilter = hasClearedRecords
    ? historyFilter
    : "all";
  const selectedAbandonedAttempts =
    effectiveHistoryFilter === "all"
      ? abandonedAttempts.filter(
          (attempt) =>
            attemptDisplay.definition.isAttempt(attempt) &&
            attemptDisplay.definition.getComparisonKey(attempt) ===
              effectiveComparisonKey,
        )
      : [];
  const historyEntries = getPlayHistoryEntries(
    selectedRecords,
    selectedAbandonedAttempts,
  );
  const listedCount =
    mode === "history" ? historyEntries.length : selectedRecords.length;
  const effectiveMetricId =
    selectedMetricId &&
    display.metrics.some((metric) => metric.id === selectedMetricId)
      ? selectedMetricId
      : (display.metrics[0]?.id ?? "");

  function handleGameChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedGameId(event.target.value);
    setSelectedComparisonKey(null);
    setSelectedMetricId(null);
  }

  function handleComparisonChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedComparisonKey(event.target.value);
  }

  function handleModeChange(value: string) {
    if (isRecordsMode(value)) {
      setMode(value);
    }
  }

  return (
    <>
      <header className="mt-4 flex min-w-0 items-center gap-2 border-b-(length:--border-width-normal) pb-3">
        <h1 className="shrink-0 text-screen-title">記録</h1>
        <NativeSelect
          size="sm"
          aria-label="パズル"
          value={definition.gameId}
          onChange={handleGameChange}
        >
          {games.map((option) => (
            <NativeSelectOption
              key={option.playRecordDisplay.definition.gameId}
              value={option.playRecordDisplay.definition.gameId}
            >
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {comparisonOptions.length > 0 && (
          <NativeSelect
            size="sm"
            aria-label="開始条件"
            value={effectiveComparisonKey ?? ""}
            onChange={handleComparisonChange}
          >
            {comparisonOptions.map((option) => (
              <NativeSelectOption key={option.key} value={option.key}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </header>

      {comparisonOptions.length === 0 ? (
        <EmptyRecords gameLabel={game.name} action={emptyAction} />
      ) : (
        <>
          <section
            className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b-(length:--border-width-normal) py-3"
            aria-labelledby="personal-best-heading"
          >
            <h2
              id="personal-best-heading"
              className="text-meta font-medium text-muted-foreground"
            >
              自己ベスト
            </h2>
            {!hasClearedRecords && (
              <p className="text-meta text-muted-foreground">
                まだクリアしていません
              </p>
            )}
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {personalBests.flatMap((best) => {
                const metricDisplay = getPlayRecordMetricDisplay(
                  display,
                  best.metricId,
                );
                if (!metricDisplay) {
                  return [];
                }

                return [
                  <div
                    key={best.metricId}
                    className="flex items-baseline gap-2"
                  >
                    <dt className="text-meta text-muted-foreground">
                      {metricDisplay.label}
                    </dt>
                    <dd className="font-mono text-body font-semibold tabular-nums">
                      {metricDisplay.formatValue(best.value)}
                    </dd>
                  </div>,
                ];
              })}
            </dl>
          </section>

          <Tabs value={mode} onValueChange={handleModeChange}>
            <section className="pt-3" aria-label="プレイ記録">
              <div className="mb-3 flex items-center justify-between gap-3">
                <TabsList variant="line">
                  <TabsTrigger value="history">履歴</TabsTrigger>
                  <TabsTrigger value="trend">推移</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-1">
                  <p className="text-meta text-muted-foreground">
                    {listedCount}件
                  </p>
                  {hasClearedRecords && (
                    <CopyPlayRecordsButton
                      records={selectedRecords}
                      label={
                        listedCount === selectedRecords.length
                          ? "一覧の記録をJSONでコピー"
                          : "クリアした記録をJSONでコピー"
                      }
                    />
                  )}
                </div>
              </div>

              <TabsContent value="history">
                <PlayRecordsHistory
                  entries={historyEntries}
                  display={display}
                  attemptDisplay={attemptDisplay}
                  personalBests={personalBests}
                  filter={effectiveHistoryFilter}
                  filterDisabled={!hasClearedRecords}
                  onFilterChange={setHistoryFilter}
                  onReplay={onReplay}
                />
              </TabsContent>
              <TabsContent value="trend">
                <PlayRecordsTrend
                  records={selectedRecords}
                  display={display}
                  metricId={effectiveMetricId}
                  onMetricChange={setSelectedMetricId}
                />
              </TabsContent>
            </section>
          </Tabs>
        </>
      )}
    </>
  );
}

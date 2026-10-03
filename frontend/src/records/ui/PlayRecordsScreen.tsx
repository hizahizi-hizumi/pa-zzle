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
  type PlayHistoryEntry,
  type PlayHistoryFilter,
  PlayRecordsHistory,
} from "@/records/ui/PlayRecordsScreen/PlayRecordsHistory";
import { PlayRecordsTrend } from "@/records/ui/PlayRecordsScreen/PlayRecordsTrend";
import {
  getPlayRecordMetricDisplay,
  type PlayRecordDisplayDefinition,
  type PlayRecordGame,
  type PlayRecordGameCatalog,
} from "@/records/ui/play-record-display";

type PlayRecordsScreenProps = {
  records: readonly PlayRecord[];
  /** 始めたプレイの記録。離脱したものだけを、履歴でクリアと混ぜて表示できる。 */
  attempts: readonly PlayAttempt[];
  games: PlayRecordGameCatalog;
  emptyAction: ReactNode;
  /** 記録の問題を今も遊び直せるか。遊び直せない記録の「同じ問題をプレイ」は押せない。 */
  isReplayable: (record: PlayRecord) => boolean;
  onReplay: (record: PlayRecord) => void;
  /** 離脱した試行の問題を今も遊び直せるか。遊び直せない試行の「同じ問題をプレイ」は押せない。 */
  isAttemptReplayable: (attempt: AbandonedPlayAttempt) => boolean;
  onReplayAttempt: (attempt: AbandonedPlayAttempt) => void;
};

type ComparisonOption = {
  key: string;
  label: string;
};

type RecordsMode = "history" | "trend";

function isRecordsMode(value: string): value is RecordsMode {
  return value === "history" || value === "trend";
}

/** 完了した記録は完了日時、離脱した試行は離れた日時で、新しい順に並べる。 */
function getPlayHistoryEntries(
  records: readonly PlayRecord[],
  abandonedAttempts: readonly AbandonedPlayAttempt[],
): PlayHistoryEntry[] {
  const entries: PlayHistoryEntry[] = [
    ...records.map((record) => ({
      kind: "cleared" as const,
      occurredAt: record.completedAt,
      record,
    })),
    ...abandonedAttempts.map((attempt) => ({
      kind: "abandoned" as const,
      occurredAt: attempt.abandonment.abandonedAt,
      attempt,
    })),
  ];
  return entries.sort((left, right) => right.occurredAt - left.occurredAt);
}

function isGameEntry(game: PlayRecordGame, entry: PlayHistoryEntry): boolean {
  const { definition } = game.playRecordDisplay;
  return entry.kind === "cleared"
    ? definition.isRecord(entry.record)
    : entry.attempt.gameId === definition.gameId;
}

/** 離脱した試行は、完了記録の比較キーと同じ値になる開始条件の難易度で比べる。 */
function getEntryComparisonKey(
  display: PlayRecordDisplayDefinition,
  entry: PlayHistoryEntry,
): string | null {
  return entry.kind === "cleared"
    ? display.definition.getComparisonKey(entry.record)
    : entry.attempt.start.difficulty;
}

/** 完了・離脱した日時の新しいプレイがある開始条件から順に並べる。 */
function getComparisonOptions(
  gameEntries: readonly PlayHistoryEntry[],
  display: PlayRecordDisplayDefinition,
): ComparisonOption[] {
  const options = new Map<string, string>();

  for (const entry of gameEntries) {
    const key = getEntryComparisonKey(display, entry);
    const label = key === null ? null : display.getComparisonLabel(key);
    if (key !== null && label !== null && !options.has(key)) {
      options.set(key, label);
    }
  }

  return Array.from(options, ([key, label]) => ({ key, label }));
}

export function PlayRecordsScreen({
  records,
  attempts,
  games,
  emptyAction,
  isReplayable,
  onReplay,
  isAttemptReplayable,
  onReplayAttempt,
}: PlayRecordsScreenProps) {
  const entries = useMemo(
    () =>
      getPlayHistoryEntries(
        records,
        getAbandonedPlayAttempts(attempts, records),
      ),
    [records, attempts],
  );
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedComparisonKey, setSelectedComparisonKey] = useState<
    string | null
  >(null);
  const [mode, setMode] = useState<RecordsMode>("history");
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] =
    useState<PlayHistoryFilter>("cleared");
  // 離脱は記録画面を描いたあとに保存されることがあるので、選ぶまでは最後に遊んだゲームを開き直す。
  const newestEntry = entries.find((entry) =>
    games.some((item) => isGameEntry(item, entry)),
  );
  const game =
    games.find(
      (item) => item.playRecordDisplay.definition.gameId === selectedGameId,
    ) ??
    (newestEntry && games.find((item) => isGameEntry(item, newestEntry))) ??
    games[0];
  const display = game.playRecordDisplay;
  const { definition } = display;
  const gameEntries = entries.filter((entry) => isGameEntry(game, entry));
  const comparisonOptions = getComparisonOptions(gameEntries, display);
  const effectiveComparisonKey =
    selectedComparisonKey &&
    comparisonOptions.some((option) => option.key === selectedComparisonKey)
      ? selectedComparisonKey
      : (comparisonOptions[0]?.key ?? null);
  const contextEntries = gameEntries.filter(
    (entry) => getEntryComparisonKey(display, entry) === effectiveComparisonKey,
  );
  const selectedRecords = contextEntries.flatMap((entry) =>
    entry.kind === "cleared" ? [entry.record] : [],
  );
  const personalBests = getPersonalBests(selectedRecords, definition);
  // 完了記録の無い比較文脈では、離脱したプレイが見えるようにすべてを表示する。
  const hasClearedRecords = selectedRecords.length > 0;
  const effectiveHistoryFilter: PlayHistoryFilter = hasClearedRecords
    ? historyFilter
    : "all";
  const historyEntries =
    effectiveHistoryFilter === "all"
      ? contextEntries
      : contextEntries.filter((entry) => entry.kind === "cleared");
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
      <header className="mt-2 flex min-w-0 items-center gap-2 border-b-(length:--border-width-normal) pb-3">
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
                  personalBests={personalBests}
                  isReplayable={isReplayable}
                  onReplay={onReplay}
                  isAttemptReplayable={isAttemptReplayable}
                  onReplayAttempt={onReplayAttempt}
                  filter={effectiveHistoryFilter}
                  filterDisabled={!hasClearedRecords}
                  onFilterChange={setHistoryFilter}
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

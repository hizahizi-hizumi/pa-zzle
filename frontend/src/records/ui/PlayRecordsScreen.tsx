import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { playRecordAdapters } from "../catalog";
import { formatRecordCompletedAt } from "../format";
import type { PlayRecord } from "../play-record";
import {
  getPersonalBestMetricLabelsForRecord,
  getPersonalBests,
  type PlayRecordAdapter,
} from "../presentation";

type PlayRecordsScreenProps = {
  records: readonly PlayRecord[];
};

type ComparisonOption = {
  key: string;
  label: string;
};

function getComparisonOptions(
  records: readonly PlayRecord[],
  adapter: PlayRecordAdapter,
): ComparisonOption[] {
  const options = new Map<string, string>();
  for (const record of records) {
    if (!adapter.isRecord(record)) {
      continue;
    }

    const key = adapter.getComparisonKey(record);
    const label = adapter.getComparisonLabel(record);
    if (key !== null && label !== null && !options.has(key)) {
      options.set(key, label);
    }
  }

  return Array.from(options, ([key, label]) => ({ key, label }));
}

export function PlayRecordsScreen({ records }: PlayRecordsScreenProps) {
  const sortedRecords = useMemo(
    () =>
      [...records].sort((left, right) => right.completedAt - left.completedAt),
    [records],
  );
  const newestRecord = sortedRecords.find((record) =>
    playRecordAdapters.some((adapter) => adapter.isRecord(record)),
  );
  const newestAdapter = newestRecord
    ? playRecordAdapters.find((adapter) => adapter.isRecord(newestRecord))
    : undefined;
  const [selectedGameId, setSelectedGameId] = useState(
    newestAdapter?.gameId ?? playRecordAdapters[0].gameId,
  );
  const [selectedComparisonKey, setSelectedComparisonKey] = useState<
    string | null
  >(null);
  const adapter =
    playRecordAdapters.find((item) => item.gameId === selectedGameId) ??
    playRecordAdapters[0];
  const comparisonOptions = getComparisonOptions(sortedRecords, adapter);
  const effectiveComparisonKey =
    selectedComparisonKey &&
    comparisonOptions.some((option) => option.key === selectedComparisonKey)
      ? selectedComparisonKey
      : (comparisonOptions[0]?.key ?? null);
  const selectedRecords = sortedRecords.filter(
    (record) =>
      adapter.isRecord(record) &&
      adapter.getComparisonKey(record) === effectiveComparisonKey,
  );
  const personalBests = getPersonalBests(selectedRecords, adapter);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← パズル選択
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">記録</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b pb-3">
        <Select
          value={adapter.gameId}
          onValueChange={(gameId) => {
            setSelectedGameId(gameId);
            setSelectedComparisonKey(null);
          }}
        >
          <SelectTrigger size="sm" aria-label="パズル">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {playRecordAdapters.map((option) => (
              <SelectItem key={option.gameId} value={option.gameId}>
                {option.gameLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {comparisonOptions.length > 0 && (
          <Select
            value={effectiveComparisonKey ?? undefined}
            onValueChange={setSelectedComparisonKey}
          >
            <SelectTrigger size="sm" aria-label="開始条件">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {comparisonOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {comparisonOptions.length === 0 ? (
        <EmptyRecords gameLabel={adapter.gameLabel} />
      ) : (
        <>
          <section
            className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b py-3"
            aria-labelledby="personal-best-heading"
          >
            <h2
              id="personal-best-heading"
              className="text-xs font-medium text-muted-foreground"
            >
              自己ベスト
            </h2>
            <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              {personalBests.map((best) => (
                <div
                  key={best.metricId}
                  className="flex items-baseline gap-1.5"
                >
                  <dt className="text-xs text-muted-foreground">
                    {best.label}
                  </dt>
                  <dd className="font-mono text-base font-semibold tabular-nums">
                    {best.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="pt-4" aria-labelledby="play-history-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="play-history-heading" className="text-sm font-semibold">
                プレイ履歴
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedRecords.length}件
              </p>
            </div>
            <ol className="mt-1 divide-y">
              {selectedRecords.map((record) => (
                <PlayRecordRow
                  key={record.id}
                  record={record}
                  adapter={adapter}
                  personalBests={personalBests}
                />
              ))}
            </ol>
          </section>
        </>
      )}
    </section>
  );
}

function EmptyRecords({ gameLabel }: { gameLabel: string }) {
  return (
    <div className="py-8 text-center">
      <p className="font-semibold">まだ記録がありません</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {gameLabel}をクリアすると、ここにプレイ結果が残ります。
      </p>
      <div className="mt-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/">パズルを選ぶ</Link>
        </Button>
      </div>
    </div>
  );
}

type PlayRecordRowProps = {
  record: PlayRecord;
  adapter: PlayRecordAdapter;
  personalBests: ReturnType<typeof getPersonalBests>;
};

function PlayRecordRow({ record, adapter, personalBests }: PlayRecordRowProps) {
  const presentation = adapter.getHistoryPresentation(record);
  if (!presentation) {
    return null;
  }

  const bestLabels = getPersonalBestMetricLabelsForRecord(
    record,
    personalBests,
    adapter,
  );

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 sm:flex-nowrap">
        <p className="w-full shrink-0 text-xs text-muted-foreground sm:w-24">
          {formatRecordCompletedAt(record.completedAt)}
        </p>
        <div className="flex min-w-24 items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">
            {presentation.primaryMetric.label}
          </span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {presentation.primaryMetric.value}
          </span>
        </div>
        <dl className="flex flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          {presentation.detailMetrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline gap-1">
              <dt className="text-muted-foreground">{metric.label}</dt>
              <dd className="font-mono font-medium tabular-nums">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        {bestLabels.length > 0 && (
          <span
            className="shrink-0 text-xs font-medium"
            aria-label={`自己ベスト: ${bestLabels.join("、")}`}
            title={bestLabels.join("、")}
          >
            ベスト
          </span>
        )}
      </div>
    </li>
  );
}

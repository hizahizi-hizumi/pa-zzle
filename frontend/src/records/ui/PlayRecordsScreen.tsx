import { useMemo, useState } from "react";
import { Link } from "react-router";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyRecords } from "@/records/ui/PlayRecordsScreen/EmptyRecords";
import { PlayRecordRow } from "@/records/ui/PlayRecordsScreen/PlayRecordRow";
import { getPersonalBests } from "../personal-best";
import type { PlayRecord } from "../play-record";
import { playRecordDisplays } from "./catalog";
import {
  getPersonalBestMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "./play-record-display";

type PlayRecordsScreenProps = {
  records: readonly PlayRecord[];
};

type ComparisonOption = {
  key: string;
  label: string;
};

function getComparisonOptions(
  records: readonly PlayRecord[],
  display: PlayRecordDisplayDefinition,
): ComparisonOption[] {
  const options = new Map<string, string>();
  const { definition } = display;

  for (const record of records) {
    if (!definition.isRecord(record)) {
      continue;
    }

    const key = definition.getComparisonKey(record);
    const label = key === null ? null : display.getComparisonLabel(key);
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
    playRecordDisplays.some((display) => display.definition.isRecord(record)),
  );
  const newestDisplay = newestRecord
    ? playRecordDisplays.find((display) =>
        display.definition.isRecord(newestRecord),
      )
    : undefined;
  const [selectedGameId, setSelectedGameId] = useState(
    newestDisplay?.definition.gameId ?? playRecordDisplays[0].definition.gameId,
  );
  const [selectedComparisonKey, setSelectedComparisonKey] = useState<
    string | null
  >(null);
  const display =
    playRecordDisplays.find(
      (item) => item.definition.gameId === selectedGameId,
    ) ?? playRecordDisplays[0];
  const { definition } = display;
  const comparisonOptions = getComparisonOptions(sortedRecords, display);
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

  function handleGameChange(gameId: string) {
    setSelectedGameId(gameId);
    setSelectedComparisonKey(null);
  }

  function handleComparisonChange(comparisonKey: string) {
    setSelectedComparisonKey(comparisonKey);
  }

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
        <Select value={definition.gameId} onValueChange={handleGameChange}>
          <SelectTrigger size="sm" aria-label="パズル">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {playRecordDisplays.map((option) => (
              <SelectItem
                key={option.definition.gameId}
                value={option.definition.gameId}
              >
                {option.gameLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {comparisonOptions.length > 0 && (
          <Select
            value={effectiveComparisonKey ?? undefined}
            onValueChange={handleComparisonChange}
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
        <EmptyRecords gameLabel={display.gameLabel} />
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
              {personalBests.flatMap((best) => {
                const metricDisplay = getPersonalBestMetricDisplay(
                  display,
                  best.metricId,
                );
                if (!metricDisplay) {
                  return [];
                }

                return [
                  <div
                    key={best.metricId}
                    className="flex items-baseline gap-1.5"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {metricDisplay.label}
                    </dt>
                    <dd className="font-mono text-base font-semibold tabular-nums">
                      {metricDisplay.formatValue(best.value)}
                    </dd>
                  </div>,
                ];
              })}
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
                  display={display}
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

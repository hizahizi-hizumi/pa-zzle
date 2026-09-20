import { type ChangeEvent, type ReactNode, useMemo, useState } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyRecords } from "@/records/ui/PlayRecordsScreen/EmptyRecords";
import { PlayRecordRow } from "@/records/ui/PlayRecordsScreen/PlayRecordRow";
import { getPersonalBests } from "../personal-best";
import type { PlayRecord } from "../play-record";
import {
  getPersonalBestMetricDisplay,
  type PlayRecordDisplayCatalog,
  type PlayRecordDisplayDefinition,
} from "./play-record-display";

type PlayRecordsScreenProps = {
  records: readonly PlayRecord[];
  displays: PlayRecordDisplayCatalog;
  emptyAction: ReactNode;
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

export function PlayRecordsScreen({
  records,
  displays,
  emptyAction,
}: PlayRecordsScreenProps) {
  const sortedRecords = useMemo(
    () =>
      [...records].sort((left, right) => right.completedAt - left.completedAt),
    [records],
  );
  const newestRecord = sortedRecords.find((record) =>
    displays.some((display) => display.definition.isRecord(record)),
  );
  const newestDisplay = newestRecord
    ? displays.find((display) => display.definition.isRecord(newestRecord))
    : undefined;
  const [selectedGameId, setSelectedGameId] = useState(
    newestDisplay?.definition.gameId ?? displays[0].definition.gameId,
  );
  const [selectedComparisonKey, setSelectedComparisonKey] = useState<
    string | null
  >(null);
  const display =
    displays.find((item) => item.definition.gameId === selectedGameId) ??
    displays[0];
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

  function handleGameChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedGameId(event.target.value);
    setSelectedComparisonKey(null);
  }

  function handleComparisonChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedComparisonKey(event.target.value);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b pb-3">
        <NativeSelect
          size="sm"
          aria-label="パズル"
          value={definition.gameId}
          onChange={handleGameChange}
        >
          {displays.map((option) => (
            <NativeSelectOption
              key={option.definition.gameId}
              value={option.definition.gameId}
            >
              {option.gameLabel}
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
      </div>

      {comparisonOptions.length === 0 ? (
        <EmptyRecords gameLabel={display.gameLabel} action={emptyAction} />
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
    </>
  );
}

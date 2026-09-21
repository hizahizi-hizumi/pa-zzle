import { type ChangeEvent, type ReactNode, useMemo, useState } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyRecords } from "@/records/ui/PlayRecordsScreen/EmptyRecords";
import { PlayRecordsHistory } from "@/records/ui/PlayRecordsScreen/PlayRecordsHistory";
import { PlayRecordsTrend } from "@/records/ui/PlayRecordsScreen/PlayRecordsTrend";
import { getPersonalBests } from "../personal-best";
import type { PlayRecord } from "../play-record";
import {
  getPlayRecordMetricDisplay,
  type PlayRecordDisplayCatalog,
  type PlayRecordDisplayDefinition,
} from "./play-record-display";

type PlayRecordsScreenProps = {
  records: readonly PlayRecord[];
  displays: PlayRecordDisplayCatalog;
  emptyAction: ReactNode;
  onReplay: (recordId: string) => void;
};

type ComparisonOption = {
  key: string;
  label: string;
};

type RecordsMode = "history" | "trend";

function isRecordsMode(value: string): value is RecordsMode {
  return value === "history" || value === "trend";
}

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
  onReplay,
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
  const [mode, setMode] = useState<RecordsMode>("history");
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
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
      </header>

      {comparisonOptions.length === 0 ? (
        <EmptyRecords gameLabel={display.gameLabel} action={emptyAction} />
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
                <p className="text-meta text-muted-foreground">
                  {selectedRecords.length}件
                </p>
              </div>

              <TabsContent value="history">
                <PlayRecordsHistory
                  records={selectedRecords}
                  display={display}
                  personalBests={personalBests}
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

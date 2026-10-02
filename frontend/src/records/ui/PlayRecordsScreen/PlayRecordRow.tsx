import { Check, Clipboard, PlayIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getPersonalBestMetricIdsForRecord,
  type PersonalBest,
} from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";
import { formatRecordCompletedAt } from "@/records/ui/format";
import { getPlayRecordGridTemplateColumns } from "@/records/ui/PlayRecordsScreen/record-grid";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

type PlayRecordRowProps = {
  record: PlayRecord;
  display: PlayRecordDisplayDefinition;
  personalBests: readonly PersonalBest[];
  onReplay: (recordId: string) => void;
};

type CopyState = "idle" | "copied" | "failed";

export function PlayRecordRow({
  record,
  display,
  personalBests,
  onReplay,
}: PlayRecordRowProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const bestMetricIds = getPersonalBestMetricIdsForRecord(
    record,
    personalBests,
    display.definition,
  );
  const copyText = display.getHistoryCopyText?.(record) ?? null;

  async function copyRecord() {
    if (copyText === null) return;

    try {
      await navigator.clipboard.writeText(copyText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  }

  const copyLabel =
    copyState === "copied"
      ? "コピーしました"
      : copyState === "failed"
        ? "コピーできませんでした"
        : "再現用JSONをコピー";

  return (
    <li
      className="grid items-center gap-x-2 py-3"
      style={{
        gridTemplateColumns: getPlayRecordGridTemplateColumns(
          display.metrics.length,
          display.getHistoryCopyText !== undefined,
        ),
      }}
    >
      <p className="text-meta text-muted-foreground tabular-nums">
        {formatRecordCompletedAt(record.completedAt)}
      </p>
      {display.metrics.map((metric, metricIndex) => {
        const value = getPlayRecordMetricValue(
          record,
          display.definition,
          metric.id,
        );
        const isBest = bestMetricIds.includes(metric.id);
        const formattedValue = value === null ? "—" : metric.formatValue(value);

        return (
          <span
            key={metric.id}
            className={`min-w-0 text-right font-mono tabular-nums ${
              metricIndex === 0 ? "text-supporting" : "text-meta"
            } ${isBest ? "font-bold text-foreground" : "font-medium"}`}
            aria-label={
              isBest && value !== null
                ? `${metric.label} ${formattedValue} 自己ベスト`
                : `${metric.label} ${formattedValue}`
            }
          >
            {formattedValue}
          </span>
        );
      })}
      <div className="flex justify-end gap-1">
        {copyText !== null && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copyLabel}
            title={copyLabel}
            onClick={copyRecord}
          >
            {copyState === "copied" ? <Check /> : <Clipboard />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="同じ問題をプレイ"
          title="同じ問題をプレイ"
          onClick={() => onReplay(record.id)}
        >
          <PlayIcon />
        </Button>
      </div>
    </li>
  );
}

import type { ChangeEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { PlayRecord } from "@/records/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";
import { formatRecordCompletedAt } from "@/records/ui/format";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import { getTrendValueAxis } from "./trend-value-axis";

type PlayRecordsTrendProps = {
  records: readonly PlayRecord[];
  display: PlayRecordDisplayDefinition;
  metricId: string;
  onMetricChange: (metricId: string) => void;
};

type TrendPoint = {
  recordId: string;
  completedAt: number;
  value: number;
};

function getTrendPoints(
  records: readonly PlayRecord[],
  display: PlayRecordDisplayDefinition,
  metricId: string,
): TrendPoint[] {
  return [...records].reverse().flatMap((record) => {
    const value = getPlayRecordMetricValue(
      record,
      display.definition,
      metricId,
    );
    return value === null
      ? []
      : [{ recordId: record.id, completedAt: record.completedAt, value }];
  });
}

export function PlayRecordsTrend({
  records,
  display,
  metricId,
  onMetricChange,
}: PlayRecordsTrendProps) {
  const metric =
    display.metrics.find((candidate) => candidate.id === metricId) ??
    display.metrics[0];

  function handleMetricChange(event: ChangeEvent<HTMLSelectElement>) {
    onMetricChange(event.target.value);
  }

  if (!metric) {
    return null;
  }

  const points = getTrendPoints(records, display, metric.id);
  if (points.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        表示できる記録がありません。
      </p>
    );
  }

  const chartConfig = {
    value: {
      label: metric.label,
      color: "var(--foreground)",
    },
  } satisfies ChartConfig;
  const axisValues = points.map((point) => point.value);
  if (metric.referenceValue !== undefined) {
    axisValues.push(metric.referenceValue);
  }
  const valueAxis = getTrendValueAxis(axisValues, metric.axis);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <NativeSelect
          size="sm"
          aria-label="推移する指標"
          value={metric.id}
          onChange={handleMetricChange}
        >
          {display.metrics.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <ChartContainer
        config={chartConfig}
        role="img"
        aria-label={`${metric.label}の推移`}
      >
        <LineChart accessibilityLayer data={points}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="completedAt"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={36}
            tickFormatter={(value) => formatRecordCompletedAt(Number(value))}
          />
          <YAxis
            domain={valueAxis.domain}
            ticks={valueAxis.ticks}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => metric.formatValue(Number(value))}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_label, payload) => {
                  const completedAt = payload[0]?.payload?.completedAt;
                  return typeof completedAt === "number"
                    ? formatRecordCompletedAt(completedAt)
                    : null;
                }}
                formatter={(value) => metric.formatValue(Number(value))}
              />
            }
          />
          {metric.referenceValue !== undefined && (
            <ReferenceLine
              y={metric.referenceValue}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
            />
          )}
          <Line
            dataKey="value"
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>

      {metric.referenceValue !== undefined && (
        <p className="mt-2 text-right text-[11px] text-muted-foreground">
          破線: 基準 {metric.formatValue(metric.referenceValue)}
        </p>
      )}
    </div>
  );
}

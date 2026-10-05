import { Fragment } from "react";

import { MetricSeparator } from "@/components/PlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/components/PlayHeader/PlayHeaderSummary/PlayMetric";
import type { PlayHeaderMetric } from "@/components/play-header-metric";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { cn } from "@/lib/utils";

/** 狭い幅で行を分けるときも、同じ行に残す計測値のまとまり。 */
type PlayHeaderMetricGroup = readonly PlayHeaderMetric[];

type PlayHeaderSummaryProps = {
  title: string;
  metrics: readonly PlayHeaderMetric[];
};

/** 狭い幅で行を分けるとき、計測値を前から2つずつ同じ行に残す。 */
const metricsPerGroup = 2;

/** 回数は2桁分の幅を取り、10回目で周りの計測値が横へ動かないようにする。 */
const countReservedDigits = 2;

type MetricRowLayout = { row: string; groupSeparator: string };

// 計測値が1行に収まる幅の目安は項目数で決まる。Tailwindが静的に読み取れるよう、クラス名を列挙する。
const threeMetricsLayout: MetricRowLayout = {
  row: "flex-col @[14.5rem]:flex-row @[14.5rem]:justify-center @[14.5rem]:gap-2",
  groupSeparator: "hidden @[14.5rem]:inline",
};
const fourMetricsLayout: MetricRowLayout = {
  row: "flex-col @[16.5rem]:flex-row @[16.5rem]:justify-center @[16.5rem]:gap-2",
  groupSeparator: "hidden @[16.5rem]:inline",
};
const singleLineLayout: MetricRowLayout = {
  row: "justify-center gap-2",
  groupSeparator: "inline",
};

function groupMetrics(
  metrics: readonly PlayHeaderMetric[],
): PlayHeaderMetricGroup[] {
  const groups: PlayHeaderMetricGroup[] = [];
  for (let start = 0; start < metrics.length; start += metricsPerGroup) {
    groups.push(metrics.slice(start, start + metricsPerGroup));
  }
  return groups;
}

function getMetricLabel(metric: PlayHeaderMetric): string {
  return metric.type === "count" ? metric.label : "時間";
}

function selectLayout(
  metricGroups: readonly PlayHeaderMetricGroup[],
): MetricRowLayout {
  if (metricGroups.length <= 1) return singleLineLayout;
  const metricCount = metricGroups.reduce(
    (count, group) => count + group.length,
    0,
  );
  return metricCount <= 3 ? threeMetricsLayout : fourMetricsLayout;
}

export function PlayHeaderSummary({ title, metrics }: PlayHeaderSummaryProps) {
  const metricGroups = groupMetrics(metrics);
  const layout = selectLayout(metricGroups);

  return (
    <div className="@container min-w-0 text-center">
      <h1 className="truncate text-play-context">{title}</h1>
      <div
        className={cn(
          "mt-1 flex items-center text-play-meta text-muted-foreground",
          layout.row,
        )}
      >
        {metricGroups.map((group, groupIndex) => (
          <Fragment key={group.map(getMetricLabel).join("/")}>
            {groupIndex > 0 && (
              <span className={layout.groupSeparator}>
                <MetricSeparator />
              </span>
            )}
            <div className="flex items-center justify-center gap-2">
              {group.map((metric, metricIndex) => (
                <Fragment key={getMetricLabel(metric)}>
                  {metricIndex > 0 && <MetricSeparator />}
                  {metric.type === "count" ? (
                    <PlayMetric
                      label={metric.label}
                      value={String(metric.count)}
                      reservedDigits={countReservedDigits}
                    />
                  ) : (
                    <PlayMetric
                      label={getMetricLabel(metric)}
                      value={formatElapsedTime(metric.elapsedMs)}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

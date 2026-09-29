import { Fragment } from "react";

import { MetricSeparator } from "@/components/PlayHeader/PlayHeaderSummary/MetricSeparator";
import { PlayMetric } from "@/components/PlayHeader/PlayHeaderSummary/PlayMetric";
import { cn } from "@/lib/utils";

export type PlayHeaderMetric = {
  label: string;
  value: string;
  /** 値がこの桁数に満たなくても、この桁数分の幅を取る。桁が増えても周りの計測値を動かさない。 */
  reservedDigits?: number;
};

/** 狭い幅で行を分けるときも、同じ行に残す計測値のまとまり。 */
export type PlayHeaderMetricGroup = readonly PlayHeaderMetric[];

type PlayHeaderSummaryProps = {
  title: string;
  metricGroups: readonly PlayHeaderMetricGroup[];
};

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

export function PlayHeaderSummary({
  title,
  metricGroups,
}: PlayHeaderSummaryProps) {
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
          <Fragment key={group.map((metric) => metric.label).join("/")}>
            {groupIndex > 0 && (
              <span className={layout.groupSeparator}>
                <MetricSeparator />
              </span>
            )}
            <div className="flex items-center justify-center gap-2">
              {group.map((metric, metricIndex) => (
                <Fragment key={metric.label}>
                  {metricIndex > 0 && <MetricSeparator />}
                  <PlayMetric
                    label={metric.label}
                    value={metric.value}
                    reservedDigits={metric.reservedDigits}
                  />
                </Fragment>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

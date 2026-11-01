import { useId } from "react";

import { ToggleGroup } from "@/components/ui/toggle-group";
import { ZukanFilterOption } from "@/zukan/ui/GameHomeScreen/ZukanFilter/ZukanFilterPanel/ZukanFilterOption";
import {
  formatZukanFeatureOption,
  type ZukanFilterFeatureAxis,
  zukanPerformanceAxisLabels,
  zukanPerformanceConditionLabels,
} from "@/zukan/ui/GameHomeScreen/zukan-filter-appearance";
import {
  getZukanProblemStatusClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";
import {
  getZukanFeatureOptionKey,
  isZukanPerformanceConditionOfAxis,
  type ZukanFilterConditions,
  type ZukanFilterOptionCounts,
  type ZukanPerformanceAxis,
  zukanPerformanceConditionsByAxis,
} from "@/zukan/zukan-filter";

type ZukanFilterPanelProps = {
  conditions: ZukanFilterConditions;
  /** 開いているレベルで選べる特徴の軸。 */
  featureAxes: readonly ZukanFilterFeatureAxis[];
  /** そのゲームが数える成績の軸。 */
  performanceAxes: readonly ZukanPerformanceAxis[];
  /** 選択肢ごとの、今の条件で当たる問題の数。 */
  optionCounts: ZukanFilterOptionCounts;
  /** 選択肢ごとの、条件をかけないときに当たる問題の数。 */
  optionCountLimits: ZukanFilterOptionCounts;
  onConditionsChange: (conditions: ZukanFilterConditions) => void;
};

function isZukanProblemStatus(value: string): value is ZukanProblemStatus {
  return (zukanProblemStatusOrder as readonly string[]).includes(value);
}

/**
 * 絞り込みの条件を選ぶ並び。状態・問題の特徴・成績の種類ごとに、選択肢を何個でも選べるボタンで並べる。
 * 状態の選択肢はマスと同じ見本を添える。特徴は軸ごとに名前と選択肢を並べ、選べる軸が無ければ特徴の並びを出さない。
 * 成績は解いた問題を分けるもので、そのゲームが数える軸だけを、特徴と同じく軸ごとに並べる。
 * 各選択肢には、ほかの種類の条件をかけた上でその選択肢に当たる問題の数を添える。
 */
export function ZukanFilterPanel({
  conditions,
  featureAxes,
  performanceAxes,
  optionCounts,
  optionCountLimits,
  onConditionsChange,
}: ZukanFilterPanelProps) {
  const id = useId();
  return (
    <div className="grid gap-4">
      <section aria-labelledby={`${id}-status`}>
        <h3
          id={`${id}-status`}
          className="text-meta font-medium text-muted-foreground"
        >
          状態
        </h3>
        <div className="mt-1.5">
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            spacing={1}
            selection="filled"
            layout="wrap"
            aria-labelledby={`${id}-status`}
            value={[...conditions.statuses]}
            onValueChange={(values) =>
              onConditionsChange({
                ...conditions,
                statuses: values.filter(isZukanProblemStatus),
              })
            }
          >
            {zukanProblemStatusOrder.map((status) => (
              <ZukanFilterOption
                key={status}
                value={status}
                label={zukanProblemStatusLabels[status]}
                sample={
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 ${getZukanProblemStatusClassName(status)}`}
                  />
                }
                isSelected={conditions.statuses.includes(status)}
                count={optionCounts.statuses[status]}
                countLimit={optionCountLimits.statuses[status]}
              />
            ))}
          </ToggleGroup>
        </div>
      </section>

      {featureAxes.length > 0 && (
        <section aria-labelledby={`${id}-features`}>
          <h3
            id={`${id}-features`}
            className="text-meta font-medium text-muted-foreground"
          >
            問題の特徴
          </h3>
          <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
            {featureAxes.map(({ axisId, display, options }) => {
              const selectedKeys = conditions.features[axisId] ?? [];
              return (
                <div
                  key={axisId}
                  className="col-span-full grid grid-cols-subgrid items-start"
                >
                  <span
                    id={`${id}-feature-${axisId}`}
                    className="py-1.5 text-supporting whitespace-nowrap"
                  >
                    {display.label}
                  </span>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    size="sm"
                    spacing={1}
                    selection="filled"
                    layout="wrap"
                    aria-labelledby={`${id}-feature-${axisId}`}
                    value={[...selectedKeys]}
                    onValueChange={(keys) =>
                      onConditionsChange({
                        ...conditions,
                        features: { ...conditions.features, [axisId]: keys },
                      })
                    }
                  >
                    {options.map((option) => {
                      const key = getZukanFeatureOptionKey(option);
                      return (
                        <ZukanFilterOption
                          key={key}
                          value={key}
                          label={formatZukanFeatureOption(option, display)}
                          isSelected={selectedKeys.includes(key)}
                          count={optionCounts.features[axisId]?.[key] ?? 0}
                          countLimit={
                            optionCountLimits.features[axisId]?.[key] ?? 0
                          }
                        />
                      );
                    })}
                  </ToggleGroup>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {performanceAxes.length > 0 && (
        <section aria-labelledby={`${id}-performances`}>
          <h3
            id={`${id}-performances`}
            className="text-meta font-medium text-muted-foreground"
          >
            成績（解いた問題）
          </h3>
          <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
            {performanceAxes.map((axis) => (
              <div
                key={axis}
                className="col-span-full grid grid-cols-subgrid items-start"
              >
                <span
                  id={`${id}-performance-${axis}`}
                  className="py-1.5 text-supporting whitespace-nowrap"
                >
                  {zukanPerformanceAxisLabels[axis]}
                </span>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  spacing={1}
                  selection="filled"
                  layout="wrap"
                  aria-labelledby={`${id}-performance-${axis}`}
                  value={conditions.performances.filter((condition) =>
                    isZukanPerformanceConditionOfAxis(condition, axis),
                  )}
                  onValueChange={(values) =>
                    onConditionsChange({
                      ...conditions,
                      performances: [
                        ...conditions.performances.filter(
                          (condition) =>
                            !isZukanPerformanceConditionOfAxis(condition, axis),
                        ),
                        ...values.filter((value) =>
                          isZukanPerformanceConditionOfAxis(value, axis),
                        ),
                      ],
                    })
                  }
                >
                  {zukanPerformanceConditionsByAxis[axis].map((condition) => (
                    <ZukanFilterOption
                      key={condition}
                      value={condition}
                      label={zukanPerformanceConditionLabels[condition]}
                      isSelected={conditions.performances.includes(condition)}
                      count={optionCounts.performances[condition]}
                      countLimit={optionCountLimits.performances[condition]}
                    />
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

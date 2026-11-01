import { CheckIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatZukanFeatureOption,
  type ZukanFilterFeatureAxis,
  zukanPerformanceAxisLabels,
  zukanPerformanceConditionLabels,
} from "@/zukan/ui/GameZukanScreen/zukan-filter-appearance";
import {
  getZukanProblemStatusClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameZukanScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";
import {
  getZukanFeatureOptionKey,
  type ZukanFilterConditions,
  type ZukanPerformanceAxis,
  type ZukanPerformanceCondition,
  zukanPerformanceConditionsByAxis,
} from "@/zukan/zukan-filter";

type ZukanFilterPanelProps = {
  conditions: ZukanFilterConditions;
  /** 開いているレベルで選べる特徴の軸。 */
  featureAxes: readonly ZukanFilterFeatureAxis[];
  /** そのゲームが数える成績の軸。 */
  performanceAxes: readonly ZukanPerformanceAxis[];
  onConditionsChange: (conditions: ZukanFilterConditions) => void;
};

function isZukanProblemStatus(value: string): value is ZukanProblemStatus {
  return (zukanProblemStatusOrder as readonly string[]).includes(value);
}

function isZukanPerformanceCondition(
  value: string,
): value is ZukanPerformanceCondition {
  return Object.hasOwn(zukanPerformanceConditionLabels, value);
}

function isConditionOfAxis(
  condition: ZukanPerformanceCondition,
  axis: ZukanPerformanceAxis,
): boolean {
  const axisConditions: readonly ZukanPerformanceCondition[] =
    zukanPerformanceConditionsByAxis[axis];
  return axisConditions.includes(condition);
}

/** 選んだ選択肢には印を付け、選んでいないものと塗りの差だけで見分けさせない。 */
function renderOptionContent(isSelected: boolean, label: ReactNode) {
  return (
    <>
      {isSelected && <CheckIcon aria-hidden="true" />}
      {label}
    </>
  );
}

/**
 * 絞り込みの条件を選ぶ並び。状態・問題の特徴・成績の種類ごとに、選択肢を何個でも選べるボタンで並べる。
 * 状態の選択肢はマスと同じ見本を添える。特徴は軸ごとに名前と選択肢を並べ、選べる軸が無ければ特徴の並びを出さない。
 * 成績は解いた問題を分けるもので、そのゲームが数える軸だけを出す。
 */
export function ZukanFilterPanel({
  conditions,
  featureAxes,
  performanceAxes,
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
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={1}
          aria-labelledby={`${id}-status`}
          value={[...conditions.statuses]}
          onValueChange={(values) =>
            onConditionsChange({
              ...conditions,
              statuses: values.filter(isZukanProblemStatus),
            })
          }
          className="mt-1.5 flex-wrap"
        >
          {zukanProblemStatusOrder.map((status) => (
            <ToggleGroupItem key={status} value={status}>
              {renderOptionContent(
                conditions.statuses.includes(status),
                <>
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 ${getZukanProblemStatusClassName(status)}`}
                  />
                  {zukanProblemStatusLabels[status]}
                </>,
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
                    aria-labelledby={`${id}-feature-${axisId}`}
                    value={[...selectedKeys]}
                    onValueChange={(keys) =>
                      onConditionsChange({
                        ...conditions,
                        features: { ...conditions.features, [axisId]: keys },
                      })
                    }
                    className="flex-wrap"
                  >
                    {options.map((option) => {
                      const key = getZukanFeatureOptionKey(option);
                      return (
                        <ToggleGroupItem
                          key={key}
                          value={key}
                          className="tabular-nums"
                        >
                          {renderOptionContent(
                            selectedKeys.includes(key),
                            formatZukanFeatureOption(option, display),
                          )}
                        </ToggleGroupItem>
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
                  aria-labelledby={`${id}-performance-${axis}`}
                  value={conditions.performances.filter((condition) =>
                    isConditionOfAxis(condition, axis),
                  )}
                  onValueChange={(values) =>
                    onConditionsChange({
                      ...conditions,
                      performances: [
                        ...conditions.performances.filter(
                          (condition) => !isConditionOfAxis(condition, axis),
                        ),
                        ...values.filter(isZukanPerformanceCondition),
                      ],
                    })
                  }
                  className="flex-wrap"
                >
                  {zukanPerformanceConditionsByAxis[axis].map((condition) => (
                    <ToggleGroupItem key={condition} value={condition}>
                      {renderOptionContent(
                        conditions.performances.includes(condition),
                        zukanPerformanceConditionLabels[condition],
                      )}
                    </ToggleGroupItem>
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

import { useId } from "react";
import { ZukanFilterOption } from "@/app/game-home/GameHomeScreen/ZukanFilter/ZukanFilterPanel/ZukanFilterOption";
import {
  formatZukanFeatureOption,
  type ZukanFilterFeatureAxis,
  zukanPerformanceAxisLabels,
  zukanPerformanceConditionLabels,
} from "@/app/game-home/GameHomeScreen/zukan-filter-appearance";
import {
  getZukanProblemStatusColorClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/app/game-home/GameHomeScreen/zukan-problem-appearance";
import { ToggleGroup } from "@/components/ui/toggle-group";
import type { ZukanProblemStatus } from "@/features/zukan/zukan-collection";
import {
  getZukanFeatureOptionKey,
  isZukanPerformanceConditionOfAxis,
  type ZukanFilterConditions,
  type ZukanFilterOptionCounts,
  type ZukanPerformanceAxis,
  zukanPerformanceConditionsByAxis,
} from "@/features/zukan/zukan-filter";

type ZukanFilterPanelProps = {
  conditions: ZukanFilterConditions;
  featureAxes: readonly ZukanFilterFeatureAxis[];
  performanceAxes: readonly ZukanPerformanceAxis[];
  optionCounts: ZukanFilterOptionCounts;
  unfilteredOptionCounts: ZukanFilterOptionCounts;
  onConditionsChange: (conditions: ZukanFilterConditions) => void;
};

function isZukanProblemStatus(value: string): value is ZukanProblemStatus {
  return (zukanProblemStatusOrder as readonly string[]).includes(value);
}

export function ZukanFilterPanel({
  conditions,
  featureAxes,
  performanceAxes,
  optionCounts,
  unfilteredOptionCounts,
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
            selection="ring"
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
                    className={`size-3 shrink-0 bg-current ${getZukanProblemStatusColorClassName(status)}`}
                  />
                }
                isSelected={conditions.statuses.includes(status)}
                count={optionCounts.statuses[status]}
                unfilteredCount={unfilteredOptionCounts.statuses[status]}
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
                    selection="ring"
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
                          unfilteredCount={
                            unfilteredOptionCounts.features[axisId]?.[key] ?? 0
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
                  selection="ring"
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
                      unfilteredCount={
                        unfilteredOptionCounts.performances[condition]
                      }
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

import { XIcon } from "lucide-react";
import { VisuallyHidden } from "radix-ui";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { GameHomeLayerControl } from "@/zukan/ui/GameHomeScreen/use-game-home-layers";
import { useHeaderLayerSheet } from "@/zukan/ui/GameHomeScreen/use-header-layer-sheet";
import { ZukanFilterPanel } from "@/zukan/ui/GameHomeScreen/ZukanFilter/ZukanFilterPanel";
import type { ZukanFilterFeatureAxis } from "@/zukan/ui/GameHomeScreen/zukan-filter-appearance";
import {
  countZukanFilterConditions,
  noZukanFilterConditions,
  type ZukanFilterConditions,
  type ZukanFilterOptionCounts,
  type ZukanPerformanceAxis,
} from "@/zukan/zukan-filter";

type ZukanFilterProps = GameHomeLayerControl & {
  conditions: ZukanFilterConditions;
  /** 開いているレベルの、条件に当たる問題の数。 */
  matchedCount: number;
  /** 開いているレベルで選べる特徴の軸。条件を選ぶ並びを開いている間だけ求める。 */
  featureAxes: readonly ZukanFilterFeatureAxis[];
  performanceAxes: readonly ZukanPerformanceAxis[];
  /** 開いているレベルの選択肢ごとの、今の条件で当たる問題の数。 */
  optionCounts: ZukanFilterOptionCounts;
  /** 開いているレベルの選択肢ごとの、条件をかけないときに当たる問題の数。 */
  optionCountLimits: ZukanFilterOptionCounts;
  onConditionsChange: (conditions: ZukanFilterConditions) => void;
};

/**
 * 図鑑の絞り込み。条件を選ぶ並びを、スマートフォンでは画面の下からのシート、PC では見出しのメニューのボタンから出すポップオーバーで出す。
 * 選んだ条件はすぐ台紙に映し、当たる問題の数を並びの下に示す。条件は並びの「解除」で全部外せる。
 */
export function ZukanFilter({
  conditions,
  matchedCount,
  featureAxes,
  performanceAxes,
  optionCounts,
  optionCountLimits,
  open,
  onOpenChange,
  anchorRef,
  onConditionsChange,
}: ZukanFilterProps) {
  const isSheet = useHeaderLayerSheet();
  const titleId = useId();
  const isFiltering = countZukanFilterConditions(conditions) > 0;

  const panel = (
    <ZukanFilterPanel
      conditions={conditions}
      featureAxes={featureAxes}
      performanceAxes={performanceAxes}
      optionCounts={optionCounts}
      optionCountLimits={optionCountLimits}
      onConditionsChange={onConditionsChange}
    />
  );
  const summary = (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <p className="text-supporting text-muted-foreground" aria-live="polite">
        {isFiltering && (
          <>
            該当{" "}
            <span className="font-medium text-foreground tabular-nums">
              {matchedCount}
            </span>
            問
          </>
        )}
      </p>
      {/* 押した解除が押せなくなってもフォーカスを見失わないよう、条件が無い間も押せないことを示すだけにする。 */}
      <Button
        variant="outline"
        size="sm"
        aria-disabled={!isFiltering}
        onClick={() => {
          if (isFiltering) {
            onConditionsChange(noZukanFilterConditions);
          }
        }}
      >
        解除
      </Button>
    </div>
  );

  if (isSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" layout="sections" showCloseButton={false}>
          <SheetHeader layout="inline">
            <SheetTitle>絞り込み</SheetTitle>
            <VisuallyHidden.Root asChild>
              <SheetDescription>
                条件に当たる問題を台紙の前に集めます。
              </SheetDescription>
            </VisuallyHidden.Root>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="閉じる">
                <XIcon aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-2">{panel}</div>
          <SheetFooter variant="bar">{summary}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent align="end" size="wide" aria-labelledby={titleId}>
        <div className="grid gap-3">
          <h2 id={titleId} className="font-semibold">
            絞り込み
          </h2>
          {panel}
          <div className="border-t pt-3">{summary}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

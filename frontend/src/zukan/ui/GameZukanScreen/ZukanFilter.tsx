import { ListFilterIcon, XIcon } from "lucide-react";
import { useId, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ZukanFilterPanel } from "@/zukan/ui/GameZukanScreen/ZukanFilter/ZukanFilterPanel";
import type { ZukanFilterFeatureAxis } from "@/zukan/ui/GameZukanScreen/zukan-filter-appearance";
import {
  countZukanFilterConditions,
  noZukanFilterConditions,
  type ZukanFilterConditions,
  type ZukanPerformanceAxis,
} from "@/zukan/zukan-filter";

type ZukanFilterProps = {
  conditions: ZukanFilterConditions;
  /** 開いているレベルの、条件に当たる問題の数。 */
  matchedCount: number;
  /** 開いているレベルで選べる特徴の軸。条件を選ぶ並びを開いている間だけ求める。 */
  featureAxes: readonly ZukanFilterFeatureAxis[];
  performanceAxes: readonly ZukanPerformanceAxis[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConditionsChange: (conditions: ZukanFilterConditions) => void;
};

/** 条件を選ぶ並びを、画面の下から出すシートで出す画面幅。より広い幅では、ボタンから出すポップオーバーで出す。 */
const SHEET_MEDIA_QUERY = "(width < 40rem)";

function subscribeSheetMedia(onChange: () => void): () => void {
  const media = window.matchMedia?.(SHEET_MEDIA_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function readSheetMedia(): boolean {
  return window.matchMedia?.(SHEET_MEDIA_QUERY).matches ?? false;
}

/**
 * 図鑑の絞り込み。押すと条件を選ぶ並びを、スマートフォンでは画面の下からのシート、PC ではボタンから出すポップオーバーで出す。
 * 選んだ条件はすぐ台紙に映し、当たる問題の数を並びの下に示す。条件をかけている間は、ボタンに条件の数を添え、並びの「解除」で全部外せる。
 */
export function ZukanFilter({
  conditions,
  matchedCount,
  featureAxes,
  performanceAxes,
  open,
  onOpenChange,
  onConditionsChange,
}: ZukanFilterProps) {
  const isSheet = useSyncExternalStore(subscribeSheetMedia, readSheetMedia);
  const titleId = useId();
  const conditionCount = countZukanFilterConditions(conditions);
  const isFiltering = conditionCount > 0;

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={
        isFiltering ? `絞り込み、条件${conditionCount}つ` : "絞り込み"
      }
    >
      <ListFilterIcon aria-hidden="true" />
      絞り込み
      {isFiltering && (
        <Badge variant="secondary" className="tabular-nums">
          {conditionCount}
        </Badge>
      )}
    </Button>
  );
  const panel = (
    <ZukanFilterPanel
      conditions={conditions}
      featureAxes={featureAxes}
      performanceAxes={performanceAxes}
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
      <Button
        variant="outline"
        size="sm"
        disabled={!isFiltering}
        onClick={() => onConditionsChange(noZukanFilterConditions)}
      >
        解除
      </Button>
    </div>
  );

  if (isSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[85dvh] gap-0"
        >
          <SheetHeader className="flex-row items-center justify-between pb-2">
            <SheetTitle>絞り込み</SheetTitle>
            <SheetDescription className="sr-only">
              条件に当たる問題を台紙の前に集めます。
            </SheetDescription>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="閉じる">
                <XIcon aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-2">{panel}</div>
          <SheetFooter className="border-t pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
            {summary}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby={titleId}
        className="grid w-96 gap-3"
      >
        <h2 id={titleId} className="font-semibold">
          絞り込み
        </h2>
        {panel}
        <div className="border-t pt-3">{summary}</div>
      </PopoverContent>
    </Popover>
  );
}

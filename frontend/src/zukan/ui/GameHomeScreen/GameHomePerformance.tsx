import { XIcon } from "lucide-react";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { PlayRecord } from "@/records/play-record";
import { PlayRecordsPerformance } from "@/records/ui/PlayRecordsPerformance";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import type { GameHomeLayerControl } from "@/zukan/ui/GameHomeScreen/use-game-home-layers";
import { useHeaderLayerSheet } from "@/zukan/ui/GameHomeScreen/use-header-layer-sheet";

type GameHomePerformanceProps = GameHomeLayerControl & {
  /** 全記録。開いているレベルの記録は、成績を開いたときにこの中から選ぶ。 */
  records: readonly PlayRecord[];
  playRecordDisplay: PlayRecordDisplayDefinition;
  /** 開いているレベル。成績はこのレベルの分だけを示す。 */
  difficulty: DifficultyLevel;
};

/**
 * 開いているレベルの成績（自己ベスト・推移。内部診断が有効なビルドでは記録の JSON コピーも）。見出しのメニューから、スマートフォンでは画面の下からのシート、PC ではメニューのボタンから出すポップオーバーで出す。
 * 中身は開いたときだけ描き、ゲームのホームを開くまでの時間を延ばさない。
 */
export function GameHomePerformance({
  records,
  playRecordDisplay,
  difficulty,
  open,
  onOpenChange,
  anchorRef,
}: GameHomePerformanceProps) {
  const isSheet = useHeaderLayerSheet();
  const titleId = useId();
  const levelLabel = getDifficultyLabel(difficulty);
  const performance = (
    <PlayRecordsPerformance
      records={records}
      display={playRecordDisplay}
      comparisonKey={difficulty}
    />
  );

  if (isSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" layout="sections" showCloseButton={false}>
          <SheetHeader layout="inline">
            <div className="flex items-baseline gap-2">
              <SheetTitle>成績</SheetTitle>
              <SheetDescription>{levelLabel}</SheetDescription>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="閉じる">
                <XIcon aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
            {performance}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent align="end" size="wide" aria-labelledby={titleId}>
        <div className="grid gap-3">
          <div className="flex items-baseline gap-2">
            <h2 id={titleId} className="font-semibold">
              成績
            </h2>
            <p className="text-supporting text-muted-foreground">
              {levelLabel}
            </p>
          </div>
          {performance}
        </div>
      </PopoverContent>
    </Popover>
  );
}

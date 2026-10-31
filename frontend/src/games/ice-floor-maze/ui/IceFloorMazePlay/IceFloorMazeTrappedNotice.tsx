import { RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type IceFloorMazeTrappedNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

/** 今の位置から行けるどこにもゴールが無く、どこからも今の位置へ戻るだけになったことを知らせ、戻る操作へ導く。 */
export function IceFloorMazeTrappedNotice({
  canUndo,
  onUndo,
  onRestart,
}: IceFloorMazeTrappedNoticeProps) {
  return (
    <div
      role="status"
      className="mx-auto max-w-md rounded-xl border-(length:--border-width-normal) bg-muted/50 px-3 py-2"
    >
      <div className="text-center">
        <p className="text-play-context">閉じ込められた</p>
      </div>
      <div className="mt-1 flex justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 />
          {PLAY_OPERATION_LABELS.undo}
        </Button>
        <Button type="button" variant="outline" onClick={onRestart}>
          <RotateCcw />
          {PLAY_OPERATION_LABELS.restart}
        </Button>
      </div>
    </div>
  );
}

import { RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type IceFloorMazeTrappedNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

/**
 * もうゴールに止まれないことを知らせ、戻る操作へ導く。閉じ込め（ゴールで止まれず、崩す・割る滑りのほかは同じところを回るだけ）に
 * 入ったときに出し、ゴールに止まれる状態へ戻るまで出し続ける。駒はまだ動けるので、動けないとは言わない。
 */
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
        <p className="text-play-context">もうゴールに止まれない</p>
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

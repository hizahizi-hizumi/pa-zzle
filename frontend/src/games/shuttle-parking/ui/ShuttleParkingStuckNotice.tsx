import { Undo2 } from "lucide-react";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

/** 詰んだときの知らせの言葉。遊び方の見出しも、この言葉にそろえる。 */
export const STUCK_NOTICE_LABEL = "出せる車がありません";

/** 原因は何台か前の出し方のことがあるので、1台だけ戻せば済むとは言わない。 */
export const STUCK_NOTICE_HINT = "何台か戻すか 最初の盤面から出し直します";

/** 盤面を戻すボタンは、メニューの「盤面を戻す」と同じアイコンにする。 */
const RestartIcon = playMenuOperationItems.restart.icon;

type ShuttleParkingStuckNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

/** 詰みの知らせ。駐車場の上に重ねて出し、遊び方では同じ姿を押しても何も起きない図で見せる。 */
export function ShuttleParkingStuckNotice({
  canUndo,
  onUndo,
  onRestart,
}: ShuttleParkingStuckNoticeProps) {
  return (
    <div
      role="status"
      className="mx-auto w-fit max-w-full rounded-lg bg-background/95 px-4 py-3 text-center shadow-md"
    >
      <p className="text-play-context">{STUCK_NOTICE_LABEL}</p>
      <p className="text-play-context text-muted-foreground">
        {STUCK_NOTICE_HINT}
      </p>
      <div className="mt-2 flex justify-center gap-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 />
          {PLAY_OPERATION_LABELS.undo}
        </Button>
        <Button type="button" variant="secondary" onClick={onRestart}>
          <RestartIcon />
          {PLAY_OPERATION_LABELS.restart}
        </Button>
      </div>
    </div>
  );
}

import { Undo2 } from "lucide-react";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type DeadlockNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

/** 手詰まりの知らせの言葉。遊び方の見出しと一文も、この言葉にそろえる。 */
export const DEADLOCK_NOTICE_LABEL = "手詰まり";

/** 盤面を戻すは、プレイ中のメニューと同じ印にする。 */
const RestartIcon = playMenuOperationItems.restart.icon;

/** 手詰まりの知らせ。プレイ画面の下端に出し、遊び方では同じ姿を押しても何も起きない図で見せる。 */
export function DeadlockNotice({
  canUndo,
  onUndo,
  onRestart,
}: DeadlockNoticeProps) {
  return (
    <div role="status" className="mx-auto max-w-md px-3 py-2">
      <div className="text-center">
        <p className="text-play-context">{DEADLOCK_NOTICE_LABEL}</p>
      </div>
      <div className="mt-1 flex justify-center gap-1">
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

import { Undo2 } from "lucide-react";

import { playMenuOperationItems } from "@/components/play-menu-operations";
import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

/** 知らせの言葉。遊び方の見出しも同じ言葉にする。 */
export const TRAPPED_NOTICE_LABEL = "もうゴールに止まれない";

/** 盤面を戻すボタンは、メニューの「盤面を戻す」と同じアイコンにし、リセットのアイコンと取り違えないようにする。 */
const RestartIcon = playMenuOperationItems.restart.icon;

type IceFloorMazeTrappedNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

export function IceFloorMazeTrappedNotice({
  canUndo,
  onUndo,
  onRestart,
}: IceFloorMazeTrappedNoticeProps) {
  return (
    <div role="status" className="mx-auto max-w-md px-3 py-2">
      <div className="text-center">
        <p className="text-play-context">{TRAPPED_NOTICE_LABEL}</p>
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

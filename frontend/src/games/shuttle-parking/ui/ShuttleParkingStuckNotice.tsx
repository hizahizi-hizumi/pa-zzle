import { Undo2 } from "lucide-react";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { Button } from "@/components/ui/button";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

/** 詰んだときの知らせの言葉。遊び方の見出しも、この言葉にそろえる。 */
export const STUCK_NOTICE_LABEL = "出せる車がありません";

/** 盤面を戻すボタンは、メニューの「盤面を戻す」と同じアイコンにする。 */
const RestartIcon = playMenuOperationItems.restart.icon;

type ShuttleParkingStuckNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

/**
 * 詰みの知らせ。原因を探すときに駐車場を見られるよう、言葉と2つのボタンを1行に詰めて駐車場の下に出す。
 * 待ったは待機枠の行の待ったと同じアイコンだけのボタンにする。遊び方では同じ姿を押しても何も起きない図で見せる。
 */
export function ShuttleParkingStuckNotice({
  canUndo,
  onUndo,
  onRestart,
}: ShuttleParkingStuckNoticeProps) {
  return (
    <div
      role="status"
      className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-lg bg-background/95 px-2 py-1.5 shadow-raised"
    >
      <p className="text-play-context">{STUCK_NOTICE_LABEL}</p>
      <div className="flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={PLAY_OPERATION_LABELS.undo}
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 />
        </Button>
        <Button type="button" variant="secondary" onClick={onRestart}>
          <RestartIcon />
          {/* 1行に収まらない狭い画面では、メニューと同じアイコンだけを見せる。遊び方の見本も同じ姿になる。 */}
          <span className="max-[24rem]:sr-only">
            {PLAY_OPERATION_LABELS.restart}
          </span>
        </Button>
      </div>
    </div>
  );
}

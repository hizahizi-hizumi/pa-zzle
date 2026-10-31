import { PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReplayPlayButtonProps = {
  /** 遊び直せないプレイでは押せない状態で示す。 */
  replayable: boolean;
  onReplay: () => void;
};

const replayLabel = "同じ問題をプレイ";
const unavailableReplayLabel = "この記録の問題は今は遊べません";

/** 履歴の1行のプレイと同じ問題を、通常のプレイとして遊び直す操作。完了・離脱のどちらの行でも同じに見せる。 */
export function ReplayPlayButton({
  replayable,
  onReplay,
}: ReplayPlayButtonProps) {
  const label = replayable ? replayLabel : unavailableReplayLabel;

  return (
    // 押せないボタンはポインターを受けないので、押せない理由の title は包む要素に付ける。
    <span title={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        disabled={!replayable}
        onClick={onReplay}
      >
        <PlayIcon />
      </Button>
    </span>
  );
}

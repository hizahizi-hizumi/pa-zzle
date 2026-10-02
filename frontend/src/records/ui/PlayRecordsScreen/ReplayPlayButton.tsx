import { PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReplayPlayButtonProps = {
  onReplay: () => void;
};

/** 履歴の1行のプレイと同じ問題を、最初から遊び直す操作。完了・離脱のどちらの行でも同じに見せる。 */
export function ReplayPlayButton({ onReplay }: ReplayPlayButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="同じ問題をプレイ"
      title="同じ問題をプレイ"
      onClick={onReplay}
    >
      <PlayIcon />
    </Button>
  );
}

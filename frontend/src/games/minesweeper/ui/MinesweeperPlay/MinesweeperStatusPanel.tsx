import { Button } from "@/components/ui/button";
import type { MinesweeperSessionStatus } from "../../session/session";

type MinesweeperStatusPanelProps = {
  status: MinesweeperSessionStatus;
  onReplay: () => void;
};

export function MinesweeperStatusPanel({
  status,
  onReplay,
}: MinesweeperStatusPanelProps) {
  if (status === "playing") {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-3 text-supporting">
      <strong>{status === "cleared" ? "クリア" : "ゲームオーバー"}</strong>
      <Button variant="secondary" size="sm" onClick={onReplay}>
        同じ問題をやり直す
      </Button>
    </div>
  );
}

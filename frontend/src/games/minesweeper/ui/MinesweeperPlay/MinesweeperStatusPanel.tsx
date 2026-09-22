import { Button } from "@/components/ui/button";
import type { MinesweeperSessionStatus } from "../../session/session";

type MinesweeperStatusPanelProps = {
  status: Exclude<MinesweeperSessionStatus, "playing">;
  onReplay: () => void;
};

export function MinesweeperStatusPanel({
  status,
  onReplay,
}: MinesweeperStatusPanelProps) {
  return (
    <div className="grid justify-items-center gap-3">
      <p className="text-heading">
        {status === "cleared" ? "クリア" : "ゲームオーバー"}
      </p>
      <Button variant="secondary" onClick={onReplay}>
        同じ問題をやり直す
      </Button>
    </div>
  );
}

import type { MinesweeperSessionStatus } from "@/games/minesweeper/session/session";

type MinesweeperPlayStatusProps = {
  status: Exclude<MinesweeperSessionStatus, "playing">;
};

export function MinesweeperPlayStatus({ status }: MinesweeperPlayStatusProps) {
  return (
    <p className="flex h-10 items-center justify-center text-play-context">
      {status === "cleared" ? "クリア" : "ゲームオーバー"}
    </p>
  );
}

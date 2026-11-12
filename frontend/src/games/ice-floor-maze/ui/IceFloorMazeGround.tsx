import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/**
 * アイスフロア迷路の地。プレイ画面とゲームのホームの背景に敷く。
 * 盤の周囲は湖を囲む雪原。模様は置かず、盤面を背景から浮いた板に見せない。
 */
export function IceFloorMazeGround() {
  return (
    <div
      className="size-full"
      style={{ backgroundColor: iceFloorMazeTone.snowfield }}
    />
  );
}

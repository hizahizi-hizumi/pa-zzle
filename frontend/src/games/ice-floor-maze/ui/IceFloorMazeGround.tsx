import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

export function IceFloorMazeGround() {
  return (
    <div
      className="size-full"
      // 盤の周囲は湖を囲む雪原。模様は置かず、盤面を背景から浮いた板に見せない。
      style={{ backgroundColor: iceFloorMazeTone.snowfield }}
    />
  );
}

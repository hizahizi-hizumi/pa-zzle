import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";

/** チュートリアルで、駒を止めるマスに付ける印。 */
export type IceFloorMazeCellCue = {
  cellIndex: number;
  // 印の無い向きへ滑らせようとされるたびに変え、変わると印の線を短く濃くして戻す。
  recallId: number | null;
  // 駒のマスから、この向きへ指が滑るしぐさをする。
  swipe: { cellIndex: number; direction: IceFloorMazeDirection } | null;
};

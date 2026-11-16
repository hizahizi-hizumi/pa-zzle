import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";

const directionByArrowKey: Readonly<Record<string, IceFloorMazeDirection>> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

/** 矢印キーが選ぶ滑りの向き。プレイ画面・チュートリアル・遊び方の例で同じにする。矢印キーでなければ `null`。 */
export function findArrowKeyDirection(
  key: string,
): IceFloorMazeDirection | null {
  return directionByArrowKey[key] ?? null;
}

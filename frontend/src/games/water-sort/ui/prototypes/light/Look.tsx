// 試作 light: 窓辺の透過光。左上の窓から差す光が色水を抜け、棚板に色の影を落とす。
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { LightBackground } from "./LightBackground";
import { LightBoard } from "./LightBoard";

export function Board(props: WaterSortBoardProps) {
  return <LightBoard {...props} />;
}

export function Background() {
  return <LightBackground />;
}

/** 試作は注ぐ動きの間に合わせて自分で音を鳴らす。 */
export const muteDefaultSounds = true;

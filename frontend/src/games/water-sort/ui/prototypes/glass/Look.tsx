// 試作 glass: 理科室の厚手ガラスの試験管に入った、透きとおる色水。
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";

import { GlassBoard } from "./GlassBoard";
import { GlassBackground } from "./GlassBackground";

export function Board(props: WaterSortBoardProps) {
  return <GlassBoard {...props} />;
}

export function Background() {
  return <GlassBackground />;
}

/** true なら今の効果音を鳴らさない。試作が自分の音を鳴らすときに true にする。 */
export const muteDefaultSounds = false;

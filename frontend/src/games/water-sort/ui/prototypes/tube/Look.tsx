// 試作 tube: 木の試験管立てに挿した、色水の入ったガラスの試験管。
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { TubeBackground } from "./TubeBackground";
import { TubeBoard } from "./TubeBoard";

export function Board(props: WaterSortBoardProps) {
  return <TubeBoard {...props} />;
}

export function Background() {
  return <TubeBackground />;
}

/** true なら今の効果音を鳴らさない。試作が自分の音を鳴らすときに true にする。 */
export const muteDefaultSounds = true;

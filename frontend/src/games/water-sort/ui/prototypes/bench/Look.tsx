// 試作 bench: 理科室の実験台に据えた木の試験管立て。
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { BenchBackground } from "@/games/water-sort/ui/prototypes/bench/BenchBackground";
import { BenchBoard } from "@/games/water-sort/ui/prototypes/bench/BenchBoard";

export function Board(props: WaterSortBoardProps) {
  return <BenchBoard {...props} />;
}

export function Background() {
  return <BenchBackground />;
}

/** true なら今の効果音を鳴らさない。注ぐ動きの時刻を今の音に合わせたので、今の音をそのまま使う。 */
export const muteDefaultSounds = false;

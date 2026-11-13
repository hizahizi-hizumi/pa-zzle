// 一時の切り替え口: 見た目の試作を並べて比べるためのもの。収束のときに消す。
import type { ComponentType } from "react";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";

export type WaterSortLookModule = {
  /** 盤面の姿と手応え。今の `WaterSortBoard` と同じ props で描く。 */
  Board: ComponentType<WaterSortBoardProps>;
  /** プレイ画面の地。 */
  Background: ComponentType;
  /** true なら今の効果音を鳴らさない（試作が自分の音を鳴らすとき）。 */
  muteDefaultSounds: boolean;
};

export type WaterSortLookEntry = {
  id: string;
  label: string;
  load: () => Promise<WaterSortLookModule>;
};

// 選ばれた試作だけをそのときに読み込む（動的 import）。
export const waterSortLooks: readonly WaterSortLookEntry[] = [
  { id: "tube", label: "tube", load: () => import("./tube/Look") },
  { id: "glass", label: "glass", load: () => import("./glass/Look") },
  { id: "light", label: "light", load: () => import("./light/Look") },
  { id: "pour", label: "pour", load: () => import("./pour/Look") },
  { id: "label", label: "label", load: () => import("./label/Look") },
  { id: "bench", label: "bench", load: () => import("./bench/Look") },
];

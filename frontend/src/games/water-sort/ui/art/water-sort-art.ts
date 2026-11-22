import type { ComponentType, CSSProperties } from "react";

import type { PourImpactProps } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/PourImpact/LabPourImpact";
import type { TestTubeProps } from "@/games/water-sort/ui/board/test-tube/test-tube-props";
import type { TestTubeRackSceneProps } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/TestTubeRackScene";

/** 絵の方向ごとに差し替える部品と、液の塗り。 */
export type WaterSortArt = {
  /** 盤面・注ぐ演出・遊び方の図の試験管（ガラス・液・栓・試験管ばさみ）。 */
  TestTube: ComponentType<TestTubeProps>;
  /** 試験管立てと実験台・流しの戸棚。 */
  RackScene: ComponentType<TestTubeRackSceneProps>;
  /** プレイ画面・チュートリアル・ゲームのホームの地。一番外の要素に、上端と下端に合う不透明な背景色を付ける。 */
  Ground: ComponentType;
  /** 遊び方の図の試験管の後ろに敷く地。 */
  FigureGround: ComponentType;
  /** 注ぐ流れが液面（空なら底）に当たる所の乱れ。 */
  PourImpact: ComponentType<PourImpactProps>;
  /** 注ぐ演出の中で描く液（傾けた注ぎ元の液・注ぎ先へ入る液・流れ）の塗り。 */
  reagent: {
    fill: (colorIndex: number) => CSSProperties;
    streamFill: (colorIndex: number) => CSSProperties;
    /** 液面の縁に引く暗い線の濃さ（0〜1）。 */
    surfaceShade: (colorIndex: number) => number;
  };
};

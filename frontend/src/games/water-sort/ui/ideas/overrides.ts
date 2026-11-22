import type { ComponentType, ReactNode } from "react";

import type { GameProgress } from "@/games/play";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type {
  WaterSortBottle,
  WaterSortState,
} from "@/games/water-sort/puzzle/state";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";

/**
 * ボトルがどこに描かれているか。
 * - `board`: 盤面に置かれているボトル。
 * - `pour-source`: 注ぐ演出で、持ち上げて傾けている注ぎ元。
 * - `pour-destination`: 注ぐ演出で、注がれている注ぎ先。
 */
export type WaterBottleRole = "board" | "pour-source" | "pour-destination";

export type WaterBottleProps = {
  contents: WaterSortBottle;
  selected?: boolean;
  waterOverlay?: ReactNode;
  /** 省略すると `board`。 */
  role?: WaterBottleRole;
  /** 盤面のボトルが、注ぐ演出に姿を譲って見えなくなっている間 `true`。 */
  concealed?: boolean;
};

export type PourAnimationLayerProps = {
  animations: readonly PourAnimation[];
  onFinish: (animationId: number) => void;
};

export type WaterSortSoundEffectsProps = {
  operation: WaterSortOperation | null;
  progress: GameProgress;
};

export type ClearFinaleProps = {
  /** そろった盤面。 */
  state: WaterSortState;
  /** 盤面のボトルの要素（並び順はボトルの番号順）。 */
  getBottleElements: () => readonly HTMLElement[];
  /** 演出が終わったら呼ぶ。呼ぶと結果画面へ移る。 */
  onDone: () => void;
};

export type BoardBackdropProps = {
  /** 今の盤面。 */
  state: WaterSortState;
  /** 盤面のボトルの要素（並び順はボトルの番号順）。位置は描くたびに測る。 */
  getBottleElements: () => readonly HTMLElement[];
};

/** 案ごとに差し替える部品。省略した部品は今の画面のものを使う。 */
export type WaterSortIdeaOverrides = {
  /**
   * プレイ画面の明暗。`dark` にすると、OS の設定にかかわらず、プレイ画面の中（見出し・待った・知らせも）をダークの色で描く。
   * 省略すると OS の設定に従うので、地はライトとダークの両方を描く。結果画面には効かない。
   */
  colorScheme?: "dark";
  /** プレイ画面全体の地。見出しとブランドの帯の後ろまで描かれる。 */
  Ground?: ComponentType;
  /** 盤面の後ろ、地の上に描く層（台・棚・カウンターなど）。盤面と同じ `main` の中に、全面に重なって置かれ、操作を受けない。 */
  BoardBackdrop?: ComponentType<BoardBackdropProps>;
  WaterBottle?: ComponentType<WaterBottleProps>;
  PourAnimationLayer?: ComponentType<PourAnimationLayerProps>;
  /** 効果音。差し替えると今の効果音は鳴らない。今の効果音に足すときは `useWaterSortSoundEffects` を中で呼ぶ。 */
  SoundEffects?: ComponentType<WaterSortSoundEffectsProps>;
  /** クリアの注ぎが終わってから結果画面へ移るまでの演出。 */
  ClearFinale?: ComponentType<ClearFinaleProps>;
};

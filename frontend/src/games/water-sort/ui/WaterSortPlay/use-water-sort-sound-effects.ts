import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/water-sort/assets/sounds/cleared.flac";
import invalidSoundUrl from "@/games/water-sort/assets/sounds/invalid.flac";
import pouredSoundUrl from "@/games/water-sort/assets/sounds/poured.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** 通らない操作の、低く短い音。 */
const invalidSound = defineSoundEffect(invalidSoundUrl);

/** 注ぐ水の、泡が弾けるような音の連なり。水が流れている間を、注ぎ先が満ちていくように少しずつ高くなる泡で埋める。 */
const pouredSound = defineSoundEffect(pouredSoundUrl);

/**
 * クリアの、最後のボトルが満ちる音。泡が駆け上がり、満ちたグラスのように澄んで鳴って終わる。
 * 続けて鳴る結果の報酬の音と濁らないよう、短く、同じ調の音で鳴る。
 */
const clearedSound = defineSoundEffect(clearedSoundUrl);

const waterSortSounds: readonly SoundEffect[] = [
  invalidSound,
  pouredSound,
  clearedSound,
];

/** 注いだ水が注ぎ先へ流れ込み終わるまでの時間。動きを減らす設定では注ぐ動きが無いので待たない。 */
function getPourTransferDelayMs(transferOffset: number): number {
  return prefersReducedMotion()
    ? 0
    : POUR_ANIMATION_DURATION_MS * transferOffset;
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "invalid":
      // 動きを減らす設定ではボトルを揺らさず、画面が何も変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
    case "poured":
      playSound(pouredSound, {
        delayMs: getPourTransferDelayMs(POUR_TRANSFER_START_OFFSET),
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
  }
}

/** 最後の注水で水が流れ込み終わるのに合わせて、クリア音を鳴らす。 */
function playClearSound() {
  playSound(clearedSound, {
    delayMs: getPourTransferDelayMs(POUR_TRANSFER_END_OFFSET),
  });
}

/**
 * 注ぐ操作と通らない操作、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * ボトルの選択とその解除では鳴らさない。
 */
export function useWaterSortSoundEffects(
  operation: WaterSortOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(waterSortSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}

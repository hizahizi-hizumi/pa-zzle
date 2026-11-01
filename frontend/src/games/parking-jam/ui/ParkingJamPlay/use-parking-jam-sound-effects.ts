import blockedSoundUrl from "@/games/parking-jam/assets/sounds/blocked.flac";
import clearedSoundUrl from "@/games/parking-jam/assets/sounds/cleared.flac";
import exitedSoundUrl from "@/games/parking-jam/assets/sounds/exited.flac";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** `parking-jam-board.css` のこつんと当たる動き（`pj-block-*`）で、車が前へ出きって止まるまでの時間。 */
const BLOCKED_IMPACT_MS = 80;
/** `parking-jam-board.css` の出ていく動き（`pj-exit`）の長さ。 */
const EXIT_DURATION_MS = 520;

const blockedSound = defineSoundEffect(blockedSoundUrl);

const exitedSound = defineSoundEffect(exitedSoundUrl);

const clearedSound = defineSoundEffect(clearedSoundUrl);

/** 最後の車が駐車場を半分ほど走り抜けたところでクラクションを鳴らし、出ていき終える前に鳴り終える。 */
const CLEAR_SOUND_DELAY_MS = EXIT_DURATION_MS * 0.4;

const parkingJamSounds: readonly SoundEffect[] = [
  blockedSound,
  exitedSound,
  clearedSound,
];

/** 演出に合わせて遅らせる時間。動きを減らす設定では車がすぐ止まり・すぐ出ていくので待たない。 */
function getMotionDelayMs(delayMs: number): number {
  return prefersReducedMotion() ? 0 : delayMs;
}

function playOperationSound(operation: ParkingJamOperation) {
  switch (operation.type) {
    case "blocked":
      playSound(blockedSound, {
        delayMs: getMotionDelayMs(BLOCKED_IMPACT_MS),
      });
      return;
    case "exited":
      playSound(exitedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

function playClearSound() {
  playSound(clearedSound, {
    delayMs: getMotionDelayMs(CLEAR_SOUND_DELAY_MS),
  });
}

/**
 * 車を動かす操作と、最後の車が出ていく瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 車の選択とその解除では鳴らさない。
 */
export function useParkingJamSoundEffects(
  operation: ParkingJamOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(parkingJamSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}

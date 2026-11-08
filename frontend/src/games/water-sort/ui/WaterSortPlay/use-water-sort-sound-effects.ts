import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/water-sort/assets/sounds/cleared.flac";
import invalidSoundUrl from "@/games/water-sort/assets/sounds/invalid.flac";
import pouredBubble1SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import pouredBubble2SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import pouredBubble3SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import pouredBubble4SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import pouredBubble5SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import pouredBubble6SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  pourDuration,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

const invalidSound = defineSoundEffect(invalidSoundUrl);

/** 注いだ水が流れている間を、均等でない間隔で埋めて鳴らす泡の音。`transferProgress` は流れている時間の中での鳴り始め。 */
const pouredBubbleSounds = [
  { url: pouredBubble1SoundUrl, transferProgress: 0 },
  { url: pouredBubble2SoundUrl, transferProgress: 0.16 },
  { url: pouredBubble3SoundUrl, transferProgress: 0.3 },
  { url: pouredBubble4SoundUrl, transferProgress: 0.48 },
  { url: pouredBubble5SoundUrl, transferProgress: 0.64 },
  { url: pouredBubble6SoundUrl, transferProgress: 0.82 },
].map(function createBubbleSound({ url, transferProgress }) {
  return { sound: defineSoundEffect(url), transferProgress };
});

function getPouredSoundLayers(appearance: WaterSortAppearance): SoundLayer[] {
  const duration =
    pourDuration(appearance) *
    (POUR_TRANSFER_END_OFFSET - POUR_TRANSFER_START_OFFSET);
  return pouredBubbleSounds.map(({ sound, transferProgress }) => ({
    sound,
    offsetMs: duration * transferProgress,
  }));
}

const clearedSound = defineSoundEffect(clearedSoundUrl);

const waterSortSounds: readonly SoundEffect[] = [
  invalidSound,
  ...pouredBubbleSounds.map(({ sound }) => sound),
  clearedSound,
];

/** 注いだ水が注ぎ先へ流れ込み終わるまでの時間。動きを減らす設定では注ぐ動きが無いので待たない。 */
function getPourTransferDelayMs(
  appearance: WaterSortAppearance,
  transferOffset: number,
): number {
  return prefersReducedMotion() ? 0 : pourDuration(appearance) * transferOffset;
}

function playOperationSound(
  operation: WaterSortOperation,
  appearance: WaterSortAppearance,
) {
  switch (operation.type) {
    case "invalid":
      // 動きを減らす設定ではボトルを揺らさず、画面が何も変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
    case "poured":
      playLayeredSound(getPouredSoundLayers(appearance), {
        delayMs: getPourTransferDelayMs(appearance, POUR_TRANSFER_START_OFFSET),
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
  }
}

/** 最後の注水で水が流れ込み終わるのに合わせて、クリア音を鳴らす。 */
function playClearSound(appearance: WaterSortAppearance) {
  playSound(clearedSound, {
    delayMs: getPourTransferDelayMs(appearance, POUR_TRANSFER_END_OFFSET),
  });
}

/**
 * 注ぐ操作と通らない操作、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * ボトルの選択とその解除では鳴らさない。
 */
export function useWaterSortSoundEffects(
  operation: WaterSortOperation | null,
  progress: GameProgress,
  appearance: WaterSortAppearance,
) {
  usePrepareSoundEffects(waterSortSounds);
  useOperationSound(operation, (current) =>
    playOperationSound(current, appearance),
  );
  useClearSound(progress, () => playClearSound(appearance));
}

import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import bottleCompletedSoundUrl from "@/games/water-sort/assets/sounds/bottle-completed.flac";
import clearedSoundUrl from "@/games/water-sort/assets/sounds/cleared.flac";
import invalidSoundUrl from "@/games/water-sort/assets/sounds/invalid.flac";
import pouredBubble1SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import pouredBubble2SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import pouredBubble3SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import pouredBubble4SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import pouredBubble5SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import pouredBubble6SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { isCompletedByPour } from "@/games/water-sort/ui/board/bottle-completion";
import {
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import {
  getPourAnimationDurationMs,
  getPouredUnitCount,
} from "@/games/water-sort/ui/board/pour/pour-animation";
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
const pouredBubbles = [
  { url: pouredBubble1SoundUrl, transferProgress: 0 },
  { url: pouredBubble2SoundUrl, transferProgress: 0.16 },
  { url: pouredBubble3SoundUrl, transferProgress: 0.3 },
  { url: pouredBubble4SoundUrl, transferProgress: 0.48 },
  { url: pouredBubble5SoundUrl, transferProgress: 0.64 },
  { url: pouredBubble6SoundUrl, transferProgress: 0.82 },
].map(function definePouredBubble({ url, transferProgress }) {
  return { sound: defineSoundEffect(url), transferProgress };
});

function getPouredSoundLayers(pourDurationMs: number): SoundLayer[] {
  const transferDurationMs =
    pourDurationMs * (POUR_TRANSFER_END_OFFSET - POUR_TRANSFER_START_OFFSET);
  return pouredBubbles.map(function createPouredLayer({
    sound,
    transferProgress,
  }): SoundLayer {
    return { sound, offsetMs: transferDurationMs * transferProgress };
  });
}

const bottleCompletedSound = defineSoundEffect(bottleCompletedSoundUrl);

const clearedSound = defineSoundEffect(clearedSoundUrl);

const waterSortSounds: readonly SoundEffect[] = [
  invalidSound,
  ...pouredBubbles.map(function getPouredSound({ sound }) {
    return sound;
  }),
  bottleCompletedSound,
  clearedSound,
];

/** 動きを減らす設定では注ぐ動きが無いので待たない。 */
function getPourTransferDelayMs(
  pourDurationMs: number,
  transferOffset: number,
): number {
  return prefersReducedMotion() ? 0 : pourDurationMs * transferOffset;
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
    case "poured": {
      const pourDurationMs = getPourAnimationDurationMs(
        getPouredUnitCount(operation),
      );
      playLayeredSound(getPouredSoundLayers(pourDurationMs), {
        delayMs: getPourTransferDelayMs(
          pourDurationMs,
          POUR_TRANSFER_START_OFFSET,
        ),
        variation: REPEATED_SOUND_VARIATION,
      });
      // 注ぎ先に蓋がはまる、水が流れ込み終わる瞬間に鳴らす。
      if (isCompletedByPour(operation)) {
        playSound(bottleCompletedSound, {
          delayMs: getPourTransferDelayMs(
            pourDurationMs,
            POUR_TRANSFER_END_OFFSET,
          ),
        });
      }
      return;
    }
  }
}

/** 最後の注ぎを終えて、全ボトルが弾み始めるのに合わせて、クリア音を鳴らす。 */
function playClearSound(operation: WaterSortOperation | null) {
  const pourDurationMs =
    operation?.type === "poured"
      ? getPourAnimationDurationMs(getPouredUnitCount(operation))
      : 0;
  playSound(clearedSound, {
    delayMs: getPourTransferDelayMs(pourDurationMs, 1),
  });
}

export function useWaterSortSoundEffects(
  operation: WaterSortOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(waterSortSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, () => playClearSound(operation));
}

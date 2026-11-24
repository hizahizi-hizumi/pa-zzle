import clearedChordSoundUrl from "@/games/fukumenzan/assets/sounds/cleared-chord.flac";
import clearedStep1SoundUrl from "@/games/fukumenzan/assets/sounds/cleared-step-1.flac";
import clearedStep2SoundUrl from "@/games/fukumenzan/assets/sounds/cleared-step-2.flac";
import clearedStep3SoundUrl from "@/games/fukumenzan/assets/sounds/cleared-step-3.flac";
import crossedSoundUrl from "@/games/fukumenzan/assets/sounds/crossed.flac";
import placedSoundUrl from "@/games/fukumenzan/assets/sounds/placed.flac";
import returnedSoundUrl from "@/games/fukumenzan/assets/sounds/returned.flac";
import uncrossedSoundUrl from "@/games/fukumenzan/assets/sounds/uncrossed.flac";
import type { FukumenzanOperation } from "@/games/fukumenzan/play/use-fukumenzan-play";
import {
  CLEAR_HOP_MS,
  CLEAR_STEP_MS,
} from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/audio/sound-effects";

const operationSounds = {
  placed: defineSoundEffect(placedSoundUrl),
  crossed: defineSoundEffect(crossedSoundUrl),
  uncrossed: defineSoundEffect(uncrossedSoundUrl),
  returned: defineSoundEffect(returnedSoundUrl),
} as const satisfies Record<FukumenzanOperation["type"], SoundEffect>;

const clearedStepSounds = [
  clearedStep1SoundUrl,
  clearedStep2SoundUrl,
  clearedStep3SoundUrl,
].map(defineSoundEffect);

const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const fukumenzanSounds: readonly SoundEffect[] = [
  ...Object.values(operationSounds),
  ...clearedStepSounds,
  clearedChordSound,
];

/** 答えの桁が跳ねていちばん高く上がるまでの時間。跳ねる動きの真ん中。 */
const CLEAR_HOP_PEAK_MS = CLEAR_HOP_MS / 2;

/**
 * クリアの音の重なり。段の音は桁の数によらず3本を、一の位から最後の桁までの跳ね始めの間へ等しく割り付け、
 * 和音は最後の桁が跳ねるのに合わせる。
 */
export function getFukumenzanClearedSoundLayers(
  resultLength: number,
): readonly SoundLayer[] {
  const lastStepMs = (resultLength - 1) * CLEAR_STEP_MS;
  return [
    ...clearedStepSounds.map(
      (sound, index): SoundLayer => ({
        sound,
        offsetMs: (lastStepMs * index) / clearedStepSounds.length,
      }),
    ),
    { sound: clearedChordSound, offsetMs: lastStepMs },
  ];
}

function playOperationSound(operation: FukumenzanOperation): void {
  playSound(operationSounds[operation.type], {
    variation: REPEATED_SOUND_VARIATION,
  });
}

/**
 * プレイ画面と遊び方の例で、札を入れる・× を付け外す・札を元の所へ戻す音と、クリアの音を鳴らす。
 * 動きを減らす設定では、完成した式をそのまま見せる間に和音だけを鳴らす。
 * 音は `scripts/assets/fukumenzan_sounds.ts` で合成する。
 */
export function useFukumenzanSoundEffects(
  operation: FukumenzanOperation | null,
  progress: GameProgress,
  resultLength: number,
): void {
  usePrepareSoundEffects(fukumenzanSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(
    progress,
    function playClearSound() {
      playLayeredSound(getFukumenzanClearedSoundLayers(resultLength), {
        delayMs: CLEAR_HOP_PEAK_MS,
      });
    },
    {
      playReducedMotionClearSound() {
        playSound(clearedChordSound);
      },
    },
  );
}

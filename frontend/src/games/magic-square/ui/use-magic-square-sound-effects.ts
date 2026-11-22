import clearedColumnSoundUrl from "@/games/magic-square/assets/sounds/cleared-column.flac";
import clearedDiagonalSoundUrl from "@/games/magic-square/assets/sounds/cleared-diagonal.flac";
import clearedFinishSoundUrl from "@/games/magic-square/assets/sounds/cleared-finish.flac";
import clearedRowSoundUrl from "@/games/magic-square/assets/sounds/cleared-row.flac";
import memoErasedSoundUrl from "@/games/magic-square/assets/sounds/memo-erased.flac";
import memoWrittenSoundUrl from "@/games/magic-square/assets/sounds/memo-written.flac";
import placedSoundUrl from "@/games/magic-square/assets/sounds/placed.flac";
import rejectedSoundUrl from "@/games/magic-square/assets/sounds/rejected.flac";
import type { MagicSquareOperation } from "@/games/magic-square/play/use-magic-square-play";
import {
  MAGIC_SQUARE_CLEAR_FINISH_DELAY_MS,
  MAGIC_SQUARE_CLEAR_STAGE_INTERVAL_MS,
} from "@/games/magic-square/ui/board/clear-animation";
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
import { prefersReducedMotion } from "@/lib/motion";

const placedSound = defineSoundEffect(placedSoundUrl);

const rejectedSound = defineSoundEffect(rejectedSoundUrl);

const memoWrittenSound = defineSoundEffect(memoWrittenSoundUrl);

const memoErasedSound = defineSoundEffect(memoErasedSoundUrl);

/** クリアの演出の行・縦の列・斜めの3段の順。 */
const clearedStageSounds = [
  clearedRowSoundUrl,
  clearedColumnSoundUrl,
  clearedDiagonalSoundUrl,
].map(defineSoundEffect);

const clearedFinishSound = defineSoundEffect(clearedFinishSoundUrl);

const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedStageSounds.map(
    function createStageLayer(sound, stage): SoundLayer {
      return {
        sound,
        offsetMs: stage * MAGIC_SQUARE_CLEAR_STAGE_INTERVAL_MS,
      };
    },
  ),
  { sound: clearedFinishSound, offsetMs: MAGIC_SQUARE_CLEAR_FINISH_DELAY_MS },
];

const magicSquareSounds: readonly SoundEffect[] = [
  placedSound,
  rejectedSound,
  memoWrittenSound,
  memoErasedSound,
  ...clearedStageSounds,
  clearedFinishSound,
];

/** 数を外す操作は、数の欄（手持ち）へ戻す操作なので鳴らさない。 */
function playOperationSound(operation: MagicSquareOperation) {
  switch (operation.type) {
    case "placed":
      playSound(placedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "memo-written":
      playSound(memoWrittenSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "memo-erased":
      playSound(memoErasedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "rejected":
      // 動きを減らす設定では揺れが出ず画面が変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(rejectedSound);
      }
      return;
    case "removed":
      return;
  }
}

function playClearSound() {
  playLayeredSound(clearedSoundLayers);
}

/** 動きを減らす設定では、そろった盤面を少し見せてから結果へ進むので、その姿に合わせて仕上げだけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedFinishSound);
}

export function useMagicSquareSoundEffects(
  operation: MagicSquareOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(magicSquareSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
}

export const _private = {
  clearedSoundLayers,
};

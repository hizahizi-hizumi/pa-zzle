import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearNoteA5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-a5.flac";
import clearNoteB5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-b5.flac";
import clearNoteC5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-c5.flac";
import clearNoteC6SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-c6.flac";
import clearNoteD5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-d5.flac";
import clearNoteE5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-e5.flac";
import clearNoteF5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-f5.flac";
import clearNoteG5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-g5.flac";
import invalidSoundUrl from "@/games/slide-puzzle/assets/sounds/invalid.flac";
import slidSoundUrl from "@/games/slide-puzzle/assets/sounds/slid.flac";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getClearWaveTileDelayMs } from "@/games/slide-puzzle/ui/board/clear-wave";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** タイルが滑る音。何枚まとめて滑っても同じ音で鳴らす。 */
const slidSound = defineSoundEffect(slidSoundUrl);

const invalidSound = defineSoundEffect(invalidSoundUrl);

/** 完成演出の波でタイルが持ち上がるたびに鳴らす1音。低い順に並べ、盤面の大きさによらず最初から最後まで駆け上がる。 */
const clearScaleSounds = [
  clearNoteC5SoundUrl,
  clearNoteD5SoundUrl,
  clearNoteE5SoundUrl,
  clearNoteF5SoundUrl,
  clearNoteG5SoundUrl,
  clearNoteA5SoundUrl,
  clearNoteB5SoundUrl,
  clearNoteC6SoundUrl,
].map(defineSoundEffect);

const slidePuzzleSounds: readonly SoundEffect[] = [
  slidSound,
  invalidSound,
  ...clearScaleSounds,
];

/** 1番から順にタイルが持ち上がるのに合わせて、音を1枚ずつ上げていくクリア音。 */
function createClearedSoundLayers(tileCount: number): SoundLayer[] {
  const lastScaleIndex = clearScaleSounds.length - 1;
  const firstTileDelayMs = getClearWaveTileDelayMs(0);
  return Array.from(
    { length: tileCount },
    function createTileNote(_, order): SoundLayer[] {
      const scaleIndex = Math.round(
        (order * lastScaleIndex) / Math.max(tileCount - 1, 1),
      );
      const sound = clearScaleSounds[scaleIndex];
      return sound
        ? [
            {
              sound,
              offsetMs: getClearWaveTileDelayMs(order) - firstTileDelayMs,
            },
          ]
        : [];
    },
  ).flat();
}

function playOperationSound(operation: SlidePuzzleOperation) {
  switch (operation.type) {
    case "slid":
      playSound(slidSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      // 動きを減らす設定ではタイルを揺らさず、画面が何も変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
  }
}

/** プレイ中の操作と、完成演出の波に合わせて効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useSlidePuzzleSoundEffects(
  operation: SlidePuzzleOperation | null,
  progress: GameProgress,
  tileCount: number,
) {
  usePrepareSoundEffects(slidePuzzleSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, function playClearSound() {
    // 波は最後のタイルが滑り終えてから始まる。
    playLayeredSound(createClearedSoundLayers(tileCount), {
      delayMs: getClearWaveTileDelayMs(0),
    });
  });
}

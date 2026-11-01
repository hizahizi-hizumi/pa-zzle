import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedChordSoundUrl from "@/games/takuzu/assets/sounds/cleared-chord.flac";
import clearedWave1SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-1.flac";
import clearedWave2SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-2.flac";
import clearedWave3SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-3.flac";
import clearedWave4SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-4.flac";
import clearedWave5SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-5.flac";
import emptiedSoundUrl from "@/games/takuzu/assets/sounds/emptied.flac";
import invalidSoundUrl from "@/games/takuzu/assets/sounds/invalid.flac";
import tileAPlacedSoundUrl from "@/games/takuzu/assets/sounds/tile-a-placed.flac";
import tileBPlacedSoundUrl from "@/games/takuzu/assets/sounds/tile-b-placed.flac";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import { TAKUZU_BOARD_SIZE } from "@/games/takuzu/problem/problem";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import {
  CLEAR_WAVE_PEAK_MS,
  CLEAR_WAVE_STAGGER_MS,
} from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** タイルを置く音。A と B で見た目が違うので音も分ける。 */
const tilePlacedSounds: Record<TakuzuTile, SoundEffect> = {
  a: defineSoundEffect(tileAPlacedSoundUrl),
  b: defineSoundEffect(tileBPlacedSoundUrl),
};

const emptiedSound = defineSoundEffect(emptiedSoundUrl);

const invalidSound = defineSoundEffect(invalidSoundUrl);

/** 完成の波が左上から右下へ渡るまでの順番の数。波の順番はマスの「行 + 列」。 */
const CLEAR_WAVE_LAST_STEP = (TAKUZU_BOARD_SIZE - 1) * 2;

function getWaveStepOffsetMs(step: number): number {
  return step * CLEAR_WAVE_STAGGER_MS;
}

/** 膨らむタイルの波に乗せて、順に鳴らす音。 */
const clearedWaveSounds = [
  clearedWave1SoundUrl,
  clearedWave2SoundUrl,
  clearedWave3SoundUrl,
  clearedWave4SoundUrl,
  clearedWave5SoundUrl,
].map(defineSoundEffect);

/** 波が右下の角に届いたところで鳴らす音。 */
const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedWaveSounds.map(function createWaveLayer(sound, index): SoundLayer {
    const step = (CLEAR_WAVE_LAST_STEP * index) / clearedWaveSounds.length;
    return { sound, offsetMs: getWaveStepOffsetMs(step) };
  }),
  {
    sound: clearedChordSound,
    offsetMs: getWaveStepOffsetMs(CLEAR_WAVE_LAST_STEP),
  },
];

const takuzuSounds: readonly SoundEffect[] = [
  ...Object.values(tilePlacedSounds),
  emptiedSound,
  invalidSound,
  ...clearedWaveSounds,
  clearedChordSound,
];

function playOperationSound(operation: TakuzuOperation) {
  switch (operation.type) {
    case "placed":
      playSound(tilePlacedSounds[operation.tile], {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "emptied":
      playSound(emptiedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      // 動きを減らす設定では固定マスを揺らさず、画面が何も変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
  }
}

/** 左上のタイルがいちばん膨らむのに合わせて鳴らし始める。 */
function playClearSound() {
  playLayeredSound(clearedSoundLayers, { delayMs: CLEAR_WAVE_PEAK_MS });
}

/** マスへの操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useTakuzuSoundEffects(
  operation: TakuzuOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(takuzuSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}

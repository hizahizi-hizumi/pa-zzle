import clearedChordSoundUrl from "@/games/nonogram/assets/sounds/cleared-chord.flac";
import clearedWave1SoundUrl from "@/games/nonogram/assets/sounds/cleared-wave-1.flac";
import clearedWave2SoundUrl from "@/games/nonogram/assets/sounds/cleared-wave-2.flac";
import clearedWave3SoundUrl from "@/games/nonogram/assets/sounds/cleared-wave-3.flac";
import clearedWave4SoundUrl from "@/games/nonogram/assets/sounds/cleared-wave-4.flac";
import clearedWave5SoundUrl from "@/games/nonogram/assets/sounds/cleared-wave-5.flac";
import crossedSoundUrl from "@/games/nonogram/assets/sounds/crossed.flac";
import erasedSoundUrl from "@/games/nonogram/assets/sounds/erased.flac";
import filledSoundUrl from "@/games/nonogram/assets/sounds/filled.flac";
import type { NonogramOperation } from "@/games/nonogram/play/use-nonogram-play";
import type { NonogramMark } from "@/games/nonogram/session/session";
import {
  CLEAR_SWELL_DELAY_MS,
  CLEAR_SWELL_PEAK_MS,
} from "@/games/nonogram/ui/board/clear/NonogramClearAnimation";
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
} from "@/lib/sound-effects";

/** 印を入れる音。塗りと × は見た目が違うので音も分ける。 */
const markedSounds: Record<NonogramMark, SoundEffect> = {
  filled: defineSoundEffect(filledSoundUrl),
  crossed: defineSoundEffect(crossedSoundUrl),
};

const erasedSound = defineSoundEffect(erasedSoundUrl);

/** 図柄が膨らみ始めてからいちばん膨らむまでに、順に重ねていく音。 */
const clearedWaveSounds = [
  clearedWave1SoundUrl,
  clearedWave2SoundUrl,
  clearedWave3SoundUrl,
  clearedWave4SoundUrl,
  clearedWave5SoundUrl,
].map(defineSoundEffect);

/** 図柄がいちばん膨らんだところで鳴らす音。動きを減らす設定では、完成した図柄を見せるときにこれだけを鳴らす。 */
const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const nonogramSounds: readonly SoundEffect[] = [
  ...Object.values(markedSounds),
  erasedSound,
  ...clearedWaveSounds,
  clearedChordSound,
];

/** 膨らみ始めから頂点までを音の数で等分して駆け上がり、頂点で和音を鳴らす。 */
const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedWaveSounds.map(
    function createRisingLayer(sound, index): SoundLayer {
      return {
        sound,
        offsetMs: (CLEAR_SWELL_PEAK_MS * index) / clearedWaveSounds.length,
      };
    },
  ),
  { sound: clearedChordSound, offsetMs: CLEAR_SWELL_PEAK_MS },
];

/** 図柄が膨らみ始めるのに合わせて鳴らし始める。 */
function playClearSound() {
  playLayeredSound(clearedSoundLayers, { delayMs: CLEAR_SWELL_DELAY_MS });
}

function playReducedMotionClearSound() {
  playSound(clearedChordSound);
}

function playOperationSound(operation: NonogramOperation) {
  switch (operation.type) {
    case "marked":
      playSound(markedSounds[operation.mark], {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "erased":
      playSound(erasedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

/**
 * マスに印を入れる・消す入力と、図柄を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 動きを減らす設定でも完成した図柄を見せたまま止めるので、そのときは和音だけを鳴らす。
 */
export function useNonogramSoundEffects(
  operation: NonogramOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(nonogramSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
}

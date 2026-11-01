import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedChordSoundUrl from "@/games/reflection/assets/sounds/cleared-chord.flac";
import clearedSpread1SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-1.flac";
import clearedSpread2SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-2.flac";
import clearedSpread3SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-3.flac";
import clearedSpread4SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-4.flac";
import clearedSpread5SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-5.flac";
import piecePlacedSoundUrl from "@/games/reflection/assets/sounds/piece-placed.flac";
import type { ReflectionOperation } from "@/games/reflection/play/use-reflection-play";
import {
  CLEAR_LIGHT_DRAW_MS,
  CLEAR_LIGHT_SPREAD_MS,
} from "@/games/reflection/ui/board/clear/ReflectionClearLight";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** ピースを盤面に置く音。移す・入れ替える・置き換えるときも、ピースが現れるので同じ音で鳴らす。 */
const piecePlacedSound = defineSoundEffect(piecePlacedSoundUrl);

/** 光路が入口から順に伸びていくのに合わせて、順に鳴らす音。 */
const clearedSpreadSounds = [
  clearedSpread1SoundUrl,
  clearedSpread2SoundUrl,
  clearedSpread3SoundUrl,
  clearedSpread4SoundUrl,
  clearedSpread5SoundUrl,
].map(defineSoundEffect);
const CLEAR_SPREAD_STEP_MS =
  CLEAR_LIGHT_SPREAD_MS / (clearedSpreadSounds.length - 1);

/** 全光路が点ききったときの音。 */
const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedSpreadSounds.map(
    function createSpreadLayer(sound, index): SoundLayer {
      return { sound, offsetMs: index * CLEAR_SPREAD_STEP_MS };
    },
  ),
  {
    sound: clearedChordSound,
    offsetMs: CLEAR_LIGHT_SPREAD_MS + CLEAR_LIGHT_DRAW_MS,
  },
];

const reflectionSounds: readonly SoundEffect[] = [
  piecePlacedSound,
  ...clearedSpreadSounds,
  clearedChordSound,
];

function playPiecePlacedSound() {
  playSound(piecePlacedSound, { variation: REPEATED_SOUND_VARIATION });
}

function playClearSound() {
  playLayeredSound(clearedSoundLayers);
}

/** 動きを減らす設定では、光路を伸ばさず全光路を一度に出して見せておくので、点ききったときの音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedChordSound);
}

/**
 * ピースを盤面に置いた操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 選択とその解除、手持ちへ戻す操作、光路の表示では鳴らさない。
 */
export function useReflectionSoundEffects(
  operation: ReflectionOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(reflectionSounds);
  useOperationSound(operation, playPiecePlacedSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
}

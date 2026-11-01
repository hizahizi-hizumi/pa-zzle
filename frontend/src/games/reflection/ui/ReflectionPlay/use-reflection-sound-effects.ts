import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/reflection/assets/sounds/cleared.flac";
import clearedChordSoundUrl from "@/games/reflection/assets/sounds/cleared-chord.flac";
import piecePlacedSoundUrl from "@/games/reflection/assets/sounds/piece-placed.flac";
import type { ReflectionOperation } from "@/games/reflection/play/use-reflection-play";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** ピースを盤面に置く音。移す・入れ替える・置き換えるときも、ピースが現れるので同じ音で鳴らす。 */
const piecePlacedSound = defineSoundEffect(piecePlacedSoundUrl);

const clearedSound = defineSoundEffect(clearedSoundUrl);

/** 動きを減らす設定では、光路を伸ばさず全光路を一度に出して見せておくので、点ききった和音だけを鳴らす。 */
const reducedMotionClearedSound = defineSoundEffect(clearedChordSoundUrl);

const reflectionSounds: readonly SoundEffect[] = [
  piecePlacedSound,
  clearedSound,
  reducedMotionClearedSound,
];

function playPiecePlacedSound() {
  playSound(piecePlacedSound, { variation: REPEATED_SOUND_VARIATION });
}

function playClearSound() {
  playSound(clearedSound);
}

function playReducedMotionClearSound() {
  playSound(reducedMotionClearedSound);
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

import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/reflection/assets/sounds/cleared.wav";
import clearedChordSoundUrl from "@/games/reflection/assets/sounds/cleared-chord.wav";
import piecePlacedSoundUrl from "@/games/reflection/assets/sounds/piece-placed.wav";
import type { ReflectionOperation } from "@/games/reflection/play/use-reflection-play";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/**
 * ピースを盤面に置く、ガラスの鏡を置いたような澄んだ音。移す・入れ替える・置き換えるときも、ピースが現れるので同じ音で鳴らす。
 * 整数倍から外した高い音が重なり、鐘ではなくガラスの響きになっている。
 */
const piecePlacedSound = defineSoundEffect(piecePlacedSoundUrl);

/**
 * クリアの、光路が入口から順に伸びていくのに合わせて上がっていく音と、全光路が点ききったところでガラスが澄んで鳴る和音。
 * 和音は全光路が点いた盤面を見せている間に鳴り終わり、続く結果の報酬の音と重ならず、同じ調の音で鳴る。
 */
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

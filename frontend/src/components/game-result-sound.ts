import resultRewardClearSoundUrl from "@/assets/sounds/result-reward-clear.wav";
import resultRewardGoodSoundUrl from "@/assets/sounds/result-reward-good.wav";
import resultRewardGreatSoundUrl from "@/assets/sounds/result-reward-great.wav";
import resultRewardPerfectSoundUrl from "@/assets/sounds/result-reward-perfect.wav";
import type { GameResultLevel } from "@/games/result";
import { defineSoundEffect, type SoundEffect } from "@/lib/sound-effects";

/**
 * 結果の報酬の音。全ゲームで同じ鐘のような音色で、上がる分散和音から和音へ着地する。
 * 評価段階が高いほど音を重ね、長く響かせる。紙吹雪を出す段階（great 以上）では、高い煌めきを足す。
 */
const gameResultSounds: Record<GameResultLevel, SoundEffect> = {
  clear: defineSoundEffect(resultRewardClearSoundUrl),
  good: defineSoundEffect(resultRewardGoodSoundUrl),
  great: defineSoundEffect(resultRewardGreatSoundUrl),
  perfect: defineSoundEffect(resultRewardPerfectSoundUrl),
};

/** 結果の報酬の音すべて。プレイを終える前に読み込んでおくために使う。 */
export const gameResultSoundList: readonly SoundEffect[] =
  Object.values(gameResultSounds);

/** 評価段階に応じた、結果の報酬の音。 */
export function getGameResultSound(level: GameResultLevel): SoundEffect {
  return gameResultSounds[level];
}

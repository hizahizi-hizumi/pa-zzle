import resultRewardClearSoundUrl from "@/assets/sounds/result-reward-clear.flac";
import resultRewardGoodSoundUrl from "@/assets/sounds/result-reward-good.flac";
import resultRewardGreatSoundUrl from "@/assets/sounds/result-reward-great.flac";
import resultRewardPerfectSoundUrl from "@/assets/sounds/result-reward-perfect.flac";
import type { GameResultLevel } from "@/games/result";
import { defineSoundEffect, type SoundEffect } from "@/lib/sound-effects";

const gameResultSounds: Record<GameResultLevel, SoundEffect> = {
  clear: defineSoundEffect(resultRewardClearSoundUrl),
  good: defineSoundEffect(resultRewardGoodSoundUrl),
  great: defineSoundEffect(resultRewardGreatSoundUrl),
  perfect: defineSoundEffect(resultRewardPerfectSoundUrl),
};

/** プレイを終える前に読み込んでおくために使う。 */
export const gameResultSoundList: readonly SoundEffect[] =
  Object.values(gameResultSounds);

export function getGameResultSound(level: GameResultLevel): SoundEffect {
  return gameResultSounds[level];
}

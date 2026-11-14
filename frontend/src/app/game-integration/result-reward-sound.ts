import { useEffect, useRef } from "react";

import {
  gameResultSoundList,
  getGameResultSound,
} from "@/app/game-result-sound";
import type { GameProgress } from "@/games/play";
import { usePrepareSoundEffects } from "@/games/play-sound-effects";
import { getGameResultLevel } from "@/games/result";
import { holdBackgroundMusicStart } from "@/lib/audio/background-music";
import { playSound } from "@/lib/audio/sound-effects";

/** 報酬の音の余韻を BGM で消さない。 */
const MUSIC_REST_AFTER_REWARD_MS = 300;

/** 記録を保存して記録の結果画面へ移るときも、保存に失敗してその場で結果画面を出すときも、報酬の音を鳴らす。 */
export function useResultRewardSound(
  progress: GameProgress,
  score: number | null,
): void {
  const previousProgressRef = useRef(progress);

  usePrepareSoundEffects(gameResultSoundList);

  // 完成演出の完了は盤面の演出から届き、重ねて届くこともあるので、進行が結果へ移ったことを見て一度だけ鳴らす。
  useEffect(() => {
    const previousProgress = previousProgressRef.current;
    previousProgressRef.current = progress;
    if (
      previousProgress === "clearing" &&
      progress === "result" &&
      score !== null
    ) {
      const rewardSoundMs = playSound(
        getGameResultSound(getGameResultLevel(score)),
      );
      if (rewardSoundMs !== null) {
        holdBackgroundMusicStart(rewardSoundMs + MUSIC_REST_AFTER_REWARD_MS);
      }
    }
  }, [progress, score]);
}

import { useEffect, useRef } from "react";

import {
  gameResultSoundList,
  getGameResultSound,
} from "@/components/game-result-sound";
import type { GameProgress } from "@/games/play";
import { usePrepareSoundEffects } from "@/games/play-sound-effects";
import { getGameResultLevel } from "@/games/result";
import { holdBackgroundMusicStart } from "@/lib/background-music";
import { playSound } from "@/lib/sound-effects";

/** 報酬の音が鳴り終わってから、結果画面の BGM を流し始めるまでの間。報酬の音の余韻を BGM で消さない。 */
const MUSIC_REST_AFTER_REWARD_MS = 300;

/**
 * プレイを終えて結果を受け取る瞬間（完成演出を終えて `progress` が `clearing` から `result` へ移るとき）に、
 * 評価段階に応じた報酬の音を鳴らす。
 * 記録を保存して記録の結果画面へ移るときも、保存に失敗してその場で結果画面を出すときも鳴らす。
 * 記録から開いた結果画面と、結果画面の再読み込みはプレイを通らないので鳴らさない。
 * 報酬の音と結果画面の BGM を重ねないよう、報酬の音が鳴り終わるまで BGM を流し始めない。
 */
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

import { useEffect, useRef } from "react";

import {
  gameResultSoundList,
  getGameResultSound,
} from "@/components/game-result-sound";
import type { GameProgress } from "@/games/play";
import { getGameResultLevel } from "@/games/result";
import { playSound, prepareSoundEffects } from "@/lib/sound-effects";

/**
 * プレイを終えて結果を受け取る瞬間（完成演出を終えて `progress` が `clearing` から `result` へ移るとき）に、
 * 評価段階に応じた報酬の音を鳴らす。
 * 記録を保存して記録の結果画面へ移るときも、保存に失敗してその場で結果画面を出すときも鳴らす。
 * 記録から開いた結果画面と、結果画面の再読み込みはプレイを通らないので鳴らさない。
 */
export function useResultRewardSound(
  progress: GameProgress,
  score: number | null,
): void {
  const previousProgressRef = useRef(progress);

  useEffect(() => {
    prepareSoundEffects(gameResultSoundList);
  }, []);

  // 完成演出の完了は盤面の演出から届き、重ねて届くこともあるので、進行が結果へ移ったことを見て一度だけ鳴らす。
  useEffect(() => {
    const previousProgress = previousProgressRef.current;
    previousProgressRef.current = progress;
    if (
      previousProgress === "clearing" &&
      progress === "result" &&
      score !== null
    ) {
      playSound(getGameResultSound(getGameResultLevel(score)));
    }
  }, [progress, score]);
}

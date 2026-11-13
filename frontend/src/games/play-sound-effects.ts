import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";

import type { GameProgress } from "@/games/play";
import { prefersReducedMotion } from "@/lib/motion";
import { prepareSoundEffects, type SoundEffect } from "@/lib/sound-effects";

/**
 * 効果音を鳴らしうる画面を出したときに、その効果音の読み込みを始め、次の操作で音を出せるようにする。
 * ゲームの効果音のフック（`use<Game>SoundEffects`）は、そのゲームの効果音すべてを渡して呼ぶ。
 * アプリの画面の音と結果の報酬の音も、それを鳴らす画面の上位で呼ぶ。
 */
export function usePrepareSoundEffects(sounds: readonly SoundEffect[]): void {
  useEffect(() => {
    prepareSoundEffects(sounds);
  }, [sounds]);
}

/**
 * 効果音を鳴らす盤面操作の知らせ。プレイフックが操作ごとに増える `id` を付けて返す。
 * 同じ `id` の知らせは、何度描いても一度だけ鳴らす。
 */
export type SoundOperation = {
  id: number;
};

/**
 * プレイ画面 `<Game>Play` で呼ぶ。
 *
 * - `operation` はプレイフックが返す今の操作の知らせ。
 * - `playOperationSound` は知らせの種類で音を選び、`@/lib/sound-effects` の `playSound` で鳴らす。
 *   毎回作り直す関数を渡してよい。回数の多い操作の音には `variation: REPEATED_SOUND_VARIATION` を付ける。
 * - 知らせが複数の種類を持つなら、1つの関数の中で振り分ける。
 *
 * @example
 * useOperationSound(operation, function playOperationSound(operation) {
 *   switch (operation.type) {
 *     case "placed":
 *       playSound(placedSound, { variation: REPEATED_SOUND_VARIATION });
 *       return;
 *     case "invalid":
 *       playSound(invalidSound);
 *       return;
 *   }
 * });
 */
export function useOperationSound<Operation extends SoundOperation>(
  operation: Operation | null,
  playOperationSound: (operation: Operation) => void,
): void {
  const playedOperationIdRef = useRef(operation?.id ?? null);
  const play = useEffectEvent(playOperationSound);

  // 操作が成立したかは、プレイフックが session を更新した後の描画で初めて分かるので、
  // 盤面の操作のイベントハンドラでは鳴らせない。盤面の変化を描くのと同じ時に鳴らす。
  useLayoutEffect(() => {
    if (!operation || playedOperationIdRef.current === operation.id) {
      return;
    }
    playedOperationIdRef.current = operation.id;
    play(operation);
  }, [operation]);
}

type ClearSoundOptions = {
  /**
   * 動きを減らす設定で鳴らすクリア音。完成演出の代わりに、完成した盤面を止まった姿で保持して見せるゲームだけ渡す。
   * 渡さなければ、動きを減らす設定では完成演出が無くすぐ結果へ進むものとして、クリア音を鳴らさない。
   */
  playReducedMotionClearSound?: () => void;
};

/**
 * プレイ画面 `<Game>Play` で呼ぶ。
 *
 * - クリア音を完成演出の途中に合わせるなら `playSound` の `delayMs` で遅らせる。
 * - 結果を受け取る瞬間の報酬の音はアプリが鳴らすので、ゲームは鳴らさない。
 *
 * @example
 * useClearSound(progress, function playClearSound() {
 *   playSound(clearedSound, { delayMs: CLEAR_SOUND_DELAY_MS });
 * });
 *
 * @example
 * // 動きを減らす設定でも完成した盤面を保持して見せるゲーム
 * useClearSound(progress, playClearSound, {
 *   playReducedMotionClearSound() {
 *     playSound(heldBoardSound);
 *   },
 * });
 */
export function useClearSound(
  progress: GameProgress,
  playClearSound: () => void,
  { playReducedMotionClearSound }: ClearSoundOptions = {},
): void {
  const previousProgressRef = useRef(progress);
  const play = useEffectEvent(function playForMotionPreference() {
    if (prefersReducedMotion()) {
      playReducedMotionClearSound?.();
    } else {
      playClearSound();
    }
  });

  // クリアは盤面操作の結果として session が変わった描画で初めて分かるので、イベントハンドラでは鳴らせない。
  useLayoutEffect(() => {
    const previousProgress = previousProgressRef.current;
    previousProgressRef.current = progress;
    if (previousProgress === "playing" && progress === "clearing") {
      play();
    }
  }, [progress]);
}

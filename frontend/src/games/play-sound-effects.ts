import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";

import type { GameProgress } from "@/games/play";
import { prepareSoundEffects } from "@/lib/sound-effects";

/**
 * 効果音を鳴らす盤面操作の知らせ。プレイフックが操作ごとに増える `id` を付けて返す。
 * 同じ `id` の知らせは、何度描いても一度だけ鳴らす。
 */
export type SoundOperation = {
  id: number;
};

/**
 * 盤面操作の効果音を、操作の知らせ1つにつき一度だけ鳴らす。プレイ画面 `<Game>Play` で呼ぶ。
 *
 * - `operation` はプレイフックが返す今の操作の知らせ。画面を出した時点の知らせは鳴らし済みとして扱う。
 * - `playOperationSound` は知らせの種類で音を選び、`@/lib/sound-effects` の `playSound` で鳴らす。
 *   毎回作り直す関数を渡してよい。回数の多い操作の音には `variation: REPEATED_SOUND_VARIATION` を付ける。
 * - 知らせが無い描画（`null`）では何も鳴らさない。知らせが複数の種類を持つなら、1つの関数の中で振り分ける。
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

  useEffect(() => {
    prepareSoundEffects();
  }, []);

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

/**
 * 盤面の完成演出の始まり（`progress` が `playing` から `clearing` へ移るとき）に、ゲームのクリア音を鳴らす。
 * プレイ画面 `<Game>Play` で呼ぶ。
 *
 * - クリア音はゲームの題材から作り、完成演出に合わせる。演出の途中に合わせるなら `playSound` の `delayMs` で遅らせる。
 * - 結果を受け取る瞬間の報酬の音はアプリが鳴らすので、ゲームは鳴らさない。
 * - 画面を出した時点の進行は鳴らし済みとして扱う。リセットして解き直したら、またクリアしたときに鳴らす。
 *
 * @example
 * useClearSound(progress, function playClearSound() {
 *   playSound(clearedSound, { delayMs: CLEAR_SOUND_DELAY_MS });
 * });
 */
export function useClearSound(
  progress: GameProgress,
  playClearSound: () => void,
): void {
  const previousProgressRef = useRef(progress);
  const play = useEffectEvent(playClearSound);

  useEffect(() => {
    prepareSoundEffects();
  }, []);

  // クリアは盤面操作の結果として session が変わった描画で初めて分かるので、イベントハンドラでは鳴らせない。
  useLayoutEffect(() => {
    const previousProgress = previousProgressRef.current;
    previousProgressRef.current = progress;
    if (previousProgress === "playing" && progress === "clearing") {
      play();
    }
  }, [progress]);
}

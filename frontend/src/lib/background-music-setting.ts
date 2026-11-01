/**
 * BGM を流すかどうかの設定。効果音の設定とは別に選べる。全ゲームで共通にし、端末に保存して次に開いたときも引き継ぐ。
 * はじめは流す。保存した値を読めないときも流す。
 *
 * React からは `useSyncExternalStore(subscribeBackgroundMusicEnabled, isBackgroundMusicEnabled)` で読む。
 */

import { createStoredEnabledSetting } from "@/lib/stored-enabled-setting";

const backgroundMusicSetting = createStoredEnabledSetting(
  "pa-zzle.background-music.v1",
);

/** BGM を流す設定か。 */
export function isBackgroundMusicEnabled(): boolean {
  return backgroundMusicSetting.isEnabled();
}

/** BGM を流すかどうかを選び、端末に保存する。 */
export function setBackgroundMusicEnabled(next: boolean): void {
  backgroundMusicSetting.setEnabled(next);
}

/** 設定が変わったら `onChange` を呼ぶ。別のタブで変えたときも呼ぶ。購読をやめる関数を返す。 */
export function subscribeBackgroundMusicEnabled(
  onChange: () => void,
): () => void {
  return backgroundMusicSetting.subscribe(onChange);
}

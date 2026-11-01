/**
 * アプリを開いたとき（文書を読み込んだとき）の入口の状態。
 * ホームを開いたときだけタイトルを出し、その間に効果音をすべて読み込んで、遊び始めた最初の操作から鳴らせるようにする。
 *
 * 文書を読み込んだときに `startAppLaunch` を一度だけ呼ぶ。タイトルの状態は
 * React から `useSyncExternalStore(subscribeAppLaunchTitle, getAppLaunchTitle)` で読み、利用者が入ったら `enterApp` を呼ぶ。
 */

import { loadSoundEffects, type SoundEffect } from "@/lib/sound-effects";
import {
  isSoundEffectsEnabled,
  subscribeSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

/**
 * タイトルの状態。
 * - `hidden`: 出さない。ホーム以外を開いたときと、利用者が入った後。
 * - `loading`: 効果音を読み込んでいる。`progress` は済んだ割合（0〜1）。
 * - `ready`: 入れる。読み込み終えたか、待つのをやめた。
 */
export type AppLaunchTitle =
  | { status: "hidden" }
  | { status: "loading"; progress: number }
  | { status: "ready" };

type AppLaunchOptions = {
  /** タイトルを出すか。ホームを開いたときだけ出す。 */
  showTitle: boolean;
  /** アプリが鳴らしうる効果音すべて。 */
  sounds: readonly SoundEffect[];
};

/** 効果音の読み込みを待つ上限。回線が遅くても、これより長く入口で待たせない。 */
const SOUND_LOADING_LIMIT_MS = 4000;

const HIDDEN_TITLE: AppLaunchTitle = { status: "hidden" };
const READY_TITLE: AppLaunchTitle = { status: "ready" };

let launched = false;
let title: AppLaunchTitle = HIDDEN_TITLE;
const listeners = new Set<() => void>();
let stopWaitingForSounds: (() => void) | null = null;

/**
 * アプリを開いたときに一度だけ呼ぶ。2回目からは何もしない。
 *
 * - 効果音すべての読み込みを始める。タイトルを出さないときも、遊び始めるまでに読み込めるよう始めておく。
 * - タイトルを出すときは、読み込みが済むまで `loading` で待ち、済んだら `ready` にする。
 *   上限まで待っても済まないときと、読み込みに失敗した効果音があるときも、`ready` にして音なしで進める。
 * - 効果音を鳴らさない設定では待たない。待っている間に鳴らさない設定へ変えたら、待つのをやめる。
 */
export function startAppLaunch({ showTitle, sounds }: AppLaunchOptions): void {
  if (launched) {
    return;
  }
  launched = true;

  if (!showTitle || !isSoundEffectsEnabled()) {
    void loadSoundEffects(sounds);
    setTitle(showTitle ? READY_TITLE : HIDDEN_TITLE);
    return;
  }

  setTitle({ status: "loading", progress: 0 });
  waitForSounds(sounds);
}

function waitForSounds(sounds: readonly SoundEffect[]) {
  let waiting = true;
  const timeoutId = window.setTimeout(finishWaiting, SOUND_LOADING_LIMIT_MS);
  const unsubscribe = subscribeSoundEffectsEnabled(
    function stopWaitingWhenDisabled() {
      if (!isSoundEffectsEnabled()) {
        finishWaiting();
      }
    },
  );

  function finishWaiting() {
    if (!waiting) {
      return;
    }
    waiting = false;
    stopWaitingForSounds = null;
    window.clearTimeout(timeoutId);
    unsubscribe();
    if (title.status === "loading") {
      setTitle(READY_TITLE);
    }
  }

  stopWaitingForSounds = finishWaiting;
  void loadSoundEffects(sounds, function showProgress(progress) {
    if (waiting) {
      setTitle({ status: "loading", progress });
    }
  }).then(finishWaiting);
}

/** 利用者がタイトルから入ったら呼ぶ。タイトルを閉じ、まだ読み込みを待っていればやめる。 */
export function enterApp(): void {
  setTitle(HIDDEN_TITLE);
  stopWaitingForSounds?.();
}

/** 今のタイトルの状態。 */
export function getAppLaunchTitle(): AppLaunchTitle {
  return title;
}

/** タイトルの状態が変わったら `onChange` を呼ぶ。購読をやめる関数を返す。 */
export function subscribeAppLaunchTitle(onChange: () => void): () => void {
  listeners.add(onChange);
  return function unsubscribe() {
    listeners.delete(onChange);
  };
}

function setTitle(next: AppLaunchTitle) {
  if (title === next) {
    return;
  }
  title = next;
  for (const listener of listeners) {
    listener();
  }
}

/** アプリを開く前の状態へ戻す。画面のテストで、開き方ごとに始め直すために使う。 */
function resetAppLaunch() {
  stopWaitingForSounds?.();
  launched = false;
  title = HIDDEN_TITLE;
  listeners.clear();
}

export const _private = { SOUND_LOADING_LIMIT_MS, resetAppLaunch };

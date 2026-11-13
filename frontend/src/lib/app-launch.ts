import { loadSoundEffects, type SoundEffect } from "@/lib/sound-effects";
import {
  isSoundEffectsEnabled,
  soundEffectsVolumeSetting,
} from "@/lib/sound-effects-setting";

export type AppLaunchTitle =
  | { status: "hidden" }
  // `progress` は済んだ割合（0〜1）。
  | { status: "loading"; progress: number }
  | { status: "ready" };

type AppLaunchOptions = {
  showTitle: boolean;
  /** アプリが鳴らしうる効果音すべて。 */
  sounds: readonly SoundEffect[];
};

const SOUND_LOADING_LIMIT_MS = 4000;

const HIDDEN_TITLE: AppLaunchTitle = { status: "hidden" };
const READY_TITLE: AppLaunchTitle = { status: "ready" };

let launched = false;
let title: AppLaunchTitle = HIDDEN_TITLE;
const listeners = new Set<() => void>();
let stopWaitingForSounds: (() => void) | null = null;

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
  // 待つのは効果音だけで、BGM の曲は待たない。BGM は取得中も届いた分から流れる。
  waitForSounds(sounds);
}

function waitForSounds(sounds: readonly SoundEffect[]) {
  let waiting = true;
  const timeoutId = window.setTimeout(finishWaiting, SOUND_LOADING_LIMIT_MS);
  const unsubscribe = soundEffectsVolumeSetting.subscribe(
    function stopWaitingWhenMuted() {
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

export function enterApp(): void {
  setTitle(HIDDEN_TITLE);
  stopWaitingForSounds?.();
}

export function getAppLaunchTitle(): AppLaunchTitle {
  return title;
}

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

// 画面のテストで、開き方ごとに始め直すために使う。
function resetAppLaunch() {
  stopWaitingForSounds?.();
  launched = false;
  title = HIDDEN_TITLE;
  listeners.clear();
}

export const _private = { SOUND_LOADING_LIMIT_MS, resetAppLaunch };

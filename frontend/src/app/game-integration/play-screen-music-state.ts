import { useEffect } from "react";
import type { GameProgress } from "@/games/play";

export type PlayScreenMusicState = {
  progress: GameProgress;
  unsavedResultShown: boolean;
};

const initialPlayScreenMusicState: PlayScreenMusicState = {
  progress: "playing",
  unsavedResultShown: false,
};

let playScreenMusicState = initialPlayScreenMusicState;
const listeners = new Set<() => void>();

export function getPlayScreenMusicState(): PlayScreenMusicState {
  return playScreenMusicState;
}

export function subscribePlayScreenMusicState(
  onChange: () => void,
): () => void {
  listeners.add(onChange);
  return function unsubscribe() {
    listeners.delete(onChange);
  };
}

function setPlayScreenMusicState(state: PlayScreenMusicState): void {
  playScreenMusicState = state;
  for (const listener of listeners) {
    listener();
  }
}

/** プレイ画面の表示中だけ、BGM選択に必要な進行状態を通知する。 */
export function usePlayScreenMusicState(
  progress: GameProgress,
  unsavedResultShown: boolean,
): void {
  useEffect(() => {
    setPlayScreenMusicState({ progress, unsavedResultShown });
    return function leavePlayScreen() {
      setPlayScreenMusicState(initialPlayScreenMusicState);
    };
  }, [progress, unsavedResultShown]);
}

import { useEffect } from "react";

/** `solving` は導入中も含む。 */
export type TutorialMusicState = "closed" | "solving" | "solved";

let tutorialMusicState: TutorialMusicState = "closed";
const listeners = new Set<() => void>();

export function getTutorialMusicState(): TutorialMusicState {
  return tutorialMusicState;
}

export function subscribeTutorialMusicState(onChange: () => void): () => void {
  listeners.add(onChange);
  return function unsubscribe() {
    listeners.delete(onChange);
  };
}

function setTutorialMusicState(state: TutorialMusicState): void {
  tutorialMusicState = state;
  for (const listener of listeners) {
    listener();
  }
}

/** チュートリアルを表示する間、場面の状態を通知する。 */
export function useTutorialMusicState(state: TutorialMusicState): void {
  useEffect(() => {
    setTutorialMusicState(state);
    return function leaveTutorial() {
      setTutorialMusicState("closed");
    };
  }, [state]);
}

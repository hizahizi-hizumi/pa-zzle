/**
 * プレイ中の曲を決めるために試聴する、一時的な候補と、選んだ候補。
 * 曲を決めたら、試聴用の切り替え（`PlayMusicAuditionSwitcher`）と不採用の曲ごと消し、
 * 決めた曲を `@/components/app-background-music` のプレイ中の曲に直接指定する。
 * 選んだ候補は端末に保存し、再読み込みしても残す。
 */

import { useSyncExternalStore } from "react";

import playAuditionAUrl from "@/assets/background-music/play-audition/play-a.mp3";
import playAuditionBUrl from "@/assets/background-music/play-audition/play-b.mp3";
import playAuditionCUrl from "@/assets/background-music/play-audition/play-c.mp3";
import {
  type BackgroundMusicTrack,
  defineBackgroundMusicTrack,
} from "@/lib/background-music";

export type PlayMusicAuditionCandidate = {
  id: string;
  name: string;
  track: BackgroundMusicTrack;
};

const PLAY_MUSIC_AUDITION_STORAGE_KEY = "pa-zzle.play-music-audition.v1";

export const playMusicAuditionCandidates: readonly [
  PlayMusicAuditionCandidate,
  ...PlayMusicAuditionCandidate[],
] = [
  {
    id: "A",
    name: "ゆっくりした拍",
    track: defineBackgroundMusicTrack({
      url: playAuditionAUrl,
      loopLength: 6_144_000,
    }),
  },
  {
    id: "B",
    name: "かすかな拍",
    track: defineBackgroundMusicTrack({
      url: playAuditionBUrl,
      loopLength: 5_760_000,
    }),
  },
  {
    id: "C",
    name: "拍なし",
    track: defineBackgroundMusicTrack({
      url: playAuditionCUrl,
      loopLength: 6_144_000,
    }),
  },
];

let selectedCandidate: PlayMusicAuditionCandidate | null = null;
const selectedCandidateListeners = new Set<() => void>();

/** 試聴しているプレイ中の曲の候補。はじめは保存した候補にする。 */
export function usePlayMusicAuditionCandidate(): PlayMusicAuditionCandidate {
  return useSyncExternalStore(subscribeSelectedCandidate, getSelectedCandidate);
}

/** プレイ中の曲の候補を選び、端末に保存する。 */
export function selectPlayMusicAuditionCandidate(
  candidate: PlayMusicAuditionCandidate,
): void {
  savePlayMusicAuditionCandidate(candidate);
  selectedCandidate = candidate;
  for (const listener of selectedCandidateListeners) {
    listener();
  }
}

function getSelectedCandidate(): PlayMusicAuditionCandidate {
  selectedCandidate ??= readPlayMusicAuditionCandidate();
  return selectedCandidate;
}

function subscribeSelectedCandidate(onChange: () => void): () => void {
  selectedCandidateListeners.add(onChange);
  return function unsubscribe() {
    selectedCandidateListeners.delete(onChange);
  };
}

/** 保存した候補を読む。保存していないか、今の候補に無い候補なら最初の候補を返す。 */
function readPlayMusicAuditionCandidate(): PlayMusicAuditionCandidate {
  const storedId = readStoredId();
  return (
    playMusicAuditionCandidates.find(({ id }) => id === storedId) ??
    playMusicAuditionCandidates[0]
  );
}

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(PLAY_MUSIC_AUDITION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePlayMusicAuditionCandidate(
  candidate: PlayMusicAuditionCandidate,
): void {
  try {
    window.localStorage.setItem(PLAY_MUSIC_AUDITION_STORAGE_KEY, candidate.id);
  } catch {
    // 保存できない端末でも、開いている間は選んだ候補を流す。
  }
}

export const _private = { readPlayMusicAuditionCandidate };

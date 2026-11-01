/**
 * BGM を決めるための試聴用の候補。候補を決めたら、この試聴用の切り替えごと消す。
 * 選んだ候補は端末に保存し、再読み込みしても残す。
 */

import { useState } from "react";
import puzzlePopHomeUrl from "@/assets/bgm-audition/1-puzzle-pop-home.mp3";
import puzzlePopResultUrl from "@/assets/bgm-audition/1-puzzle-pop-result.mp3";
import eightBitMalletHomeUrl from "@/assets/bgm-audition/9-8bit-mallet-home.mp3";
import eightBitMalletResultUrl from "@/assets/bgm-audition/9-8bit-mallet-result.mp3";
import skipPopHomeUrl from "@/assets/bgm-audition/10-skip-pop-home.mp3";
import skipPopResultUrl from "@/assets/bgm-audition/10-skip-pop-result.mp3";
import hidamariPopHomeUrl from "@/assets/bgm-audition/11-hidamari-pop-home.mp3";
import hidamariPopResultUrl from "@/assets/bgm-audition/11-hidamari-pop-result.mp3";
import picoDashHomeUrl from "@/assets/bgm-audition/12-pico-dash-home.mp3";
import picoDashResultUrl from "@/assets/bgm-audition/12-pico-dash-result.mp3";
import skipMarimbaHomeUrl from "@/assets/bgm-audition/13-skip-marimba-home.mp3";
import skipMarimbaResultUrl from "@/assets/bgm-audition/13-skip-marimba-result.mp3";

import type { AppBackgroundMusicTracks } from "@/components/app-background-music";
import { defineBackgroundMusicTrack } from "@/lib/background-music";

/** 候補の編成（楽器・音色）。同じ編成の中では、曲（主題・和音・構成）だけが違う。 */
export type BgmAuditionArrangement = "パズルポップ" | "8bit マレット";

export type BgmAuditionCandidate = {
  number: number;
  name: string;
  arrangement: BgmAuditionArrangement;
  tracks: AppBackgroundMusicTracks;
};

/** 編成ごとのまとまりの見出し。並べる順もこの順にする。 */
export const bgmAuditionArrangementLabels = {
  パズルポップ: "パズルポップ（マリンバ・木琴・ピチカート）",
  "8bit マレット": "8bit マレット（マリンバ × チップ音）",
} satisfies Record<BgmAuditionArrangement, string>;

const BGM_AUDITION_STORAGE_KEY = "pa-zzle.bgm-audition.v1";

export const bgmAuditionCandidates: readonly [
  BgmAuditionCandidate,
  ...BgmAuditionCandidate[],
] = [
  {
    number: 1,
    name: "パズルポップ",
    arrangement: "パズルポップ",
    tracks: {
      home: defineBackgroundMusicTrack(puzzlePopHomeUrl),
      result: defineBackgroundMusicTrack(puzzlePopResultUrl),
    },
  },
  {
    number: 10,
    name: "スキップポップ",
    arrangement: "パズルポップ",
    tracks: {
      home: defineBackgroundMusicTrack(skipPopHomeUrl),
      result: defineBackgroundMusicTrack(skipPopResultUrl),
    },
  },
  {
    number: 11,
    name: "ひだまりポップ",
    arrangement: "パズルポップ",
    tracks: {
      home: defineBackgroundMusicTrack(hidamariPopHomeUrl),
      result: defineBackgroundMusicTrack(hidamariPopResultUrl),
    },
  },
  {
    number: 9,
    name: "8bit マレット",
    arrangement: "8bit マレット",
    tracks: {
      home: defineBackgroundMusicTrack(eightBitMalletHomeUrl),
      result: defineBackgroundMusicTrack(eightBitMalletResultUrl),
    },
  },
  {
    number: 12,
    name: "ピコダッシュ",
    arrangement: "8bit マレット",
    tracks: {
      home: defineBackgroundMusicTrack(picoDashHomeUrl),
      result: defineBackgroundMusicTrack(picoDashResultUrl),
    },
  },
  {
    number: 13,
    name: "スキップマリンバ",
    arrangement: "8bit マレット",
    tracks: {
      home: defineBackgroundMusicTrack(skipMarimbaHomeUrl),
      result: defineBackgroundMusicTrack(skipMarimbaResultUrl),
    },
  },
];

/** 試聴する候補と、候補を選んで保存する関数を返す。はじめは保存した候補にする。 */
export function useBgmAuditionCandidate(): [
  BgmAuditionCandidate,
  (candidate: BgmAuditionCandidate) => void,
] {
  const [candidate, setCandidate] = useState(readBgmAuditionCandidate);

  function selectCandidate(selected: BgmAuditionCandidate) {
    saveBgmAuditionCandidate(selected);
    setCandidate(selected);
  }

  return [candidate, selectCandidate];
}

/** 保存した候補を読む。保存していないか、今の候補に無い番号なら最初の候補を返す。 */
function readBgmAuditionCandidate(): BgmAuditionCandidate {
  const stored = readStoredNumber();
  return (
    bgmAuditionCandidates.find(({ number }) => number === stored) ??
    bgmAuditionCandidates[0]
  );
}

function readStoredNumber(): number | null {
  try {
    const stored = window.localStorage.getItem(BGM_AUDITION_STORAGE_KEY);
    return stored === null ? null : Number(stored);
  } catch {
    return null;
  }
}

function saveBgmAuditionCandidate(candidate: BgmAuditionCandidate): void {
  try {
    window.localStorage.setItem(
      BGM_AUDITION_STORAGE_KEY,
      String(candidate.number),
    );
  } catch {
    // 保存できない端末でも、開いている間は選んだ候補を流す。
  }
}

export const _private = { readBgmAuditionCandidate };

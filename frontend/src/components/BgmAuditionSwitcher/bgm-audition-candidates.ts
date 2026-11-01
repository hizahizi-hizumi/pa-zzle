/**
 * BGM を決めるための試聴用の候補。候補を決めたら、この試聴用の切り替えごと消す。
 * 選んだ候補は端末に保存し、再読み込みしても残す。
 */

import { useState } from "react";
import puzzlePopHomeUrl from "@/assets/bgm-audition/1-puzzle-pop-home.mp3";
import puzzlePopResultUrl from "@/assets/bgm-audition/1-puzzle-pop-result.mp3";
import chiptuneHomeUrl from "@/assets/bgm-audition/2-chiptune-home.mp3";
import chiptuneResultUrl from "@/assets/bgm-audition/2-chiptune-result.mp3";
import synthPopHomeUrl from "@/assets/bgm-audition/5-synth-pop-home.mp3";
import synthPopResultUrl from "@/assets/bgm-audition/5-synth-pop-result.mp3";
import musicBoxStringsHomeUrl from "@/assets/bgm-audition/6-music-box-strings-home.mp3";
import musicBoxStringsResultUrl from "@/assets/bgm-audition/6-music-box-strings-result.mp3";
import toyPopHomeUrl from "@/assets/bgm-audition/7-toy-pop-home.mp3";
import toyPopResultUrl from "@/assets/bgm-audition/7-toy-pop-result.mp3";
import chipSynthPopHomeUrl from "@/assets/bgm-audition/8-chip-synth-pop-home.mp3";
import chipSynthPopResultUrl from "@/assets/bgm-audition/8-chip-synth-pop-result.mp3";
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

export type BgmAuditionCandidate = {
  number: number;
  name: string;
  tracks: AppBackgroundMusicTracks;
};

const BGM_AUDITION_STORAGE_KEY = "pa-zzle.bgm-audition.v1";

export const bgmAuditionCandidates: readonly [
  BgmAuditionCandidate,
  ...BgmAuditionCandidate[],
] = [
  {
    number: 1,
    name: "パズルポップ",
    tracks: {
      home: defineBackgroundMusicTrack(puzzlePopHomeUrl),
      result: defineBackgroundMusicTrack(puzzlePopResultUrl),
    },
  },
  {
    number: 2,
    name: "チップチューン",
    tracks: {
      home: defineBackgroundMusicTrack(chiptuneHomeUrl),
      result: defineBackgroundMusicTrack(chiptuneResultUrl),
    },
  },
  {
    number: 5,
    name: "シンセポップ",
    tracks: {
      home: defineBackgroundMusicTrack(synthPopHomeUrl),
      result: defineBackgroundMusicTrack(synthPopResultUrl),
    },
  },
  {
    number: 6,
    name: "オルゴールと弦",
    tracks: {
      home: defineBackgroundMusicTrack(musicBoxStringsHomeUrl),
      result: defineBackgroundMusicTrack(musicBoxStringsResultUrl),
    },
  },
  {
    number: 7,
    name: "トイポップ",
    tracks: {
      home: defineBackgroundMusicTrack(toyPopHomeUrl),
      result: defineBackgroundMusicTrack(toyPopResultUrl),
    },
  },
  {
    number: 8,
    name: "チップシンセポップ",
    tracks: {
      home: defineBackgroundMusicTrack(chipSynthPopHomeUrl),
      result: defineBackgroundMusicTrack(chipSynthPopResultUrl),
    },
  },
  {
    number: 9,
    name: "8bit マレット",
    tracks: {
      home: defineBackgroundMusicTrack(eightBitMalletHomeUrl),
      result: defineBackgroundMusicTrack(eightBitMalletResultUrl),
    },
  },
  {
    number: 10,
    name: "スキップポップ",
    tracks: {
      home: defineBackgroundMusicTrack(skipPopHomeUrl),
      result: defineBackgroundMusicTrack(skipPopResultUrl),
    },
  },
  {
    number: 11,
    name: "ひだまりポップ",
    tracks: {
      home: defineBackgroundMusicTrack(hidamariPopHomeUrl),
      result: defineBackgroundMusicTrack(hidamariPopResultUrl),
    },
  },
  {
    number: 12,
    name: "ピコダッシュ",
    tracks: {
      home: defineBackgroundMusicTrack(picoDashHomeUrl),
      result: defineBackgroundMusicTrack(picoDashResultUrl),
    },
  },
  {
    number: 13,
    name: "スキップマリンバ",
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

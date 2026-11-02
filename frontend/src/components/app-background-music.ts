/**
 * アプリの画面ごとに流す BGM を決める。曲を流す仕組みは `@/lib/background-music` が持つ。
 *
 * - ホーム・難易度選択・記録と、それ以外の案内の画面（ページが見つからないなど）: ホームの曲
 * - 結果画面: 結果の曲
 * - プレイ画面: 流さない（フェードアウトする）
 */

import { useEffect, useSyncExternalStore } from "react";
import { matchPath, useLocation } from "react-router";

import {
  type BackgroundMusicTrack,
  playBackgroundMusic,
  prepareBackgroundMusic,
} from "@/lib/background-music";

/** アプリが流す曲の組。 */
export type AppBackgroundMusicTracks = {
  home: BackgroundMusicTrack;
  result: BackgroundMusicTrack;
};

export type AppBackgroundMusicScene = "home" | "result" | "silent";

const PLAY_PATH_PATTERN = "/puzzles/:game/play/:difficulty";
const RESULT_PATH_PATTERN = "/puzzles/:game/result/:recordId";

let playScreenResultShown = false;
const resultShownListeners = new Set<() => void>();

/**
 * 画面で流す BGM の場面を決める。
 * プレイ画面のパスでも、記録を保存できずその場で結果画面を出している間は結果の場面にする。
 */
export function getAppBackgroundMusicScene(
  pathname: string,
  resultShownOnPlayScreen: boolean,
): AppBackgroundMusicScene {
  if (matchPath(RESULT_PATH_PATTERN, pathname)) {
    return "result";
  }
  if (matchPath(PLAY_PATH_PATTERN, pathname)) {
    return resultShownOnPlayScreen ? "result" : "silent";
  }
  return "home";
}

/** 場面で流す曲。流さない場面では `null`。 */
export function selectAppBackgroundMusicTrack(
  scene: AppBackgroundMusicScene,
  tracks: AppBackgroundMusicTracks,
): BackgroundMusicTrack | null {
  switch (scene) {
    case "home":
      return tracks.home;
    case "result":
      return tracks.result;
    case "silent":
      return null;
  }
}

/**
 * 今の画面に合わせて BGM を流し、今の画面の場面を返す。アプリの全画面を包む部品で一度呼ぶ。
 * 流しうる曲（ホームと結果の曲）は先に読み込み、プレイを終えて結果画面へ移ったときに待たせない。
 */
export function useAppBackgroundMusic(
  tracks: AppBackgroundMusicTracks,
): AppBackgroundMusicScene {
  const { pathname } = useLocation();
  const resultShown = useSyncExternalStore(
    subscribeResultShownOnPlayScreen,
    isResultShownOnPlayScreen,
  );
  const scene = getAppBackgroundMusicScene(pathname, resultShown);
  const track = selectAppBackgroundMusicTrack(scene, tracks);

  useEffect(() => {
    prepareBackgroundMusic([tracks.home, tracks.result]);
  }, [tracks]);

  useEffect(() => {
    playBackgroundMusic(track);
  }, [track]);

  return scene;
}

/**
 * プレイ画面がその場で結果画面を出している間（`shown` が真の間）、結果の曲を流すようにする。
 * 記録を保存できたプレイは記録の結果画面へ移り、そのパスで結果の曲を流すので、ここでは知らせない。
 */
export function useResultShownOnPlayScreen(shown: boolean): void {
  useEffect(() => {
    if (!shown) {
      return;
    }
    setResultShownOnPlayScreen(true);
    return function hideResult() {
      setResultShownOnPlayScreen(false);
    };
  }, [shown]);
}

function isResultShownOnPlayScreen(): boolean {
  return playScreenResultShown;
}

function setResultShownOnPlayScreen(shown: boolean) {
  playScreenResultShown = shown;
  for (const listener of resultShownListeners) {
    listener();
  }
}

function subscribeResultShownOnPlayScreen(onChange: () => void): () => void {
  resultShownListeners.add(onChange);
  return function unsubscribe() {
    resultShownListeners.delete(onChange);
  };
}

/**
 * アプリの画面ごとに流す BGM を決める。曲を流す仕組みは `@/lib/background-music` が持つ。
 *
 * - ホーム・ゲームのホーム・記録と、それ以外の案内の画面（ページが見つからないなど）: ホームの曲
 * - プレイ画面: 盤面を解いている間はプレイ中の曲。クリアして完成演出が始まったらフェードアウトし、クリア音と報酬の音を前に出す
 * - 結果画面: 結果の曲
 * - アプリを開いたときのタイトル: 流さない。入ったら、入った先の画面の曲を流し始める
 *
 * プレイに入るときは、流れている曲を引いて間を空けてからプレイ中の曲を立ち上げ、ここから解くという区切りを聞かせる。
 * そのほかの曲の切り替えはクロスフェードにする。
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { matchPath, useLocation } from "react-router";

import homeMusicUrl from "@/assets/background-music/home.mp3";
import playMusicUrl from "@/assets/background-music/play.mp3";
import resultMusicUrl from "@/assets/background-music/result.mp3";
import type { GameProgress } from "@/games/play";
import { getAppLaunchTitle, subscribeAppLaunchTitle } from "@/lib/app-launch";
import {
  type BackgroundMusicTrack,
  type BackgroundMusicTransition,
  defineBackgroundMusicTrack,
  playBackgroundMusic,
  prepareBackgroundMusic,
} from "@/lib/background-music";

/** アプリが流す曲の組。 */
export type AppBackgroundMusicTracks = {
  home: BackgroundMusicTrack;
  play: BackgroundMusicTrack;
  result: BackgroundMusicTrack;
};

export type AppBackgroundMusicScene = "home" | "play" | "result" | "silent";

/** 場面で流す曲と、その曲に掛ける大きさ（倍）。 */
export type AppBackgroundMusic = {
  track: BackgroundMusicTrack;
  gain: number;
};

/** プレイ画面が知らせる、BGM の場面を決めるためのプレイの状態。 */
export type PlayScreenMusicState = {
  progress: GameProgress;
  /** 記録を保存できず、その場で結果画面を出しているか。 */
  resultShown: boolean;
};

const appBackgroundMusicTracks: AppBackgroundMusicTracks = {
  home: defineBackgroundMusicTrack({
    url: homeMusicUrl,
    loopLength: 3_686_400,
  }),
  play: defineBackgroundMusicTrack({
    url: playMusicUrl,
    loopLength: 7_168_000,
  }),
  result: defineBackgroundMusicTrack({
    url: resultMusicUrl,
    loopLength: 3_072_000,
  }),
};

/**
 * 場面ごとに曲へ掛ける大きさ。プレイ中は操作の効果音が頻繁に鳴るので、プレイ中の曲を効果音よりさらに奥へ下げる（-6 dB）。
 * 下げた分で、プレイ中の操作の効果音の多くが、曲の大きい箇所でも自分の鳴る帯域で曲より 10 dB 以上大きく聞こえる。
 * ホームの曲に対する、遊ぶゲームを選ぶ・プレイを始める音と同じ聞こえ方である。
 */
const sceneGains = {
  home: 1,
  play: 0.5,
  result: 1,
} as const satisfies Record<Exclude<AppBackgroundMusicScene, "silent">, number>;

/**
 * プレイに入るとき、流れている曲を引く長さ。選んだ直後に素早く引き、選ぶ場面が終わったことをすぐ伝える。
 * 短すぎると曲が途切れたように聞こえるので、引いていると分かる長さは残す。
 */
const ENTER_PLAY_FADE_OUT_SEC = 0.7;
/** 曲を引き切ってから、プレイ中の曲を立ち上げるまでの無音。前の曲の余韻を残さず、ここから解くという区切りを作る。 */
const ENTER_PLAY_SILENCE_SEC = 0.5;
/**
 * プレイ中の曲を立ち上げる長さ。盤面を見て解き始める間に、いつ鳴り始めたか気づかないほどゆっくり入れ、
 * 曲で注意を引かずに集中する場をつくる。
 */
const ENTER_PLAY_FADE_IN_SEC = 3;

/** プレイに入るときの切り替え。前の曲とプレイ中の曲を重ねない。 */
const enterPlayTransition: BackgroundMusicTransition = {
  kind: "break",
  fadeOutSec: ENTER_PLAY_FADE_OUT_SEC,
  silenceSec: ENTER_PLAY_SILENCE_SEC,
  fadeInSec: ENTER_PLAY_FADE_IN_SEC,
};

const crossfadeTransition: BackgroundMusicTransition = { kind: "crossfade" };

const PLAY_PATH_PATTERN = "/puzzles/:game/play/:difficulty";
const RESULT_PATH_PATTERN = "/puzzles/:game/result/:recordId";

/** プレイ画面がまだ何も知らせていないときの状態。盤面を解いている間として扱う。 */
const initialPlayScreenMusicState: PlayScreenMusicState = {
  progress: "playing",
  resultShown: false,
};

let playScreenMusicState = initialPlayScreenMusicState;
const playScreenMusicStateListeners = new Set<() => void>();

/**
 * 画面で流す BGM の場面を決める。
 * プレイ画面のパスでは、盤面を解いている間だけプレイ中の場面にし、クリアしてからは流さない。
 * 記録を保存できずその場で結果画面を出している間は結果の場面にする。
 */
export function getAppBackgroundMusicScene(
  pathname: string,
  { progress, resultShown }: PlayScreenMusicState,
): AppBackgroundMusicScene {
  if (matchPath(RESULT_PATH_PATTERN, pathname)) {
    return "result";
  }
  if (matchPath(PLAY_PATH_PATTERN, pathname)) {
    if (resultShown) {
      return "result";
    }
    return progress === "playing" ? "play" : "silent";
  }
  return "home";
}

/** 場面で流す曲と、その曲に掛ける大きさ。流さない場面では `null`。 */
export function selectAppBackgroundMusic(
  scene: AppBackgroundMusicScene,
  tracks: AppBackgroundMusicTracks,
): AppBackgroundMusic | null {
  if (scene === "silent") {
    return null;
  }
  return { track: tracks[scene], gain: sceneGains[scene] };
}

/**
 * 場面が移るときの曲の切り替え方。ほかの場面からプレイの場面に入るときは区切り、そのほかはクロスフェードにする。
 * 初めて流すとき（`previousScene` が `null`）にプレイの場面なら、区切りと同じくゆっくり立ち上げる。
 */
export function selectAppBackgroundMusicTransition(
  previousScene: AppBackgroundMusicScene | null,
  scene: AppBackgroundMusicScene,
): BackgroundMusicTransition {
  return scene === "play" && previousScene !== "play"
    ? enterPlayTransition
    : crossfadeTransition;
}

/**
 * 今の画面に合わせて BGM を流す。アプリの全画面を包む部品で一度呼ぶ。
 * 流しうる曲は先に読み込み、画面を移ったときに待たせない。読み込みは今の画面の曲を先にし、そのあとは
 * ホームから難易度を選んでプレイに入るときに間に合うようプレイ中の曲を、最後にプレイを終えるまでに要る結果の曲を読み込む。
 */
export function useAppBackgroundMusic(): void {
  const { pathname } = useLocation();
  const playScreen = useSyncExternalStore(
    subscribePlayScreenMusicState,
    getPlayScreenMusicState,
  );
  const titleShown = useSyncExternalStore(
    subscribeAppLaunchTitle,
    isAppLaunchTitleShown,
  );
  // タイトルはホームの上に重ねるので、裏のホームの曲を流さない。設定のボタンなどの操作で音を出せるようになっても鳴らさない。
  const scene = titleShown
    ? "silent"
    : getAppBackgroundMusicScene(pathname, playScreen);
  const music = selectAppBackgroundMusic(scene, appBackgroundMusicTracks);
  const track = music?.track ?? null;
  const gain = music?.gain;
  const previousScene = useRef<AppBackgroundMusicScene | null>(null);

  useEffect(() => {
    const { home, play, result } = appBackgroundMusicTracks;
    prepareBackgroundMusic([home, play, result]);
  }, []);

  useEffect(() => {
    const transition = selectAppBackgroundMusicTransition(
      previousScene.current,
      scene,
    );
    previousScene.current = scene;
    playBackgroundMusic(track, { gain, transition });
  }, [scene, track, gain]);
}

/**
 * プレイ画面のプレイの状態を、画面で流す BGM の場面に知らせる。プレイ画面を描く間、描くたびに呼ぶ。
 * 記録を保存できたプレイは記録の結果画面へ移り、そのパスで結果の曲を流すので、`resultShown` を真にしない。
 */
export function usePlayScreenMusicState(
  progress: GameProgress,
  resultShown: boolean,
): void {
  useEffect(() => {
    setPlayScreenMusicState({ progress, resultShown });
    return function leavePlayScreen() {
      setPlayScreenMusicState(initialPlayScreenMusicState);
    };
  }, [progress, resultShown]);
}

function isAppLaunchTitleShown(): boolean {
  return getAppLaunchTitle().status !== "hidden";
}

function getPlayScreenMusicState(): PlayScreenMusicState {
  return playScreenMusicState;
}

function setPlayScreenMusicState(state: PlayScreenMusicState) {
  playScreenMusicState = state;
  for (const listener of playScreenMusicStateListeners) {
    listener();
  }
}

function subscribePlayScreenMusicState(onChange: () => void): () => void {
  playScreenMusicStateListeners.add(onChange);
  return function unsubscribe() {
    playScreenMusicStateListeners.delete(onChange);
  };
}

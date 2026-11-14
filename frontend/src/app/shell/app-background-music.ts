import { useEffect, useRef, useSyncExternalStore } from "react";
import { matchPath, useLocation } from "react-router";
import {
  getPlayScreenMusicState,
  type PlayScreenMusicState,
  subscribePlayScreenMusicState,
} from "@/app/game-integration/play-screen-music-state";
import homeMusicUrl from "@/assets/background-music/home.mp3";
import playMusicUrl from "@/assets/background-music/play.mp3";
import resultMusicUrl from "@/assets/background-music/result.mp3";
import {
  getTutorialMusicState,
  subscribeTutorialMusicState,
  type TutorialMusicState,
} from "@/components/tutorial-music-state";
import { getAppLaunchTitle, subscribeAppLaunchTitle } from "@/lib/app-launch";
import {
  type BackgroundMusicTrack,
  type BackgroundMusicTransition,
  defineBackgroundMusicTrack,
  playBackgroundMusic,
  prepareBackgroundMusic,
} from "@/lib/audio/background-music";

export type AppBackgroundMusicTracks = {
  home: BackgroundMusicTrack;
  play: BackgroundMusicTrack;
  result: BackgroundMusicTrack;
};

export type AppBackgroundMusicScene = "home" | "play" | "result" | "silent";

export type AppBackgroundMusic = {
  track: BackgroundMusicTrack;
  gain: number;
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

const sceneGains = {
  home: 1,
  // プレイ中は操作の効果音が頻繁に鳴るので、曲を -6 dB 下げる。下げた分で、操作の効果音の多くが曲の大きい箇所でも
  // 自分の鳴る帯域で曲より 10 dB 以上大きく聞こえ、ホームの曲に対する遊ぶゲームを選ぶ・プレイを始める音と同じ聞こえ方になる。
  play: 0.5,
  result: 1,
} as const satisfies Record<Exclude<AppBackgroundMusicScene, "silent">, number>;

// 選んだ直後に素早く引き、選ぶ場面が終わったことをすぐ伝える。短すぎると曲が途切れたように聞こえるので、引いていると分かる長さは残す。
const ENTER_PLAY_FADE_OUT_SEC = 0.7;
// 前の曲の余韻を残さず、ここから解くという区切りを作る。
const ENTER_PLAY_SILENCE_SEC = 0.5;
// 盤面を見て解き始める間に、いつ鳴り始めたか気づかないほどゆっくり入れ、曲で注意を引かずに集中する場をつくる。
const ENTER_PLAY_FADE_IN_SEC = 3;

const enterPlayTransition: BackgroundMusicTransition = {
  kind: "break",
  fadeOutSec: ENTER_PLAY_FADE_OUT_SEC,
  silenceSec: ENTER_PLAY_SILENCE_SEC,
  fadeInSec: ENTER_PLAY_FADE_IN_SEC,
};

const crossfadeTransition: BackgroundMusicTransition = { kind: "crossfade" };

const PLAY_PATH_PATTERN = "/puzzles/:game/play/:difficulty";
const RESULT_PATH_PATTERN = "/puzzles/:game/result/:recordId";

function isAppLaunchTitleShown(): boolean {
  return getAppLaunchTitle().status !== "hidden";
}

export function getAppBackgroundMusicScene(
  pathname: string,
  { progress, unsavedResultShown }: PlayScreenMusicState,
  tutorial: TutorialMusicState,
): AppBackgroundMusicScene {
  // チュートリアルは開いた画面の上に重ねるので、開いた画面によらず決める。
  if (tutorial !== "closed") {
    return tutorial === "solving" ? "play" : "silent";
  }
  if (matchPath(RESULT_PATH_PATTERN, pathname)) {
    return "result";
  }
  if (matchPath(PLAY_PATH_PATTERN, pathname)) {
    if (unsavedResultShown) {
      return "result";
    }
    return progress === "playing" ? "play" : "silent";
  }
  return "home";
}

export function selectAppBackgroundMusic(
  scene: AppBackgroundMusicScene,
  tracks: AppBackgroundMusicTracks,
): AppBackgroundMusic | null {
  if (scene === "silent") {
    return null;
  }
  return { track: tracks[scene], gain: sceneGains[scene] };
}

/** `previousScene` は、まだ何も流していなければ `null`。 */
export function selectAppBackgroundMusicTransition(
  previousScene: AppBackgroundMusicScene | null,
  scene: AppBackgroundMusicScene,
): BackgroundMusicTransition {
  return scene === "play" && previousScene !== "play"
    ? enterPlayTransition
    : crossfadeTransition;
}

/** アプリの全画面を包む部品で一度呼ぶ。 */
export function useAppBackgroundMusic(): void {
  const { pathname } = useLocation();
  const playScreen = useSyncExternalStore(
    subscribePlayScreenMusicState,
    getPlayScreenMusicState,
  );
  const tutorial = useSyncExternalStore(
    subscribeTutorialMusicState,
    getTutorialMusicState,
  );
  const titleShown = useSyncExternalStore(
    subscribeAppLaunchTitle,
    isAppLaunchTitleShown,
  );
  // タイトルはホームの上に重ねるので、裏のホームの曲を流さない。
  const scene = titleShown
    ? "silent"
    : getAppBackgroundMusicScene(pathname, playScreen, tutorial);
  const music = selectAppBackgroundMusic(scene, appBackgroundMusicTracks);
  const track = music?.track ?? null;
  const gain = music?.gain;
  const previousScene = useRef<AppBackgroundMusicScene | null>(null);

  // 流しうる曲は先に読み込み、画面を移ったときに待たせない。今の画面の曲のあとは、ホームから難易度を選んでプレイに入るときに
  // 間に合うようプレイ中の曲を、最後にプレイを終えるまでに要る結果の曲を読み込む。
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

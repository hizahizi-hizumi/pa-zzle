/**
 * 同梱した曲を、BGM として Web Audio API で継ぎ目なくループ再生する。
 * 効果音と同じ AudioContext（`@/lib/audio-context`）から鳴らし、BGM 用の出口を効果音より十分小さくして、効果音が常に前に聞こえるようにする。
 *
 * 曲は Vite のアセット import で URL として受け取り、`defineBackgroundMusicTrack` に渡して作る。
 * 流しうる曲は `prepareBackgroundMusic` で先に読み込み、今の画面で流す曲は `playBackgroundMusic` で決める。
 * 曲を切り替えるとクロスフェードし、同じ曲を流したまま別の画面に移っても頭から流し直さない。
 * 流さない設定（`@/lib/background-music-setting`）の間は、読み込みも再生もしない。
 */

import {
  canPlayAudio,
  decodeAudioFile,
  getRunningAudioContext,
  requestAudioContextUnlock,
  subscribeAudioContextRunning,
} from "@/lib/audio-context";
import {
  isBackgroundMusicEnabled,
  subscribeBackgroundMusicEnabled,
} from "@/lib/background-music-setting";

/** 同梱した、ループする曲1つ。曲は頭から終わりまでで1ループになるよう作り、継ぎ目に無音を入れない。 */
export type BackgroundMusicTrack = {
  readonly url: string;
};

type MusicOutput = {
  context: AudioContext;
  /** BGM すべてが通る出口。 */
  volume: GainNode;
};

/** 流している1曲。切り替えるときは、前の曲をフェードアウトしながら次の曲をフェードインする。 */
type MusicVoice = {
  url: string;
  source: AudioBufferSourceNode;
  fader: GainNode;
};

/**
 * BGM の出口の音量。曲は -18 LUFS 前後で作ってあり、ここで 26 dB 下げる。
 * アプリの画面の効果音（遊ぶゲームを選ぶ・プレイを始める音）は短い区間の大きさが曲より 6 dB ほど上に、
 * 結果の報酬の音は 15 dB 以上上になり、効果音が曲に埋もれない。
 */
const BACKGROUND_MUSIC_VOLUME = 0.05;
const FADE_IN_SEC = 1.2;
const FADE_OUT_SEC = 0.8;

let musicOutput: MusicOutput | null = null;
let currentVoice: MusicVoice | null = null;
/** 今の画面で流したい曲の URL。流す設定に変わったときや、読み込み・AudioContext を待ってから流すときに使う。 */
let wantedUrl: string | null = null;
/** 先に読み込んでおく曲の URL。これと流したい曲・流している曲のほかは、読み込んだデータを捨てる。 */
let preparedUrls = new Set<string>();
const loadingUrls = new Set<string>();
const trackBuffers = new Map<string, AudioBuffer>();
/** これから流し始める曲を、この時刻（`performance.now()`）まで流し始めない。 */
let startHeldUntilMs = 0;
let listening = false;

/** 音声ファイルの URL から曲を作る。 */
export function defineBackgroundMusicTrack(url: string): BackgroundMusicTrack {
  return { url };
}

/**
 * 流しうる曲を渡し、流すときに待たせないよう読み込みを始める。何度呼んでもよい。
 * 前に渡した曲のうち今回渡さず、流してもいない曲は、読み込んだデータを捨てる。流さない設定の間は読み込まない。
 */
export function prepareBackgroundMusic(
  tracks: readonly BackgroundMusicTrack[],
): void {
  if (!canPlayAudio()) {
    return;
  }
  preparedUrls = new Set(tracks.map(({ url }) => url));
  listenForChanges();
  forgetUnwantedTracks();
  syncBackgroundMusic();
}

/**
 * 今の画面で流す曲を決める。`null` ならフェードアウトして止める。
 *
 * - 流している曲と同じ曲なら、何もしない（頭から流し直さない）。
 * - 別の曲なら、読み込みを終えてからクロスフェードで切り替える。読み込むまでは今の曲を流し続ける。
 * - 利用者がまだ操作しておらず音を出せないときは、操作で AudioContext が動き出した時点で流し始める。
 * - 流さない設定の間は流さず、流す設定に変わったときに流し始める。
 */
export function playBackgroundMusic(track: BackgroundMusicTrack | null): void {
  if (!canPlayAudio()) {
    return;
  }
  wantedUrl = track?.url ?? null;
  listenForChanges();
  syncBackgroundMusic();
}

/**
 * これから流し始める曲を、`durationMs` 後まで流し始めないようにする。流している曲はそのまま流す。
 * 結果の報酬の音のように、BGM と重ねずに聞かせたい音を鳴らしたときに、その音の長さを渡す。
 */
export function holdBackgroundMusicStart(durationMs: number): void {
  startHeldUntilMs = Math.max(startHeldUntilMs, performance.now() + durationMs);
}

function listenForChanges() {
  if (listening) {
    return;
  }
  listening = true;
  subscribeBackgroundMusicEnabled(syncBackgroundMusic);
  subscribeAudioContextRunning(syncBackgroundMusic);
}

function wantsMusic(): boolean {
  return isBackgroundMusicEnabled() && wantedUrl !== null;
}

/** 設定・流したい曲・読み込み・AudioContext の状態に合わせて、流す曲を揃える。 */
function syncBackgroundMusic() {
  if (!isBackgroundMusicEnabled()) {
    fadeOutCurrentVoice();
    return;
  }
  loadPreparedTracks();
  if (wantedUrl === null) {
    fadeOutCurrentVoice();
    return;
  }
  if (currentVoice?.url === wantedUrl) {
    return;
  }

  const output = getMusicOutput();
  if (!output) {
    requestAudioContextUnlock(wantsMusic);
  }
  const buffer = trackBuffers.get(wantedUrl);
  if (!buffer) {
    loadTrack(wantedUrl);
  }
  if (!output || !buffer) {
    return;
  }
  fadeOutCurrentVoice();
  currentVoice = startVoice(output, wantedUrl, buffer);
  forgetUnwantedTracks();
}

function loadPreparedTracks() {
  for (const url of preparedUrls) {
    loadTrack(url);
  }
}

function loadTrack(url: string) {
  if (trackBuffers.has(url) || loadingUrls.has(url)) {
    return;
  }
  const decoding = decodeAudioFile(url);
  if (!decoding) {
    return;
  }
  loadingUrls.add(url);
  decoding.then(
    function keepDecodedTrack(buffer) {
      loadingUrls.delete(url);
      if (isWantedTrack(url)) {
        trackBuffers.set(url, buffer);
        syncBackgroundMusic();
      }
    },
    function forgetFailedLoad(error: unknown) {
      loadingUrls.delete(url);
      if (import.meta.env.DEV) {
        console.warn(`BGM を読み込めない: ${url}`, error);
      }
    },
  );
}

function isWantedTrack(url: string): boolean {
  return (
    preparedUrls.has(url) || wantedUrl === url || currentVoice?.url === url
  );
}

/** 1曲を読み解いたデータは大きい（1分で 20 MB 以上）ので、流しうる曲のほかは持ち続けない。 */
function forgetUnwantedTracks() {
  for (const url of trackBuffers.keys()) {
    if (!isWantedTrack(url)) {
      trackBuffers.delete(url);
    }
  }
}

function getMusicOutput(): MusicOutput | null {
  const context = getRunningAudioContext();
  if (!context) {
    return null;
  }
  if (musicOutput?.context === context) {
    return musicOutput;
  }
  const volume = context.createGain();
  volume.gain.value = BACKGROUND_MUSIC_VOLUME;
  volume.connect(context.destination);
  musicOutput = { context, volume };
  return musicOutput;
}

function startVoice(
  { context, volume }: MusicOutput,
  url: string,
  buffer: AudioBuffer,
): MusicVoice {
  const startTime =
    context.currentTime +
    Math.max(0, startHeldUntilMs - performance.now()) / 1000;
  const fader = context.createGain();
  fader.gain.value = 0;
  fader.gain.setValueAtTime(0, startTime);
  fader.gain.linearRampToValueAtTime(1, startTime + FADE_IN_SEC);
  fader.connect(volume);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(fader);
  source.addEventListener("ended", function disconnect() {
    source.disconnect();
    fader.disconnect();
  });
  source.start(startTime);
  return { url, source, fader };
}

function fadeOutCurrentVoice() {
  if (!currentVoice || !musicOutput) {
    return;
  }
  const { source, fader } = currentVoice;
  currentVoice = null;
  const now = musicOutput.context.currentTime;
  fader.gain.cancelScheduledValues(now);
  fader.gain.setValueAtTime(fader.gain.value, now);
  fader.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
  source.stop(now + FADE_OUT_SEC);
}

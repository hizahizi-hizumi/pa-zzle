/**
 * 同梱した曲を BGM として流す。効果音と同じ AudioContext（`@/lib/audio-context`）から鳴らし、
 * BGM 用の出口を効果音より小さくして、効果音が前に聞こえるようにする。
 *
 * 曲は `<audio>` 要素のストリーミング再生ですぐに流し始め、裏で曲全体を取得して読み解いたら、
 * 読み解いた曲の継ぎ目のないループ再生へ短いクロスフェードで渡す。要素のループは継ぎ目に隙間が出るブラウザがあるので、渡すまでのつなぎにだけ使う。
 * 要素の音も AudioContext へ通し、音量は BGM の出口で掛ける。モバイルのブラウザには、要素の `volume` をプログラムから変えられないものがある。
 *
 * 曲は Vite のアセット import で URL として受け取り、`defineBackgroundMusicTrack` に渡して作る。
 * 流しうる曲は `prepareBackgroundMusic` で渡し、今の画面で流す曲は `playBackgroundMusic` で決める。
 * 読み込みは今の画面で流す曲を先にし、流しうる曲はそのあとで1曲ずつ取得しておく。
 * 曲を切り替えるとクロスフェードし、同じ曲を流したまま別の画面に移っても頭から流し直さない。
 * 音量は `@/lib/background-music-setting` の設定に従い、流している曲も音量を変えるとすぐに変わる。音量が 0 の間は、読み込みも再生もしない。
 */

import {
  canPlayAudio,
  decodeAudioBlob,
  getAudioOutput,
  getRunningAudioContext,
  requestAudioContextUnlock,
  subscribeAudioContextRunning,
  subscribeUserGesture,
} from "@/lib/audio-context";
import {
  connectStreamPlayer,
  getStreamPlayer,
  isStreamingFromNetwork,
  listenForStreamPlayerChanges,
  playStreamPlayer,
  releaseIdleStreamPlayers,
  releaseStreamPlayer,
  type StreamPlayer,
  streamPlayersNeedUserGesture,
  unlockStreamPlayers,
} from "@/lib/background-music/stream-players";
import {
  backgroundMusicVolumeSetting,
  isBackgroundMusicEnabled,
} from "@/lib/background-music-setting";
import { getVolumeGain } from "@/lib/stored-volume-setting";

/** 同梱した、ループする曲1つ。曲は頭から終わりまでで1ループになるよう作り、継ぎ目に無音を入れない。 */
export type BackgroundMusicTrack = {
  readonly url: string;
};

type MusicOutput = {
  context: AudioContext;
  /** BGM すべてが通る出口。 */
  volume: GainNode;
};

/** 曲の流し方1つと、それを流し方の切り替えで重ねるための音量。 */
type VoiceSource<Source> = {
  source: Source;
  gain: GainNode;
};

/**
 * 流している1曲。切り替えるときは、次の曲が鳴り始めてから、前の曲をフェードアウトしながら次の曲をフェードインする。
 * 読み解くまでは要素でストリーミング再生し（`stream`）、読み解いたらループ再生（`loop`）へ渡す。
 */
type MusicVoice = {
  url: string;
  fader: GainNode;
  sounding: boolean;
  fading: boolean;
  stream: VoiceSource<StreamPlayer> | null;
  loop: VoiceSource<AudioBufferSourceNode> | null;
};

/**
 * 音量が最大のときに BGM の出口で掛ける大きさ。曲は -18.5 LUFS 前後で作ってあり、
 * 初期の音量では約 0.05 倍（-26 dB）にして、最後の出口の持ち上げ（`@/lib/audio-context`）と合わせて -40 LUFS 前後で流す。
 * 初期の音量どうしで効果音（`@/lib/sound-effects`）より約 20 dB 小さくし、効果音を曲に埋もれさせない。
 * 音量が最大では -28 LUFS 前後になり、曲のピークに最後の出口の圧縮は掛からない。
 */
const BACKGROUND_MUSIC_MAX_GAIN = 0.198;
/** 音量を変えたとき、出口の大きさが新しい音量に近づく速さ。急に変えて音にノイズが乗らないよう、わずかに時間を掛ける。 */
const VOLUME_CHANGE_TIME_CONSTANT_SEC = 0.02;
const FADE_IN_SEC = 1.2;
const FADE_OUT_SEC = 0.8;
/**
 * ストリーミング再生からループ再生へ渡すときに重ねる長さ。要素の再生位置から決めるループの再生位置には数ミリ秒の誤差があり、
 * 短く重ねて、つなぎ目に隙間も段差も作らない。重ねる長さを伸ばすと、誤差の分ずれた同じ音が重なって聞こえる時間が延びる。
 */
const LOOP_HANDOFF_SEC = 0.05;
/** ループ再生へ渡し始めるまでの余裕。渡す時刻より前に、音源の開始を AudioContext へ確実に頼んでおく。 */
const LOOP_HANDOFF_LEAD_SEC = 0.1;
/** フェードを終えてから要素を止めるまでの余裕。タイマーが早く来ても、鳴っている要素を止めない。 */
const RELEASE_MARGIN_MS = 100;

let musicOutput: MusicOutput | null = null;
/** 今の画面で流したい曲の音。まだ鳴り始めていないことがある。 */
let currentVoice: MusicVoice | null = null;
/** 前の曲の音。今の曲が鳴り始めるまでは流し続け、鳴り始めたらフェードアウトする。 */
const previousVoices = new Set<MusicVoice>();
/** 今の画面で流したい曲の URL。音量を 0 から上げたときや、AudioContext を待ってから流すときに使う。 */
let wantedUrl: string | null = null;
/** 先に取得しておく曲の URL。これと流したい曲・流している曲のほかは、取得したファイルを捨てる。 */
let preparedUrls = new Set<string>();
/** 取得した曲のファイル。読み込みは一度に1曲ずつにし、今の画面で流す曲の到着を遅らせない。 */
const trackFiles = new Map<string, Blob>();
let fetchingUrl: string | null = null;
let trackFileFetchScheduled = false;
const failedUrls = new Set<string>();
/** 流したい曲を読み解いたもの。1分で 20 MB 以上あるので、流したい曲のほかは持ち続けない。 */
const decodedTracks = new Map<string, AudioBuffer>();
let decodingUrl: string | null = null;
/** これから流し始める曲を、この時刻（`performance.now()`）まで流し始めない。 */
let startHeldUntilMs = 0;
let heldStartTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeUserGesture: (() => void) | null = null;
let listening = false;

/** 音声ファイルの URL から曲を作る。 */
export function defineBackgroundMusicTrack(url: string): BackgroundMusicTrack {
  return { url };
}

/**
 * 流しうる曲を渡し、流すときに待たせないよう取得しておく。何度呼んでもよい。
 * 取得は今の画面で流す曲を読み込んだあとにする。前に渡した曲のうち今回渡さず、流してもいない曲は、取得したファイルを捨てる。
 * 音量が 0 の間は取得しない。
 */
export function prepareBackgroundMusic(
  tracks: readonly BackgroundMusicTrack[],
): void {
  if (!canPlayAudio()) {
    return;
  }
  preparedUrls = new Set(tracks.map(({ url }) => url));
  listenForChanges();
  syncBackgroundMusic();
}

/**
 * 今の画面で流す曲を決める。`null` ならフェードアウトして止める。
 *
 * - 流している曲と同じ曲なら、何もしない（頭から流し直さない）。
 * - 別の曲なら、次の曲が鳴り始めてからクロスフェードで切り替える。鳴り始めるまでは今の曲を流し続ける。
 * - 利用者がまだ操作しておらず音を出せないときは、曲の読み込みだけを始め、操作の中で流し始める。
 * - 音量が 0 の間は流さず、音量を 0 から上げたときに流し始める。
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
  backgroundMusicVolumeSetting.subscribe(function applyVolumeChange() {
    applyBackgroundMusicVolume();
    syncBackgroundMusic();
  });
  subscribeAudioContextRunning(syncBackgroundMusic);
  listenForStreamPlayerChanges(syncBackgroundMusic);
}

function getBackgroundMusicGain(): number {
  return getVolumeGain(
    backgroundMusicVolumeSetting.getVolume(),
    BACKGROUND_MUSIC_MAX_GAIN,
  );
}

/** 音量を変えたら、流している曲も含めて出口の大きさを変える。 */
function applyBackgroundMusicVolume() {
  if (!musicOutput) {
    return;
  }
  const { context, volume } = musicOutput;
  const now = context.currentTime;
  volume.gain.cancelScheduledValues(now);
  volume.gain.setTargetAtTime(
    getBackgroundMusicGain(),
    now,
    VOLUME_CHANGE_TIME_CONSTANT_SEC,
  );
}

function wantsMusic(): boolean {
  return isBackgroundMusicEnabled() && wantedUrl !== null;
}

/** 設定・流したい曲・読み込み・AudioContext・要素の状態に合わせて、流す曲と読み込みを揃える。 */
function syncBackgroundMusic() {
  if (!wantsMusic()) {
    retireCurrentVoice();
    fadeOutPreviousVoices();
  } else if (currentVoice?.url !== wantedUrl) {
    switchToWantedTrack(getMusicOutput(getRunningAudioContext()));
  }
  advanceCurrentVoice();
  forgetUnwantedTracks();
  preloadWantedTrack();
  if (isBackgroundMusicEnabled()) {
    scheduleTrackFileFetch();
    decodeWantedTrack();
  }
  updateUserGestureSubscription();
}

/**
 * 利用者の操作の中で、流したい曲を流し始め、使い回す要素をこの先いつでも再生できるようにする。
 * iOS Safari は、操作の外で要素を再生させないことがある。
 */
function handleUserGesture(context: AudioContext) {
  if (!wantsMusic()) {
    return;
  }
  if (currentVoice?.url !== wantedUrl) {
    switchToWantedTrack(getMusicOutput(context));
  }
  unlockStreamPlayers(context);
  updateUserGestureSubscription();
}

function updateUserGestureSubscription() {
  const needsGesture = wantsMusic() && streamPlayersNeedUserGesture();
  if (needsGesture && !unsubscribeUserGesture) {
    unsubscribeUserGesture = subscribeUserGesture(handleUserGesture);
    requestAudioContextUnlock(wantsMusic);
  } else if (!needsGesture && unsubscribeUserGesture) {
    unsubscribeUserGesture();
    unsubscribeUserGesture = null;
  }
}

function getMusicOutput(context: AudioContext | null): MusicOutput | null {
  if (!context) {
    return null;
  }
  if (musicOutput?.context === context) {
    return musicOutput;
  }
  const volume = context.createGain();
  volume.gain.value = getBackgroundMusicGain();
  volume.connect(getAudioOutput(context));
  musicOutput = { context, volume };
  return musicOutput;
}

function switchToWantedTrack(output: MusicOutput | null) {
  const url = wantedUrl;
  if (url === null) {
    return;
  }
  retireCurrentVoice();
  const remaining = takePreviousVoice(url);
  if (remaining) {
    currentVoice = remaining;
    return;
  }
  if (!output) {
    requestAudioContextUnlock(wantsMusic);
    return;
  }
  currentVoice = startVoice(output, url);
}

/** 今の曲を前の曲へ回す。まだ鳴り始めていなければ、そのまま止める。 */
function retireCurrentVoice() {
  if (!currentVoice) {
    return;
  }
  if (currentVoice.sounding) {
    previousVoices.add(currentVoice);
  } else {
    disposeVoice(currentVoice);
  }
  currentVoice = null;
}

/** 前の曲のうち、フェードアウトを始めていない `url` の曲を、今の曲へ戻すために取り出す。 */
function takePreviousVoice(url: string): MusicVoice | null {
  for (const voice of previousVoices) {
    if (voice.url === url && !voice.fading) {
      previousVoices.delete(voice);
      return voice;
    }
  }
  return null;
}

/**
 * 曲を流し始める。読み解いてあればループ再生で、まだならストリーミング再生で流す。
 * 流し始めを待たせている間は、読み解いてあれば待たせた時刻にループ再生を始め、まだなら待たせた時刻にもう一度試す。
 */
function startVoice(output: MusicOutput, url: string): MusicVoice | null {
  const heldMs = Math.max(0, startHeldUntilMs - performance.now());
  const buffer = decodedTracks.get(url);
  if (buffer) {
    const startTime = output.context.currentTime + heldMs / 1000;
    const voice = createVoice(output, url);
    voice.loop = startLoopSource(output, voice.fader, buffer, startTime, 0);
    beginSounding(voice, startTime);
    return voice;
  }
  if (heldMs > 0) {
    syncAfterHeldStart(heldMs);
    return null;
  }
  const player = getStreamPlayer(url, trackFiles.get(url) ?? null);
  if (!player) {
    return null;
  }
  const voice = createVoice(output, url);
  const gain = output.context.createGain();
  connectStreamPlayer(player, output.context).connect(gain);
  gain.connect(voice.fader);
  voice.stream = { source: player, gain };
  playStreamPlayer(player);
  return voice;
}

function syncAfterHeldStart(heldMs: number) {
  if (heldStartTimer !== null) {
    clearTimeout(heldStartTimer);
  }
  heldStartTimer = setTimeout(function syncHeldStart() {
    heldStartTimer = null;
    syncBackgroundMusic();
  }, heldMs);
}

function createVoice(
  { context, volume }: MusicOutput,
  url: string,
): MusicVoice {
  const fader = context.createGain();
  fader.gain.value = 0;
  fader.connect(volume);
  return {
    url,
    fader,
    sounding: false,
    fading: false,
    stream: null,
    loop: null,
  };
}

function startLoopSource(
  { context }: MusicOutput,
  destination: AudioNode,
  buffer: AudioBuffer,
  startTime: number,
  offset: number,
): VoiceSource<AudioBufferSourceNode> {
  const gain = context.createGain();
  gain.connect(destination);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  source.start(startTime, offset);
  return { source, gain };
}

/** 曲が鳴り始めたら、フェードインし、前の曲をフェードアウトする。 */
function beginSounding(voice: MusicVoice, startTime: number) {
  voice.sounding = true;
  const { gain } = voice.fader;
  gain.setValueAtTime(0, startTime);
  gain.linearRampToValueAtTime(1, startTime + FADE_IN_SEC);
  fadeOutPreviousVoices();
}

/** ストリーミング再生が鳴り始めたらフェードインし、曲を読み解いたらループ再生へ渡す。 */
function advanceCurrentVoice() {
  const voice = currentVoice;
  if (!voice?.stream || !musicOutput) {
    return;
  }
  if (!voice.sounding && voice.stream.source.playing) {
    beginSounding(voice, musicOutput.context.currentTime);
  }
  const buffer = decodedTracks.get(voice.url);
  if (buffer) {
    handOffToLoop(musicOutput, voice, buffer);
  }
}

/**
 * ストリーミング再生をループ再生へ渡す。鳴っていれば要素の再生位置からループを始めて短く重ね、
 * まだ鳴っていなければ（要素の読み込みや再生の許可を待っていれば）、頭からループを始める。
 */
function handOffToLoop(
  output: MusicOutput,
  voice: MusicVoice,
  buffer: AudioBuffer,
) {
  const { stream } = voice;
  if (!stream) {
    return;
  }
  voice.stream = null;
  const now = output.context.currentTime;
  if (!voice.sounding) {
    disposeStream(stream);
    voice.loop = startLoopSource(output, voice.fader, buffer, now, 0);
    beginSounding(voice, now);
    return;
  }
  const handoffTime = now + LOOP_HANDOFF_LEAD_SEC;
  const offset =
    (stream.source.element.currentTime + LOOP_HANDOFF_LEAD_SEC) %
    buffer.duration;
  const loop = startLoopSource(
    output,
    voice.fader,
    buffer,
    handoffTime,
    offset,
  );
  crossfade(stream.gain, loop.gain, handoffTime, LOOP_HANDOFF_SEC);
  voice.loop = loop;
  setTimeout(
    function releaseHandedOffStream() {
      disposeStream(stream);
      syncBackgroundMusic();
    },
    (LOOP_HANDOFF_LEAD_SEC + LOOP_HANDOFF_SEC) * 1000 + RELEASE_MARGIN_MS,
  );
}

function crossfade(
  from: GainNode,
  to: GainNode,
  startTime: number,
  durationSec: number,
) {
  from.gain.setValueAtTime(1, startTime);
  from.gain.linearRampToValueAtTime(0, startTime + durationSec);
  to.gain.value = 0;
  to.gain.setValueAtTime(0, startTime);
  to.gain.linearRampToValueAtTime(1, startTime + durationSec);
}

function fadeOutPreviousVoices() {
  for (const voice of previousVoices) {
    fadeOutVoice(voice);
  }
}

function fadeOutVoice(voice: MusicVoice) {
  if (voice.fading || !musicOutput) {
    return;
  }
  voice.fading = true;
  const now = musicOutput.context.currentTime;
  const { gain } = voice.fader;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
  voice.loop?.source.stop(now + FADE_OUT_SEC);
  setTimeout(
    function disposeFadedVoice() {
      previousVoices.delete(voice);
      disposeVoice(voice);
      syncBackgroundMusic();
    },
    FADE_OUT_SEC * 1000 + RELEASE_MARGIN_MS,
  );
}

function disposeVoice(voice: MusicVoice) {
  if (voice.stream) {
    disposeStream(voice.stream);
    voice.stream = null;
  }
  if (voice.loop) {
    disposeLoop(voice.loop);
    voice.loop = null;
  }
  voice.fader.disconnect();
}

function disposeStream({ source, gain }: VoiceSource<StreamPlayer>) {
  source.source?.disconnect();
  gain.disconnect();
  releaseStreamPlayer(source);
}

/** ループ再生は、フェードアウトの終わりに止めるよう頼んである。 */
function disposeLoop({ source, gain }: VoiceSource<AudioBufferSourceNode>) {
  source.disconnect();
  gain.disconnect();
}

/**
 * 流したい曲がまだ流れていなければ、要素に読み込ませておき、流し始めるときに待たせない。
 * 使っていない要素のうち、流したい曲でない曲を読み込ませている要素は止める。
 */
function preloadWantedTrack() {
  const url = wantsMusic() ? wantedUrl : null;
  releaseIdleStreamPlayers(function isWantedStream(playerUrl) {
    return playerUrl === url && !decodedTracks.has(playerUrl);
  });
  if (url === null || currentVoice?.url === url || decodedTracks.has(url)) {
    return;
  }
  getStreamPlayer(url, trackFiles.get(url) ?? null);
}

/**
 * 曲のファイルを1曲ずつ取得する。流したい曲を先にし、流しうる曲はそのあとにする。
 * 流したい曲を要素がネットワークから読み込んでいる間は、要素が続けて再生できるだけ読み込むまで、何も取得しない。
 *
 * 画面を描くと流しうる曲と流す曲が続けて決まるので、取得する曲は今の処理を終えてから選び、
 * 流す曲が決まる前に流しうる曲の取得を始めない。
 */
function scheduleTrackFileFetch() {
  if (trackFileFetchScheduled) {
    return;
  }
  trackFileFetchScheduled = true;
  queueMicrotask(function fetchScheduledTrackFile() {
    trackFileFetchScheduled = false;
    if (isBackgroundMusicEnabled()) {
      fetchNextTrackFile();
    }
  });
}

function fetchNextTrackFile() {
  if (fetchingUrl !== null) {
    return;
  }
  const url = findTrackFileToFetch();
  if (url === null) {
    return;
  }
  fetchingUrl = url;
  fetchTrackFile(url).then(
    function keepTrackFile(file) {
      fetchingUrl = null;
      if (isWantedTrack(url)) {
        trackFiles.set(url, file);
      }
      syncBackgroundMusic();
    },
    function skipFailedTrack(error: unknown) {
      fetchingUrl = null;
      failedUrls.add(url);
      if (import.meta.env.DEV) {
        console.warn(`BGM を読み込めない: ${url}`, error);
      }
      syncBackgroundMusic();
    },
  );
}

function findTrackFileToFetch(): string | null {
  const playingUrl = wantsMusic() ? wantedUrl : null;
  if (playingUrl !== null && isStreamingFromNetwork(playingUrl)) {
    return null;
  }
  const urls =
    playingUrl === null ? [...preparedUrls] : [playingUrl, ...preparedUrls];
  return (
    urls.find((url) => !trackFiles.has(url) && !failedUrls.has(url)) ?? null
  );
}

async function fetchTrackFile(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.blob();
}

/** 流したい曲のファイルを取得したら読み解く。 */
function decodeWantedTrack() {
  const url = wantsMusic() ? wantedUrl : null;
  if (url === null || decodingUrl !== null || decodedTracks.has(url)) {
    return;
  }
  const file = trackFiles.get(url);
  const decoding = file ? decodeAudioBlob(file) : null;
  if (!decoding) {
    return;
  }
  decodingUrl = url;
  decoding.then(
    function keepDecodedTrack(buffer) {
      decodingUrl = null;
      if (wantsMusic() && wantedUrl === url) {
        decodedTracks.set(url, buffer);
      }
      syncBackgroundMusic();
    },
    function skipFailedDecoding(error: unknown) {
      decodingUrl = null;
      trackFiles.delete(url);
      failedUrls.add(url);
      if (import.meta.env.DEV) {
        console.warn(`BGM を読み解けない: ${url}`, error);
      }
    },
  );
}

function isWantedTrack(url: string): boolean {
  return (
    preparedUrls.has(url) || wantedUrl === url || currentVoice?.url === url
  );
}

/** 流しうる曲のほかは取得したファイルを持ち続けず、読み解いたものは流したい曲のほかは持ち続けない。 */
function forgetUnwantedTracks() {
  for (const url of trackFiles.keys()) {
    if (!isWantedTrack(url)) {
      trackFiles.delete(url);
    }
  }
  for (const url of decodedTracks.keys()) {
    if (!wantsMusic() || url !== wantedUrl) {
      decodedTracks.delete(url);
    }
  }
}

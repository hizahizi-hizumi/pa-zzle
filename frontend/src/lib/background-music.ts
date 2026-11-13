/**
 * 曲のファイルは一度だけ取得する。取得し終える前に流すときは、届いた分を `<audio>` 要素で流し始め、取得し終えたら読み解いて、
 * 読み解いた曲の継ぎ目のないループ再生へ短いクロスフェードで渡す。要素のループは継ぎ目に隙間が出るブラウザがあるので、渡すまでのつなぎにだけ使う。
 * 要素の音も AudioContext へ通し、音量は BGM の出口で掛ける。モバイルのブラウザには、要素の `volume` をプログラムから変えられないものがある。
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

/** 曲は頭から終わりまでで1ループになるよう作り、継ぎ目に無音を入れない。 */
export type BackgroundMusicTrack = {
  readonly url: string;
  /**
   * 1ループのサンプル数（48 kHz）。読み解いた曲がこれより長ければ、MP3 の詰め物が残っているので、
   * 詰め物を除いた区間だけをループする。
   */
  readonly loopLength: number;
};

export type BackgroundMusicTransition =
  | { kind: "crossfade" }
  | {
      kind: "break";
      fadeOutSec: number;
      silenceSec: number;
      fadeInSec: number;
    };

export type PlayBackgroundMusicOptions = {
  gain?: number;
  transition?: BackgroundMusicTransition;
};

/** 読み解いた曲と、その中でループする区間（秒）。 */
type DecodedTrack = {
  buffer: AudioBuffer;
  loopStart: number;
  loopDuration: number;
};

type ReceivedPart = {
  url: string;
  type: string;
  chunks: Uint8Array<ArrayBuffer>[];
  size: number;
};

type MusicOutput = {
  context: AudioContext;
  volume: GainNode;
};

/** 曲の流し方1つと、それを流し方の切り替えで重ねるための音量。 */
type VoiceSource<Source> = {
  source: Source;
  gain: GainNode;
};

/** ループ再生と、流している曲の中の位置を求めるための、流し始めた時刻と1ループの中の位置（秒）。 */
type LoopSource = VoiceSource<AudioBufferSourceNode> & {
  track: DecodedTrack;
  startTime: number;
  position: number;
};

type MusicVoice = {
  url: string;
  fader: GainNode;
  /** 曲に掛ける大きさ（`PlayBackgroundMusicOptions` の `gain`）を、フェードとは別に掛ける。 */
  level: GainNode;
  /** `level` を近づけている大きさ。 */
  levelGain: number;
  fadeInSec: number;
  /** 鳴り始める時刻（AudioContext の時刻）。ループ再生を後の時刻に始めるよう頼んであれば、その時刻。まだなら `null`。 */
  soundingFrom: number | null;
  /** フェードアウトし終える時刻（AudioContext の時刻）。フェードアウトを始めていなければ `null`。 */
  fadedAt: number | null;
  stream: VoiceSource<StreamPlayer> | null;
  loop: LoopSource | null;
};

/**
 * 音量が最大のときに BGM の出口で掛ける大きさ。曲は -18.5 LUFS 前後で作ってあり、
 * 初期の音量では約 0.05 倍（-26 dB）にして、最後の出口の持ち上げ（`@/lib/audio-context`）と合わせて -40 LUFS 前後で流す。
 * 初期の音量どうしで効果音（`@/lib/sound-effects`）より約 20 dB 小さくし、効果音を曲に埋もれさせない。
 * 音量が最大では -28 LUFS 前後になり、曲のピークに最後の出口の圧縮は掛からない。
 */
const BACKGROUND_MUSIC_MAX_GAIN = 0.198;
/** 急に変えて音にノイズが乗らないよう、音量を変えたときにわずかに時間を掛ける。 */
const VOLUME_CHANGE_TIME_CONSTANT_SEC = 0.02;
/** 流している曲に掛ける大きさは、曲を切り替えるフェードと同じくらいの時間で変える。 */
const LEVEL_CHANGE_TIME_CONSTANT_SEC = 0.3;
const FADE_IN_SEC = 1.2;
const FADE_OUT_SEC = 0.8;
/**
 * ストリーミング再生からループ再生へ渡すときに重ねる長さ。要素の再生位置から決めるループの再生位置には数ミリ秒の誤差があり、
 * 短く重ねて、つなぎ目に隙間も段差も作らない。重ねる長さを伸ばすと、誤差の分ずれた同じ音が重なって聞こえる時間が延びる。
 */
const LOOP_HANDOFF_SEC = 0.05;
/** 渡す時刻より前に、音源の開始を AudioContext へ確実に頼んでおく。 */
const LOOP_HANDOFF_LEAD_SEC = 0.1;
/**
 * MP3 を読み解いても詰め物を取り除かないブラウザで、読み解いた曲の先頭の詰め物と見なす無音の大きさの上限（約 -60 dBFS）。
 * 先頭に残る詰め物の長さはブラウザの読み解き方で変わるので、決まった長さを当てにせず無音の続く長さを数える。
 * 同梱する曲は、ループの頭からこれより大きな音が鳴っている。
 */
const LEADING_PADDING_SILENCE_THRESHOLD = 0.001;
/** 要素の曲の長さが1ループより長いと見なす差（秒）。これより長ければ、要素も先頭の詰め物を流している。 */
const PADDED_DURATION_TOLERANCE_SEC = 0.001;
/**
 * 取得中の曲を、届いた分だけ要素で流し始めるのに要る大きさ（バイト）。128 kbps の曲で約4秒分あり、流している間に残りが届く。
 */
const RECEIVED_PART_MIN_BYTES = 64 * 1024;
/** フェードを終えてから要素を止めるまでの余裕。タイマーが早く来ても、鳴っている要素を止めない。 */
const RELEASE_MARGIN_MS = 100;

let musicOutput: MusicOutput | null = null;
/** 今の画面で流したい曲の音。まだ鳴り始めていないことがある。 */
let currentVoice: MusicVoice | null = null;
const previousVoices = new Set<MusicVoice>();
let wantedUrl: string | null = null;
let wantedGain = 1;
let wantedFadeInSec = FADE_IN_SEC;
/** 画面が見えなくなって止めた曲と、止めたときの1ループの中の位置（秒）。見えるようになったら、ここから流し直す。 */
let resumePosition: { url: string; position: number } | null = null;
let preparedUrls = new Set<string>();
const trackFiles = new Map<string, Blob>();
let fetchingUrl: string | null = null;
let receivedPart: ReceivedPart | null = null;
let trackFileFetchScheduled = false;
const failedUrls = new Set<string>();
const decodedTracks = new Map<string, DecodedTrack>();
const knownTracks = new Map<string, BackgroundMusicTrack>();
let decodingUrl: string | null = null;
/** これから流し始める曲を、この時刻（`performance.now()`）まで流し始めない。 */
let startHeldUntilMs = 0;
let heldStartTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeUserGesture: (() => void) | null = null;
let listening = false;

export function defineBackgroundMusicTrack(
  track: BackgroundMusicTrack,
): BackgroundMusicTrack {
  return track;
}

/** 流しうる曲を渡し、流すときに待たせないよう取得しておく。何度呼んでもよい。 */
export function prepareBackgroundMusic(
  tracks: readonly BackgroundMusicTrack[],
): void {
  if (!canPlayAudio()) {
    return;
  }
  preparedUrls = new Set(tracks.map(({ url }) => url));
  for (const track of tracks) {
    knownTracks.set(track.url, track);
  }
  listenForChanges();
  syncBackgroundMusic();
}

export function playBackgroundMusic(
  track: BackgroundMusicTrack | null,
  {
    gain = 1,
    transition = { kind: "crossfade" },
  }: PlayBackgroundMusicOptions = {},
): void {
  if (!canPlayAudio()) {
    return;
  }
  const url = track?.url ?? null;
  if (url !== wantedUrl) {
    beginTransition(transition);
  }
  wantedUrl = url;
  wantedGain = gain;
  if (track) {
    knownTracks.set(track.url, track);
  }
  listenForChanges();
  syncBackgroundMusic();
}

/** 結果の報酬の音のように、BGM と重ねずに聞かせたい音を鳴らしたときに、その音の長さを渡す。 */
export function holdBackgroundMusicStart(durationMs: number): void {
  startHeldUntilMs = Math.max(startHeldUntilMs, performance.now() + durationMs);
}

function beginTransition(transition: BackgroundMusicTransition) {
  if (transition.kind === "crossfade") {
    wantedFadeInSec = FADE_IN_SEC;
    return;
  }
  wantedFadeInSec = transition.fadeInSec;
  retireCurrentVoice();
  fadeOutPreviousVoices(transition.fadeOutSec);
  holdStartUntilSilence(transition.silenceSec);
}

function holdStartUntilSilence(silenceSec: number) {
  if (!musicOutput) {
    return;
  }
  const fadedAts = [...previousVoices].map(
    ({ fadedAt }) => fadedAt ?? Number.NEGATIVE_INFINITY,
  );
  if (fadedAts.length === 0) {
    return;
  }
  const silentUntil = Math.max(...fadedAts) + silenceSec;
  const heldSec = silentUntil - musicOutput.context.currentTime;
  if (heldSec > 0) {
    holdBackgroundMusicStart(heldSec * 1000);
  }
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
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

function handleVisibilityChange() {
  if (!isPageVisible()) {
    rememberResumePosition();
  }
  syncBackgroundMusic();
}

function isPageVisible(): boolean {
  return document.visibilityState !== "hidden";
}

function getBackgroundMusicGain(): number {
  return getVolumeGain(
    backgroundMusicVolumeSetting.getVolume(),
    BACKGROUND_MUSIC_MAX_GAIN,
  );
}

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
  return getLoadingUrl() !== null && isPageVisible();
}

/** 画面が見えない間も、見えるようになったときに待たせないよう読み込む。 */
function getLoadingUrl(): string | null {
  return isBackgroundMusicEnabled() ? wantedUrl : null;
}

function syncBackgroundMusic() {
  if (!wantsMusic()) {
    retireCurrentVoice();
    fadeOutPreviousVoices();
  } else if (currentVoice?.url !== wantedUrl) {
    switchToWantedTrack(getMusicOutput(getRunningAudioContext()));
  }
  applyWantedGain();
  advanceCurrentVoice();
  forgetUnwantedTracks();
  preloadWantedTrack();
  if (isBackgroundMusicEnabled()) {
    scheduleTrackFileFetch();
    decodeWantedTrack();
  }
  updateUserGestureSubscription();
}

function handleUserGesture(context: AudioContext) {
  if (!wantsMusic()) {
    return;
  }
  if (currentVoice?.url !== wantedUrl) {
    switchToWantedTrack(getMusicOutput(context));
  }
  applyWantedGain();
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

function applyWantedGain() {
  const voice = currentVoice;
  if (
    !voice ||
    !musicOutput ||
    voice.url !== wantedUrl ||
    voice.levelGain === wantedGain
  ) {
    return;
  }
  voice.levelGain = wantedGain;
  const now = musicOutput.context.currentTime;
  const { gain } = voice.level;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(wantedGain, now, LEVEL_CHANGE_TIME_CONSTANT_SEC);
}

function retireCurrentVoice() {
  if (!currentVoice) {
    return;
  }
  // 後の時刻に鳴り始めるよう頼んだだけの曲も、聞こえる前に止め、切り替えた後の画面で鳴らさない。
  if (isAudible(currentVoice)) {
    previousVoices.add(currentVoice);
  } else {
    currentVoice.loop?.source.stop();
    disposeVoice(currentVoice);
  }
  currentVoice = null;
}

function isAudible({ soundingFrom }: MusicVoice): boolean {
  return (
    soundingFrom !== null &&
    musicOutput !== null &&
    soundingFrom <= musicOutput.context.currentTime
  );
}

function takePreviousVoice(url: string): MusicVoice | null {
  for (const voice of previousVoices) {
    if (voice.url === url && voice.fadedAt === null) {
      previousVoices.delete(voice);
      return voice;
    }
  }
  return null;
}

/**
 * 曲を流し始める。読み解いてあればループ再生で、まだなら取得したファイルか、取得中のファイルの届いた分を要素で流す。
 * 届いた分が足りなければ、届くのを待って流し始める。取得できなかった曲は、要素にネットワークから読み込ませて流す。
 * 流し始めを待たせている間は、読み解いてあれば待たせた時刻にループ再生を始め、まだなら待たせた時刻にもう一度試す。
 */
function startVoice(output: MusicOutput, url: string): MusicVoice | null {
  const heldMs = Math.max(0, startHeldUntilMs - performance.now());
  const track = decodedTracks.get(url);
  if (track) {
    const startTime = output.context.currentTime + heldMs / 1000;
    const voice = createVoice(output, url);
    voice.loop = startLoopSource(
      output,
      voice.fader,
      track,
      startTime,
      takeResumePosition(url),
    );
    beginSounding(voice, startTime);
    return voice;
  }
  if (heldMs > 0) {
    syncAfterHeldStart(heldMs);
    return null;
  }
  const file = trackFiles.get(url) ?? null;
  const part = file ? null : getReceivedPart(url);
  if (!file && !part && !failedUrls.has(url)) {
    return null;
  }
  const player = getStreamPlayer(url, file ?? part, { partial: part !== null });
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
  const level = context.createGain();
  level.gain.value = wantedGain;
  fader.connect(level);
  level.connect(volume);
  return {
    url,
    fader,
    level,
    levelGain: wantedGain,
    fadeInSec: wantedFadeInSec,
    soundingFrom: null,
    fadedAt: null,
    stream: null,
    loop: null,
  };
}

/** 読み解いた曲のループする区間の、`position` 秒の位置からループ再生を始める。 */
function startLoopSource(
  { context }: MusicOutput,
  destination: AudioNode,
  track: DecodedTrack,
  startTime: number,
  position: number,
): LoopSource {
  const gain = context.createGain();
  gain.connect(destination);
  const source = context.createBufferSource();
  const { buffer, loopStart, loopDuration } = track;
  source.buffer = buffer;
  source.loop = true;
  if (isPadded(track)) {
    source.loopStart = loopStart;
    source.loopEnd = loopStart + loopDuration;
  }
  source.connect(gain);
  source.start(startTime, loopStart + position);
  return { source, gain, track, startTime, position };
}

function toDecodedTrack(
  buffer: AudioBuffer,
  { loopLength }: BackgroundMusicTrack,
): DecodedTrack {
  const paddingLength = buffer.length - loopLength;
  if (paddingLength <= 0) {
    return { buffer, loopStart: 0, loopDuration: buffer.duration };
  }
  const leadingPaddingLength = countLeadingSilence(buffer, paddingLength);
  return {
    buffer,
    loopStart: leadingPaddingLength / buffer.sampleRate,
    loopDuration: loopLength / buffer.sampleRate,
  };
}

function countLeadingSilence(buffer: AudioBuffer, limit: number): number {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  for (let index = 0; index < limit; index += 1) {
    const isSilent = channels.every(
      (samples) =>
        Math.abs(samples[index] ?? 0) <= LEADING_PADDING_SILENCE_THRESHOLD,
    );
    if (!isSilent) {
      return index;
    }
  }
  return limit;
}

function isPadded({ buffer, loopDuration }: DecodedTrack): boolean {
  return loopDuration < buffer.duration;
}

function beginSounding(voice: MusicVoice, startTime: number) {
  voice.soundingFrom = startTime;
  const { gain } = voice.fader;
  gain.setValueAtTime(0, startTime);
  gain.linearRampToValueAtTime(1, startTime + voice.fadeInSec);
  fadeOutPreviousVoices();
}

function advanceCurrentVoice() {
  const voice = currentVoice;
  if (!voice?.stream || !musicOutput) {
    return;
  }
  if (voice.soundingFrom === null && voice.stream.source.playing) {
    beginSounding(voice, musicOutput.context.currentTime);
  }
  const track = decodedTracks.get(voice.url);
  if (track) {
    handOffToLoop(musicOutput, voice, track);
  }
}

function handOffToLoop(
  output: MusicOutput,
  voice: MusicVoice,
  track: DecodedTrack,
) {
  const { stream } = voice;
  if (!stream) {
    return;
  }
  voice.stream = null;
  const now = output.context.currentTime;
  // まだ鳴っていなければ（要素の読み込みや再生の許可を待っていれば）、頭からループを始める。
  if (voice.soundingFrom === null) {
    disposeStream(stream);
    voice.loop = startLoopSource(output, voice.fader, track, now, 0);
    beginSounding(voice, now);
    return;
  }
  const handoffTime = now + LOOP_HANDOFF_LEAD_SEC;
  const position = getLoopPosition(
    track,
    getStreamPosition(stream.source.element, track) + LOOP_HANDOFF_LEAD_SEC,
  );
  const loop = startLoopSource(
    output,
    voice.fader,
    track,
    handoffTime,
    position,
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

function getStreamPosition(
  element: HTMLAudioElement,
  { loopStart, loopDuration }: DecodedTrack,
): number {
  // 要素の曲の長さが1ループより長ければ、要素も読み解いた曲と同じ先頭の詰め物を流しているので、その分を差し引く。
  const padded =
    element.duration > loopDuration + PADDED_DURATION_TOLERANCE_SEC;
  return element.currentTime - (padded ? loopStart : 0);
}

function getLoopPosition(
  { loopDuration }: DecodedTrack,
  seconds: number,
): number {
  const position = seconds % loopDuration;
  return position < 0 ? position + loopDuration : position;
}

function rememberResumePosition() {
  const voice = currentVoice;
  const loop = voice && voice.soundingFrom !== null ? voice.loop : null;
  if (!voice || !loop || !musicOutput) {
    resumePosition = null;
    return;
  }
  const playedSec = Math.max(
    0,
    musicOutput.context.currentTime - loop.startTime,
  );
  resumePosition = {
    url: voice.url,
    position: getLoopPosition(loop.track, loop.position + playedSec),
  };
}

function takeResumePosition(url: string): number {
  const position = resumePosition?.url === url ? resumePosition.position : 0;
  resumePosition = null;
  return position;
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

function fadeOutPreviousVoices(fadeOutSec = FADE_OUT_SEC) {
  for (const voice of previousVoices) {
    fadeOutVoice(voice, fadeOutSec);
  }
}

function fadeOutVoice(voice: MusicVoice, fadeOutSec: number) {
  if (voice.fadedAt !== null || !musicOutput) {
    return;
  }
  const now = musicOutput.context.currentTime;
  voice.fadedAt = now + fadeOutSec;
  const { gain } = voice.fader;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(0, voice.fadedAt);
  voice.loop?.source.stop(voice.fadedAt);
  setTimeout(
    function disposeFadedVoice() {
      previousVoices.delete(voice);
      disposeVoice(voice);
      syncBackgroundMusic();
    },
    fadeOutSec * 1000 + RELEASE_MARGIN_MS,
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
  voice.level.disconnect();
}

function disposeStream({ source, gain }: VoiceSource<StreamPlayer>) {
  source.source?.disconnect();
  gain.disconnect();
  releaseStreamPlayer(source);
}

/** ループ再生は、フェードアウトの終わりに止めるよう頼んである。 */
function disposeLoop({ source, gain }: LoopSource) {
  source.disconnect();
  gain.disconnect();
}

/** 流したい曲がまだ流れておらず、取得し終えて読み解いている間なら、要素に読み込ませておき、流し始めるときに待たせない。 */
function preloadWantedTrack() {
  const url = getLoadingUrl();
  releaseIdleStreamPlayers(function isWantedStream(playerUrl) {
    return playerUrl === url && !decodedTracks.has(playerUrl);
  });
  if (url === null || currentVoice?.url === url || decodedTracks.has(url)) {
    return;
  }
  const file = trackFiles.get(url);
  if (file) {
    getStreamPlayer(url, file);
  }
}

/**
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
  // 読み込みは一度に1曲ずつにし、今の画面で流す曲の到着を遅らせない。
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
  const playingUrl = getLoadingUrl();
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
  if (!response.body) {
    return response.blob();
  }
  const part: ReceivedPart = {
    url,
    type: response.headers.get("Content-Type") ?? "",
    chunks: [],
    size: 0,
  };
  // 届いた分は、取得し終える前に流し始められるよう `receivedPart` に溜める。
  receivedPart = part;
  try {
    const reader = response.body.getReader();
    for (
      let read = await reader.read();
      !read.done;
      read = await reader.read()
    ) {
      receiveChunk(part, read.value);
    }
  } finally {
    receivedPart = null;
  }
  return new Blob(part.chunks, { type: part.type });
}

function receiveChunk(part: ReceivedPart, chunk: Uint8Array<ArrayBuffer>) {
  const wasEnough = part.size >= RECEIVED_PART_MIN_BYTES;
  part.chunks.push(chunk);
  part.size += chunk.byteLength;
  if (!wasEnough && part.size >= RECEIVED_PART_MIN_BYTES) {
    syncBackgroundMusic();
  }
}

function getReceivedPart(url: string): Blob | null {
  if (
    receivedPart?.url !== url ||
    receivedPart.size < RECEIVED_PART_MIN_BYTES
  ) {
    return null;
  }
  return new Blob(receivedPart.chunks, { type: receivedPart.type });
}

function decodeWantedTrack() {
  const url = getLoadingUrl();
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
      const track = knownTracks.get(url);
      if (track && getLoadingUrl() === url) {
        decodedTracks.set(url, toDecodedTrack(buffer, track));
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

function forgetUnwantedTracks() {
  for (const url of trackFiles.keys()) {
    if (!isWantedTrack(url)) {
      trackFiles.delete(url);
    }
  }
  // 読み解いた曲は1分で 20 MB 以上あるので、流したい曲のほかは持ち続けない。
  for (const url of decodedTracks.keys()) {
    if (url !== getLoadingUrl()) {
      decodedTracks.delete(url);
    }
  }
}

/**
 * 効果音と BGM が共有する、音を出す AudioContext と、全ての音が通る最後の出口と、音声ファイルの読み解き。
 * どちらも同じ AudioContext から鳴らし、音量を掛ける出口（GainNode）はそれぞれが持って `getAudioOutput` につなぐ。
 *
 * ブラウザは利用者が操作するまで音を出させないため、AudioContext は利用者の操作の中で作り動かす。
 * 音を出したい側は `requestAudioContextUnlock` で操作を待ち、動き出したことは `subscribeAudioContextRunning` で受け取る。
 * メディア要素の再生のように操作の中でしか許されないことは、`subscribeUserGesture` で同じ操作の中で行う。
 */

/** 鳴っていない AudioContext を動かせる操作。 */
const UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown"];
/** 音声ファイルを読み解く速さ。同梱する音声ファイルと同じにし、読み解くときに速さを変えない。 */
const DECODING_SAMPLE_RATE = 48000;
/**
 * 全ての音が通る最後の出口の圧縮。効果音が重なったときや音量を上げたときに、音が割れないよう抑える。
 * 初期の音量では一つの効果音にも曲にもほぼ掛からず、最大の音量でも出口のピークを -1 dBFS より下に保つ。
 * 値は DynamicsCompressorNode の単位（dB・比・秒）。
 *
 * DynamicsCompressorNode は仕様どおり、圧縮の設定に応じて通る音すべてを持ち上げる（この設定で約 4.5 dB）。
 * 効果音と BGM の音量は、この持ち上げを含めて決める。
 */
const OUTPUT_LIMITING = {
  threshold: -8,
  knee: 0,
  ratio: 20,
  attack: 0.001,
  release: 0.15,
} as const;

type AudioOutput = {
  context: AudioContext;
  limiter: DynamicsCompressorNode;
};

let audioContext: AudioContext | null = null;
let audioOutput: AudioOutput | null = null;
let decodingContext: OfflineAudioContext | null = null;
let unlockListening = false;
/** AudioContext を動かしたいかを答える関数。どれかが動かしたいと答えたら、次の操作で動かす。 */
const unlockWishes = new Set<() => boolean>();
const runningListeners = new Set<() => void>();
const gestureListeners = new Set<(context: AudioContext) => void>();

/** 音を出せる環境か。Web Audio API が無い環境では、効果音も BGM も何もしない。 */
export function canPlayAudio(): boolean {
  return getAudioContextClass() !== undefined;
}

function getAudioContextClass(): typeof AudioContext | undefined {
  return typeof window === "undefined" ? undefined : window.AudioContext;
}

function getOfflineAudioContextClass(): typeof OfflineAudioContext | undefined {
  return typeof window === "undefined" ? undefined : window.OfflineAudioContext;
}

/**
 * 共有の AudioContext を返す。まだ無ければ作る。利用者の操作の中か、操作に応じて音を鳴らすときに呼ぶ。
 * 操作の前に作ると、ブラウザが止めたままにして警告を出す。
 */
export function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }
  preferAmbientAudioSession();
  audioContext = new AudioContextClass();
  return audioContext;
}

/** 共有の AudioContext が動いていれば返す。作ってはいない、または止まっているなら `null`。 */
export function getRunningAudioContext(): AudioContext | null {
  return audioContext?.state === "running" ? audioContext : null;
}

/**
 * 対応するブラウザで、アプリの音を他のアプリの音楽を止めない音として扱わせる。
 * 端末の消音設定にも従う。
 */
function preferAmbientAudioSession() {
  const audioSession = (
    navigator as Navigator & { audioSession?: { type: string } }
  ).audioSession;
  if (audioSession) {
    audioSession.type = "ambient";
  }
}

/** `context` の全ての音が通る最後の出口。効果音と BGM の出口をここへつなぐ。 */
export function getAudioOutput(context: AudioContext): AudioNode {
  if (audioOutput?.context === context) {
    return audioOutput.limiter;
  }
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = OUTPUT_LIMITING.threshold;
  limiter.knee.value = OUTPUT_LIMITING.knee;
  limiter.ratio.value = OUTPUT_LIMITING.ratio;
  limiter.attack.value = OUTPUT_LIMITING.attack;
  limiter.release.value = OUTPUT_LIMITING.release;
  limiter.connect(context.destination);
  audioOutput = { context, limiter };
  return limiter;
}

/** 止まっている AudioContext を動かす。動き出したら `subscribeAudioContextRunning` の購読者へ知らせる。 */
export function resumeAudioContext(context: AudioContext): void {
  if (context.state === "running") {
    notifyRunning();
    return;
  }
  context.resume().then(notifyRunning, function ignoreRejectedResume() {});
}

/** 共有の AudioContext が動き出したら `onRunning` を呼ぶ。購読をやめる関数を返す。 */
export function subscribeAudioContextRunning(
  onRunning: () => void,
): () => void {
  runningListeners.add(onRunning);
  return function unsubscribe() {
    runningListeners.delete(onRunning);
  };
}

function notifyRunning() {
  for (const listener of runningListeners) {
    listener();
  }
}

/**
 * 利用者の次の操作で、共有の AudioContext を作って動かすよう頼む。何度呼んでもよい。
 * 操作のときに `wantsAudio` が偽を返せば、その操作では作らない（鳴らさない設定の間に AudioContext を作らないため）。
 * 利用者の操作の中で呼んだときは、次の操作を待たずにその場で動かす。
 */
export function requestAudioContextUnlock(wantsAudio: () => boolean): void {
  if (!getAudioContextClass()) {
    return;
  }
  unlockWishes.add(wantsAudio);
  if (getRunningAudioContext()) {
    return;
  }
  if (isHandlingUserGesture()) {
    unlockOnUserGesture();
    return;
  }
  listenForUnlock();
}

function isHandlingUserGesture(): boolean {
  return navigator.userActivation?.isActive ?? false;
}

/**
 * AudioContext を動かす利用者の操作の中で、AudioContext を動かし始めてから `onGesture` を呼ぶ。購読をやめる関数を返す。
 * 渡す AudioContext は、まだ動き出していないことがある。
 * AudioContext を動かしたい（`requestAudioContextUnlock` に渡した関数が真を返す）ものが無い操作では呼ばない。
 */
export function subscribeUserGesture(
  onGesture: (context: AudioContext) => void,
): () => void {
  if (!getAudioContextClass()) {
    return function unsubscribe() {};
  }
  gestureListeners.add(onGesture);
  listenForUnlock();
  return function unsubscribe() {
    gestureListeners.delete(onGesture);
    if (getRunningAudioContext() && gestureListeners.size === 0) {
      stopListeningForUnlock();
    }
  };
}

function unlockOnUserGesture() {
  if (!wantsUnlock()) {
    return;
  }
  const context = getAudioContext();
  if (!context) {
    stopListeningForUnlock();
    return;
  }
  resumeAudioContext(context);
  for (const onGesture of gestureListeners) {
    onGesture(context);
  }
  if (context.state === "running" && gestureListeners.size === 0) {
    stopListeningForUnlock();
  }
}

function wantsUnlock(): boolean {
  for (const wantsAudio of unlockWishes) {
    if (wantsAudio()) {
      return true;
    }
  }
  return false;
}

function listenForUnlock() {
  if (unlockListening) {
    return;
  }
  unlockListening = true;
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlockOnUserGesture, true);
  }
}

function stopListeningForUnlock() {
  for (const type of UNLOCK_EVENTS) {
    window.removeEventListener(type, unlockOnUserGesture, true);
  }
  unlockListening = false;
}

/**
 * 音声ファイルを取得して読み解く。読み解けない環境では `null` を返す。
 * 音を出す AudioContext は利用者が操作するまで作れないので、音を出さない AudioContext で先に読み解いておく。
 */
export function decodeAudioFile(url: string): Promise<AudioBuffer> | null {
  const context = getDecodingContext();
  return context ? fetchAndDecode(context, url) : null;
}

/** 取得済みの音声ファイルを読み解く。読み解けない環境では `null` を返す。 */
export function decodeAudioBlob(file: Blob): Promise<AudioBuffer> | null {
  const context = getDecodingContext();
  return context ? decodeBlob(context, file) : null;
}

async function fetchAndDecode(
  context: BaseAudioContext,
  url: string,
): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return context.decodeAudioData(await response.arrayBuffer());
}

async function decodeBlob(
  context: BaseAudioContext,
  file: Blob,
): Promise<AudioBuffer> {
  return context.decodeAudioData(await file.arrayBuffer());
}

function getDecodingContext(): OfflineAudioContext | null {
  if (decodingContext) {
    return decodingContext;
  }
  const OfflineAudioContextClass = getOfflineAudioContextClass();
  if (!OfflineAudioContextClass) {
    return null;
  }
  decodingContext = new OfflineAudioContextClass(1, 1, DECODING_SAMPLE_RATE);
  return decodingContext;
}

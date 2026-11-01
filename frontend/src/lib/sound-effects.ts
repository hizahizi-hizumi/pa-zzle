/**
 * 同梱した音声ファイルを、効果音として Web Audio API で鳴らす。
 * どんな音かは音声ファイルが持ち、いつ・どう鳴らすか（遅らせる、重ねる、揺らす）はコードが持つ。
 * AudioContext は BGM と共有し（`@/lib/audio-context`）、Web Audio API が無い環境と、鳴らさない設定では何もしない。
 *
 * 音声ファイルは Vite のアセット import で URL として受け取り、`defineSoundEffect` に渡して効果音にする。
 * その効果音を鳴らしうる画面を出したときに `prepareSoundEffects` で読み込みを始め、
 * 鳴らすときは `playSound`、素材を時間をずらして重ねるときは `playLayeredSound` を使う。
 * 効果音は音声ファイルの URL で見分けるので、同じ URL から作った効果音は同じ音として読み込み・鳴らす。
 * 回数の多い操作の音には `variation: REPEATED_SOUND_VARIATION` を渡し、同じ音の機械的な繰り返しにしない。
 * プレイ画面の操作やクリアに合わせて鳴らすときは、`@/games/play-sound-effects` のフックを使う。
 */

import {
  canPlayAudio,
  decodeAudioFile,
  getAudioContext,
  requestAudioContextUnlock,
  resumeAudioContext,
} from "@/lib/audio-context";
import {
  isSoundEffectsEnabled,
  subscribeSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

/** 同梱した音声ファイル1つ分の効果音。 */
export type SoundEffect = {
  readonly url: string;
};

/** 素材を重ねて一つの効果音にするときの1枚。 */
export type SoundLayer = {
  sound: SoundEffect;
  /** 効果音を鳴らし始めてから、この素材が鳴り始めるまでの時間。 */
  offsetMs: number;
};

/** 鳴らすたびに音を揺らす幅。揺らす量は鳴らすたびに幅の中から選び、一つの効果音の中の素材すべてに同じだけ掛ける。 */
export type SoundVariation = {
  /** 音程を上下に揺らす幅（セント。100 セントで半音）。再生の速さで揺らすので、長さもわずかに変わる。 */
  pitchCents: number;
  /** 音量を揺らす割合。0.1 なら 0.9〜1.1 倍。 */
  volumeRatio: number;
};

/** 回数の多い操作の音に使う、聞き分けられないほど小さな揺らぎ。 */
export const REPEATED_SOUND_VARIATION: SoundVariation = {
  pitchCents: 30,
  volumeRatio: 0.12,
};

type PlaySoundOptions = {
  /** 呼んでから鳴らし始めるまでの時間。 */
  delayMs?: number;
  /** 鳴らすたびに音程と音量をわずかに揺らす。省略すると毎回同じ音で鳴らす。 */
  variation?: SoundVariation;
};

type SoundOutput = {
  context: AudioContext;
  /** 全ての音が通る出口。鳴らさない設定に切り替えたら、鳴っている音もここで消す。 */
  master: GainNode;
};

/** 鳴らさない設定に切り替えたとき、鳴っている音を消す速さ。急に切って音が割れないよう、わずかに時間を掛ける。 */
const MUTE_TIME_CONSTANT_SEC = 0.02;
/**
 * 速い連打で音が重なったときだけ効く、出口の圧縮。一つの効果音の大きさ（ピークが 0.2 程度まで）には掛からないようにする。
 * 値は DynamicsCompressorNode の単位（dB・比・秒）。
 */
const OUTPUT_COMPRESSION = {
  threshold: -10,
  knee: 6,
  ratio: 4,
  attack: 0.003,
  release: 0.15,
} as const;

let soundOutput: SoundOutput | null = null;
/** 読み込みを頼まれた音声ファイルの URL。読み込み中と読み込み済みを含み、読み込みに失敗したら外して読み直せるようにする。 */
const requestedSoundUrls = new Set<string>();
const soundBuffers = new Map<string, AudioBuffer>();
/** 鳴らさない設定の間に読み込みを頼まれた音声ファイルの URL。鳴らす設定に変わったら読み込む。 */
const soundUrlsWaitingForEnabled = new Set<string>();
let waitingForEnabled = false;

/** 音声ファイルの URL から効果音を作る。読み込みは `prepareSoundEffects` で始める。 */
export function defineSoundEffect(url: string): SoundEffect {
  return { url };
}

/**
 * 効果音を鳴らしうる画面を出したときに、その画面で鳴らす効果音を渡して呼ぶ。何度呼んでもよい。
 *
 * - 渡した効果音の読み込みを始め、鳴らすときに待たせないようにする。読み込み中と読み込み済みの効果音は読み直さない。
 *   鳴らさない設定の間は読み込まず、鳴らす設定に変わったときに読み込む。
 * - 読み込みに失敗した効果音は、次に読み込みを頼まれたとき（この関数か、鳴らそうとしたとき）に読み直す。
 *   効果音は操作に添えるものなので、失敗を利用者に知らせず、遊ぶのを妨げない。
 * - ブラウザは利用者が操作するまで音を出させないため、次の操作で AudioContext を作り動かせるよう待つ。
 */
export function prepareSoundEffects(sounds: readonly SoundEffect[]): void {
  if (!canPlayAudio()) {
    return;
  }
  requestSoundEffects(sounds);
  requestAudioContextUnlock(isSoundEffectsEnabled);
}

function requestSoundEffects(sounds: readonly SoundEffect[]) {
  for (const { url } of sounds) {
    if (requestedSoundUrls.has(url)) {
      continue;
    }
    requestedSoundUrls.add(url);
    if (isSoundEffectsEnabled()) {
      loadSoundEffect(url);
    } else {
      waitForEnabledToLoad(url);
    }
  }
}

function waitForEnabledToLoad(url: string) {
  soundUrlsWaitingForEnabled.add(url);
  if (waitingForEnabled) {
    return;
  }
  waitingForEnabled = true;
  const unsubscribe = subscribeSoundEffectsEnabled(
    function loadWaitingSoundsWhenEnabled() {
      if (!isSoundEffectsEnabled()) {
        return;
      }
      unsubscribe();
      waitingForEnabled = false;
      for (const waitingUrl of soundUrlsWaitingForEnabled) {
        loadSoundEffect(waitingUrl);
      }
      soundUrlsWaitingForEnabled.clear();
    },
  );
}

function loadSoundEffect(url: string) {
  decodeAudioFile(url)?.then(
    function keepDecodedSound(buffer) {
      soundBuffers.set(url, buffer);
    },
    function forgetFailedRequest(error: unknown) {
      requestedSoundUrls.delete(url);
      if (import.meta.env.DEV) {
        console.warn(`効果音を読み込めない: ${url}`, error);
      }
    },
  );
}

function getSoundOutput(): SoundOutput | null {
  if (soundOutput) {
    return soundOutput;
  }
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = OUTPUT_COMPRESSION.threshold;
  compressor.knee.value = OUTPUT_COMPRESSION.knee;
  compressor.ratio.value = OUTPUT_COMPRESSION.ratio;
  compressor.attack.value = OUTPUT_COMPRESSION.attack;
  compressor.release.value = OUTPUT_COMPRESSION.release;
  master.connect(compressor);
  compressor.connect(context.destination);

  soundOutput = { context, master };
  subscribeSoundEffectsEnabled(applySoundEffectsEnabled);
  return soundOutput;
}

/** 鳴らさない設定に切り替えたら鳴っている音も出口で消し、鳴らす設定に戻したら出口を開ける。 */
function applySoundEffectsEnabled() {
  if (!soundOutput) {
    return;
  }
  const { context, master } = soundOutput;
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  if (isSoundEffectsEnabled()) {
    master.gain.setValueAtTime(1, now);
  } else {
    master.gain.setTargetAtTime(0, now, MUTE_TIME_CONSTANT_SEC);
  }
}

/**
 * 効果音を鳴らす。鳴らせない環境と、鳴らさない設定では何もしない。鳴らさない設定の間は AudioContext も作らない。
 *
 * まだ読み込めていない効果音は鳴らさない。読み込みを待ってから鳴らすと、操作や演出とずれた時に鳴るため待たない。
 * 読み込みを頼まれていない効果音と読み込みに失敗した効果音は、ここで読み込みを始め、次に鳴らすときから鳴らす。
 *
 * 鳴らしたときは、呼んでから鳴り終わるまでの時間（ms）を返す。鳴らさなかったときは `null` を返す。
 * 鳴り終わるのを待って次の音（BGM など）を始めるときに使う。
 */
export function playSound(
  sound: SoundEffect,
  options?: PlaySoundOptions,
): number | null {
  return playLayeredSound([{ sound, offsetMs: 0 }], options);
}

/**
 * 素材を時間をずらして重ね、一つの効果音として鳴らす。揺らぎは素材すべてに同じだけ掛ける。
 * 素材が一つでも読み込めていなければ、何も鳴らさない。それ以外は `playSound` と同じ。
 */
export function playLayeredSound(
  layers: readonly SoundLayer[],
  { delayMs = 0, variation }: PlaySoundOptions = {},
): number | null {
  if (!isSoundEffectsEnabled() || layers.length === 0) {
    return null;
  }
  const output = getSoundOutput();
  if (!output) {
    return null;
  }
  resumeAudioContext(output.context);
  requestSoundEffects(layers.map(({ sound }) => sound));

  const loadedLayers = getLoadedLayers(layers);
  if (!loadedLayers) {
    return null;
  }
  const startTime = output.context.currentTime + delayMs / 1000;
  const scale = variation ? pickVariationScale(variation) : NO_VARIATION_SCALE;
  scheduleLayers(output, loadedLayers, startTime, scale);
  return delayMs + getLayersDurationMs(loadedLayers, scale);
}

type LoadedLayer = {
  buffer: AudioBuffer;
  offsetMs: number;
};

/** 素材すべてを読み込めていれば、その音のデータを添えて返す。 */
function getLoadedLayers(layers: readonly SoundLayer[]): LoadedLayer[] | null {
  const loadedLayers: LoadedLayer[] = [];
  for (const { sound, offsetMs } of layers) {
    const buffer = soundBuffers.get(sound.url);
    if (!buffer) {
      return null;
    }
    loadedLayers.push({ buffer, offsetMs });
  }
  return loadedLayers;
}

/** 重ねた素材すべてが鳴り終わるまでの時間。速さを揺らした分も含める。 */
function getLayersDurationMs(
  layers: readonly LoadedLayer[],
  { playbackRate }: VariationScale,
): number {
  return Math.max(
    ...layers.map(
      ({ buffer, offsetMs }) =>
        offsetMs + (buffer.duration * 1000) / playbackRate,
    ),
  );
}

type VariationScale = {
  playbackRate: number;
  volume: number;
};

const NO_VARIATION_SCALE: VariationScale = { playbackRate: 1, volume: 1 };

function pickVariationScale({
  pitchCents,
  volumeRatio,
}: SoundVariation): VariationScale {
  const cents = pitchCents * pickSignedUnit();
  return {
    playbackRate: 2 ** (cents / 1200),
    volume: 1 + volumeRatio * pickSignedUnit(),
  };
}

/** -1 以上 1 未満の一様な乱数。 */
function pickSignedUnit(): number {
  return Math.random() * 2 - 1;
}

function scheduleLayers(
  { context, master }: SoundOutput,
  layers: readonly LoadedLayer[],
  soundStartTime: number,
  scale: VariationScale,
) {
  const volume = context.createGain();
  volume.gain.value = scale.volume;
  volume.connect(master);

  let playingLayerCount = layers.length;
  for (const { buffer, offsetMs } of layers) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = scale.playbackRate;
    source.connect(volume);
    source.addEventListener("ended", function disconnect() {
      source.disconnect();
      playingLayerCount -= 1;
      if (playingLayerCount === 0) {
        volume.disconnect();
      }
    });
    source.start(soundStartTime + offsetMs / 1000);
  }
}

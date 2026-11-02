/**
 * 同梱した音声ファイルを、効果音として Web Audio API で鳴らす。
 * どんな音かは音声ファイルが持ち、いつ・どう鳴らすか（遅らせる、重ねる、揺らす）はコードが持つ。
 * AudioContext は BGM と共有し（`@/lib/audio-context`）、Web Audio API が無い環境と、音量が 0 の設定では何もしない。
 * 音量は `@/lib/sound-effects-setting` の設定に従い、鳴っている音も音量を変えるとすぐに変わる。
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
  getAudioOutput,
  requestAudioContextUnlock,
  resumeAudioContext,
} from "@/lib/audio-context";
import {
  isSoundEffectsEnabled,
  soundEffectsVolumeSetting,
} from "@/lib/sound-effects-setting";
import { getVolumeGain } from "@/lib/stored-volume-setting";

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
  /** 全ての効果音が通る出口。音量はここで掛け、鳴っている音の音量もここで変える。 */
  master: GainNode;
};

/**
 * 音量が最大のときに出口で掛ける大きさ。初期の音量では約 0.54 倍（-5.4 dB）になり、
 * 最後の出口の持ち上げ（`@/lib/audio-context`）と合わせて音声ファイルとほぼ同じ大きさで鳴らす。
 * BGM（`@/lib/background-music`）とは初期の音量どうしで約 20 dB 差になり、遊ぶゲームを選ぶ・プレイを始める音は、
 * ホームの曲が大きい箇所でも、その音が鳴る帯域で曲より 10 dB 以上大きく聞こえる。
 * 音量が最大のときは大きい効果音に最後の出口の圧縮が掛かり、音が割れないようにする。
 */
const SOUND_EFFECTS_MAX_GAIN = 2.16;
/** 音量を変えたとき、出口の大きさが新しい音量に近づく速さ。急に変えて音にノイズが乗らないよう、わずかに時間を掛ける。 */
const VOLUME_CHANGE_TIME_CONSTANT_SEC = 0.02;

let soundOutput: SoundOutput | null = null;
/** 読み込みを頼まれた音声ファイルの URL。読み込み中と読み込み済みを含み、読み込みに失敗したら外して読み直せるようにする。 */
const requestedSoundUrls = new Set<string>();
const soundBuffers = new Map<string, AudioBuffer>();
/** 音量が 0 の間に読み込みを頼まれた音声ファイルの URL。音量を 0 より大きくしたら読み込む。 */
const soundUrlsWaitingForEnabled = new Set<string>();
let waitingForEnabled = false;

function getSoundEffectsGain(): number {
  return getVolumeGain(
    soundEffectsVolumeSetting.getVolume(),
    SOUND_EFFECTS_MAX_GAIN,
  );
}

/** 音声ファイルの URL から効果音を作る。読み込みは `prepareSoundEffects` で始める。 */
export function defineSoundEffect(url: string): SoundEffect {
  return { url };
}

/**
 * 効果音を鳴らしうる画面を出したときに、その画面で鳴らす効果音を渡して呼ぶ。何度呼んでもよい。
 *
 * - 渡した効果音の読み込みを始め、鳴らすときに待たせないようにする。読み込み中と読み込み済みの効果音は読み直さない。
 *   音量が 0 の間は読み込まず、音量を 0 より大きくしたときに読み込む。
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
  const unsubscribe = soundEffectsVolumeSetting.subscribe(
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
  master.gain.value = getSoundEffectsGain();
  master.connect(getAudioOutput(context));

  soundOutput = { context, master };
  soundEffectsVolumeSetting.subscribe(applySoundEffectsVolume);
  return soundOutput;
}

/** 音量を変えたら、鳴っている音も含めて出口の大きさを変える。 */
function applySoundEffectsVolume() {
  if (!soundOutput) {
    return;
  }
  const { context, master } = soundOutput;
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(
    getSoundEffectsGain(),
    now,
    VOLUME_CHANGE_TIME_CONSTANT_SEC,
  );
}

/**
 * 効果音を鳴らす。鳴らせない環境と、音量が 0 の設定では何もしない。音量が 0 の間は AudioContext も作らない。
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

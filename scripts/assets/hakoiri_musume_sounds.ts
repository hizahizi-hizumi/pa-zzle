/**
 * 箱入り娘の効果音（frontend/src/games/hakoiri-musume/assets/sounds/*.flac）を、VCSL の録音を Chromium の
 * OfflineAudioContext で加工して書き出す。
 *
 * 素材は sgossner/VCSL（CC0 1.0）のコミット c1ea7bcc の、ギロ（木のこすり）・ウッドブロック・カホン（木の箱の胴）の録音。
 * 出典と加工の手順は、書き出し先の `VCSL.CC0.txt` にある。録音はリポジトリに同梱しないので、次のように取り出して、
 * そのディレクトリを渡す。ffmpeg（6.1）と、playwright の Chromium が要る。
 *
 *     git clone --filter=blob:none --no-checkout https://github.com/sgossner/VCSL.git vcsl
 *     git -C vcsl checkout c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e -- \
 *         "Idiophones/Struck Idiophones/Guiro" "Idiophones/Struck Idiophones/Woodblock" \
 *         "Idiophones/Struck Idiophones/Cajon"
 *     bun scripts/assets/hakoiri_musume_sounds.ts --vcsl vcsl
 *
 * 録音は SHA-256 で確かめ、食い違えば書き出さずに止める。乱数は使わない。
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const REPOSITORY = path.resolve(import.meta.dir, "../..");
const SOUND_DIRECTORY = path.join(
  REPOSITORY,
  "frontend/src/games/hakoiri-musume/assets/sounds",
);
const SAMPLE_RATE = 48_000;

/** 使う録音の、VCSL の中の場所と SHA-256。 */
const RECORDINGS = {
  guiroShort: [
    "Guiro/Legacy/guiro_short.wav",
    "2f113b444deed8c4044fcf14f0b26ea786c8a91f8e84a41e0799b0d164e6b355",
  ],
  guiroShort3: [
    "Guiro/Legacy/guiro_short3.wav",
    "3fdc7ee3cdb7087b9e05f41dd4ea67994b995dc0920430949c3fb19f07800f63",
  ],
  guiroShort5: [
    "Guiro/Legacy/guiro_short5.wav",
    "181028f9ab7d1fe99a40dfe4d89f68e5c0a1d4fb70f4cb2c69a084e4a030e804",
  ],
  guiroMedium: [
    "Guiro/Guiro_Med_rr1_Mid.wav",
    "b32a7fd5b8a9971ebe85313df3e7be72134c2c1eaf243d21a28dc48b77deb44c",
  ],
  woodClickQuiet1: [
    "Woodblock/wood_click_pp_rr1.wav",
    "2c21a5de6f3ddd51ce851325ba6caa4a187422c51299da7b2fdc4f51ae5e9ee1",
  ],
  woodClickQuiet2: [
    "Woodblock/wood_click_pp_rr2.wav",
    "94db112d562381852c6f7356a85090db25980ec6c9f1dbda0615bafac0fad7db",
  ],
  woodClickQuiet3: [
    "Woodblock/wood_click_pp_rr3.wav",
    "ecd77e89be7f5ba0b875825ee61902f54736014e3892248299af6b70fff5feb1",
  ],
  woodClick: [
    "Woodblock/wood_click_mp.wav",
    "00b76f9fe96c118f29dfc69866c12ec11f2e1264f6cb9c0b36912c2210b015fe",
  ],
  woodClickStrong: [
    "Woodblock/wood_click_f_rr1.wav",
    "86b690a393ad62d65dc6832948adb0cc164fe22f544a8065809f000c65d615fc",
  ],
  cajonLow: [
    "Cajon/Cajon_hit1_mp_rr1.wav",
    "4103c4a847a8cc8860b9449ef26619b56825e972f1bfa0427bdd3f5e36ca81aa",
  ],
  cajon: [
    "Cajon/Cajon_hit2_mp_rr1.wav",
    "aa8836ba7ff3f79a4e6ce82b8a42e0c17321fd44300403a05a47012a5173bfc9",
  ],
} as const satisfies Record<string, readonly [string, string]>;

type RecordingName = keyof typeof RECORDINGS;

type Filter = {
  type: "highpass" | "lowpass" | "peaking" | "lowshelf" | "highshelf";
  frequency: number;
  q?: number;
  gainDb?: number;
};

/**
 * 1つの音に重ねる録音の1枚。録音の `offsetMs` から `lengthMs`（録音の時間）を、`speed` 倍の速さで、
 * 書き出す音の `atMs` から鳴らす。`fadeInMs`・`fadeOutMs` は書き出す音の時間で、端を直線で閉じる。
 */
type Layer = {
  recording: RecordingName;
  offsetMs: number;
  lengthMs: number;
  speed: number;
  atMs: number;
  gainDb: number;
  fadeInMs: number;
  fadeOutMs: number;
  filters: readonly Filter[];
};

/**
 * 書き出す前の仕上げ。`loudness` は 400ms 窓の最大ラウドネス（LUFS）。`floorDb` はピークからこれだけ下がった所で切り、
 * `fadeMs` で閉じる。
 */
type Finish = { loudness: number; floorDb: number; fadeMs: number };

type SoundDefinition = { layers: readonly Layer[]; finish: Finish };

/**
 * 木の板の上を木の駒が1マスすべる「こつ」。ウッドブロックの打音を頭に置き、ギロのこすりを短く小さく添える。
 * 速くなぞって続けて鳴っても1マスずつ聞き分けられるよう、立ち上がりを鋭く、全体を短くする。
 * テイクごとに打音の速さを変えて、高さを半音ほどずつずらし、同じ高さの音が続かないようにする。
 */
function slideSound(
  scrape: RecordingName,
  scrapeOffsetMs: number,
  click: RecordingName,
  clickSpeed: number,
): SoundDefinition {
  return {
    layers: [
      {
        recording: click,
        // 弱く打った録音は打ってから山まで約 10ms かけて立ち上がるので、山の直前から鳴らして、こつの頭を鋭くする。
        offsetMs: 9,
        lengthMs: 26,
        speed: clickSpeed,
        atMs: 0,
        gainDb: 0,
        fadeInMs: 0.5,
        fadeOutMs: 22,
        filters: [
          { type: "highpass", frequency: 180 },
          { type: "lowpass", frequency: 1800 },
        ],
      },
      {
        recording: scrape,
        offsetMs: scrapeOffsetMs,
        lengthMs: 29,
        speed: 0.72,
        atMs: 1,
        gainDb: -6,
        fadeInMs: 2,
        fadeOutMs: 18,
        filters: [
          { type: "highpass", frequency: 260 },
          { type: "lowpass", frequency: 2400 },
          { type: "peaking", frequency: 700, q: 1.1, gainDb: -2 },
        ],
      },
    ],
    finish: { loudness: -46.75, floorDb: -50, fadeMs: 12 },
  };
}

/** 娘が出口の縁をこする音に掛けるフィルタ。 */
const daughterScrapeFilters: readonly Filter[] = [
  { type: "highpass", frequency: 200 },
  { type: "lowpass", frequency: 1800 },
  { type: "peaking", frequency: 600, q: 1.0, gainDb: 3 },
];

const SOUNDS: Record<string, SoundDefinition> = {
  "piece-slid": slideSound("guiroShort5", 30, "woodClickQuiet1", 0.531),
  "piece-slid-2": slideSound("guiroShort3", 130, "woodClickQuiet2", 0.562),
  "piece-slid-3": slideSound("guiroShort", 40, "woodClickQuiet3", 0.589),
  /**
   * 娘が出口の縁をこすって箱から抜けていく、長いこすれ。動き出しに縁へ当たる小さなこつを置き、こすりは鳴っている途中から
   * 始めて、前半からスマホでも聞こえる大きさにする。抜けていく動きと同じ長さで鳴らし、抜け切る間際へ向けて
   * 速いこすりへ替えながら大きく・高くして、落ちるごとんへ途切れずにつなぐ。ごとんより 8dB ほど小さくする。
   */
  "cleared-slide": {
    layers: [
      {
        recording: "woodClickQuiet1",
        offsetMs: 9,
        lengthMs: 26,
        speed: 0.45,
        atMs: 0,
        gainDb: -4,
        fadeInMs: 0.5,
        fadeOutMs: 30,
        filters: [
          { type: "highpass", frequency: 180 },
          { type: "lowpass", frequency: 1800 },
        ],
      },
      {
        recording: "guiroMedium",
        offsetMs: 120,
        lengthMs: 400,
        speed: 0.62,
        atMs: 4,
        gainDb: 0,
        fadeInMs: 30,
        fadeOutMs: 220,
        filters: daughterScrapeFilters,
      },
      {
        recording: "guiroMedium",
        offsetMs: 200,
        lengthMs: 220,
        speed: 0.8,
        atMs: 400,
        gainDb: 2,
        fadeInMs: 200,
        fadeOutMs: 25,
        filters: daughterScrapeFilters,
      },
    ],
    finish: { loudness: -42.5, floorDb: -50, fadeMs: 20 },
  },
  /**
   * 抜けた娘が箱の外へ落ちるごとんと、木の箱の胴鳴り。胴鳴りの低い音はスマホのスピーカーでは鳴りにくいので、
   * 200Hz〜2kHz の木の打音と胴の倍音を重ねて、小さなスピーカーでも重さが伝わるようにする。強く打ったウッドブロックを
   * 0.3 倍の速さで鳴らした低い音程の打音（約 360Hz）を、約 0.2 秒の胴鳴りとして重ね、駒のすべる音（740〜830Hz）より
   * 低い高さで聞かせる。
   */
  "cleared-thud": {
    layers: [
      {
        recording: "woodClick",
        offsetMs: 0,
        lengthMs: 60,
        speed: 0.5,
        atMs: 0,
        gainDb: -2,
        fadeInMs: 0.5,
        fadeOutMs: 60,
        filters: [
          { type: "highpass", frequency: 200 },
          { type: "lowpass", frequency: 2000 },
        ],
      },
      {
        recording: "woodClickStrong",
        offsetMs: 0,
        lengthMs: 75,
        speed: 0.3,
        atMs: 0,
        gainDb: -3,
        fadeInMs: 0.5,
        fadeOutMs: 200,
        filters: [
          { type: "highpass", frequency: 180 },
          { type: "lowpass", frequency: 600 },
        ],
      },
      {
        recording: "cajonLow",
        offsetMs: 0,
        lengthMs: 420,
        speed: 0.8,
        atMs: 1,
        gainDb: 0,
        fadeInMs: 0.5,
        fadeOutMs: 260,
        filters: [
          { type: "highpass", frequency: 70 },
          { type: "lowpass", frequency: 1100 },
          { type: "lowshelf", frequency: 220, gainDb: 3 },
        ],
      },
      {
        recording: "cajon",
        offsetMs: 0,
        lengthMs: 320,
        speed: 0.66,
        atMs: 2,
        gainDb: -3,
        fadeInMs: 4,
        fadeOutMs: 240,
        filters: [
          { type: "highpass", frequency: 200 },
          { type: "lowpass", frequency: 1600 },
        ],
      },
    ],
    finish: { loudness: -34.5, floorDb: -54, fadeMs: 120 },
  },
};

// playwright はリポジトリの依存に無く、環境の全体インストール（NODE_PATH や /opt/node*/lib/node_modules）から読む。
function loadPlaywright(): typeof import("playwright") {
  const directories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [
    import.meta.url,
    ...directories.map((directory) => path.join(directory, "_")),
  ]) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  throw new Error(
    "playwright が見つからない。NODE_PATH に playwright のある node_modules を指定する",
  );
}

function run(command: string[]): Uint8Array {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${command[0]} が失敗した: ${result.stderr.toString()}`);
  }
  return result.stdout;
}

function samples(ms: number): number {
  return Math.floor((ms / 1000) * SAMPLE_RATE);
}

/** 録音を 48kHz のモノラルにし、ピークから -30dB を超える最初の点の 0.6ms 前から始まる、ピークが 1 の音として読む。 */
function readRecording(vcsl: string, name: RecordingName): number[] {
  const [location, digest] = RECORDINGS[name];
  const file = path.join(vcsl, "Idiophones/Struck Idiophones", location);
  const bytes = readFileSync(file);
  if (createHash("sha256").update(bytes).digest("hex") !== digest) {
    throw new Error(`録音が VCSL c1ea7bcc のものと違う: ${file}`);
  }
  const decoded = run([
    "ffmpeg",
    "-nostdin",
    "-v",
    "error",
    "-i",
    file,
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "f32le",
    "-",
  ]);
  const signal = Array.from(
    new Float32Array(
      decoded.buffer,
      decoded.byteOffset,
      decoded.byteLength / 4,
    ),
  );
  const peak = Math.max(...signal.map(Math.abs));
  const onset = signal.findIndex(
    (value) => Math.abs(value) > peak * 10 ** (-30 / 20),
  );
  return signal
    .slice(Math.max(0, onset - samples(0.6)))
    .map((value) => value / peak);
}

/** 重ねる録音と加工の定義を、Chromium の OfflineAudioContext で描く。ブラウザーの中で動く。 */
async function renderInBrowser({
  definitions,
  recordings,
  sampleRate,
}: {
  definitions: Record<string, SoundDefinition>;
  recordings: Record<string, number[]>;
  sampleRate: number;
}): Promise<Record<string, number[]>> {
  const rendered: Record<string, number[]> = {};
  for (const [name, { layers }] of Object.entries(definitions)) {
    const endSec = Math.max(
      ...layers.map(
        (layer) => (layer.atMs + layer.lengthMs / layer.speed) / 1000,
      ),
    );
    const context = new OfflineAudioContext(
      1,
      Math.ceil((endSec + 0.01) * sampleRate),
      sampleRate,
    );
    for (const layer of layers) {
      const data = recordings[layer.recording]!;
      const buffer = context.createBuffer(1, data.length, sampleRate);
      buffer.copyToChannel(Float32Array.from(data), 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = layer.speed;
      let tail: AudioNode = source;
      for (const filter of layer.filters) {
        const node = context.createBiquadFilter();
        node.type = filter.type;
        node.frequency.value = filter.frequency;
        if (filter.q !== undefined) node.Q.value = filter.q;
        if (filter.gainDb !== undefined) node.gain.value = filter.gainDb;
        tail.connect(node);
        tail = node;
      }
      const envelope = context.createGain();
      const start = layer.atMs / 1000;
      const end = start + layer.lengthMs / layer.speed / 1000;
      const level = 10 ** (layer.gainDb / 20);
      envelope.gain.setValueAtTime(0, 0);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(
        level,
        start + layer.fadeInMs / 1000,
      );
      envelope.gain.setValueAtTime(level, end - layer.fadeOutMs / 1000);
      envelope.gain.linearRampToValueAtTime(0, end);
      tail.connect(envelope);
      envelope.connect(context.destination);
      source.start(start, layer.offsetMs / 1000);
      source.stop(end);
    }
    const output = await context.startRendering();
    rendered[name] = Array.from(output.getChannelData(0));
  }
  return rendered;
}

type Biquad = { b: [number, number, number]; a: [number, number, number] };

function applyBiquad(signal: readonly number[], { b, a }: Biquad): number[] {
  const output = new Array<number>(signal.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < signal.length; index += 1) {
    const x = signal[index]!;
    const y = (b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
    output[index] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return output;
}

/** ITU-R BS.1770 の K 特性（1.5kHz の高域の棚 +4dB と 38Hz の高域通過）。係数は RBJ の式で求める。 */
function kWeight(signal: readonly number[]): number[] {
  const amplitude = 10 ** (4 / 40);
  let omega = (2 * Math.PI * 1500) / SAMPLE_RATE;
  let alpha = Math.sin(omega) / (2 * Math.SQRT1_2);
  const root = 2 * Math.sqrt(amplitude) * alpha;
  const cos = Math.cos(omega);
  const shelf: Biquad = {
    b: [
      amplitude * (amplitude + 1 + (amplitude - 1) * cos + root),
      -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cos),
      amplitude * (amplitude + 1 + (amplitude - 1) * cos - root),
    ],
    a: [
      amplitude + 1 - (amplitude - 1) * cos + root,
      2 * (amplitude - 1 - (amplitude + 1) * cos),
      amplitude + 1 - (amplitude - 1) * cos - root,
    ],
  };
  omega = (2 * Math.PI * 38) / SAMPLE_RATE;
  alpha = Math.sin(omega) / (2 * 0.5);
  const highPass: Biquad = {
    b: [
      (1 + Math.cos(omega)) / 2,
      -(1 + Math.cos(omega)),
      (1 + Math.cos(omega)) / 2,
    ],
    a: [1 + alpha, -2 * Math.cos(omega), 1 - alpha],
  };
  return applyBiquad(applyBiquad(signal, shelf), highPass);
}

/** 400ms 窓の最大ラウドネス（LUFS）。短い音も測れるよう、前後に 400ms の無音を足して測る。 */
function momentaryLoudness(signal: readonly number[]): number {
  const silence = new Array<number>(samples(400)).fill(0);
  const weighted = kWeight([...silence, ...signal, ...silence]);
  const window = samples(400);
  const energy = [0];
  for (const value of weighted) {
    energy.push(energy.at(-1)! + value * value);
  }
  let maximum = 0;
  for (let end = window; end < energy.length; end += 1) {
    maximum = Math.max(
      maximum,
      (energy[end]! - energy[end - window]!) / window,
    );
  }
  return -0.691 + 10 * Math.log10(maximum + 1e-15);
}

function scaleToLoudness(
  signal: readonly number[],
  loudness: number,
): number[] {
  const gain = 10 ** ((loudness - momentaryLoudness(signal)) / 20);
  return signal.map((value) => value * gain);
}

/** 大きさをそろえ、ピークから `floorDb` 下がった所で切って `fadeMs` で閉じ、鳴り始めの前の無音を詰める。 */
function finish(signal: readonly number[], settings: Finish): number[] {
  let result = scaleToLoudness(
    [...signal, ...new Array<number>(samples(30)).fill(0)],
    settings.loudness,
  );
  const window = samples(2);
  const envelope = result.map((_, index) => {
    const from = Math.max(0, index - window / 2);
    const slice = result.slice(from, from + window);
    return Math.sqrt(
      slice.reduce((sum, value) => sum + value * value, 0) / slice.length,
    );
  });
  const peak = envelope.indexOf(Math.max(...envelope));
  const floor = envelope[peak]! * 10 ** (settings.floorDb / 20);
  const belowFloor = envelope.findIndex(
    (value, index) => index > peak && value < floor,
  );
  const fade = samples(settings.fadeMs);
  const end = Math.min(
    result.length,
    (belowFloor === -1 ? result.length : belowFloor) + fade,
  );
  result = result.slice(0, end);
  const fadeLength = Math.min(fade, result.length);
  for (let index = 0; index < fadeLength; index += 1) {
    const position = result.length - fadeLength + index;
    result[position]! *= Math.cos(((index / fadeLength) * Math.PI) / 2) ** 2;
  }
  const magnitude = Math.max(...result.map(Math.abs));
  const start = Math.max(
    0,
    result.findIndex(
      (value) => Math.abs(value) > magnitude * 10 ** (-50 / 20),
    ) - samples(0.5),
  );
  return scaleToLoudness(result.slice(start), settings.loudness);
}

function toWav(signal: readonly number[]): Uint8Array {
  const data = new Float32Array(signal);
  const header = new DataView(new ArrayBuffer(44));
  function write(offset: number, text: string) {
    for (let index = 0; index < text.length; index += 1) {
      header.setUint8(offset + index, text.charCodeAt(index));
    }
  }
  write(0, "RIFF");
  header.setUint32(4, 36 + data.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 3, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, SAMPLE_RATE, true);
  header.setUint32(28, SAMPLE_RATE * 4, true);
  header.setUint16(32, 4, true);
  header.setUint16(34, 32, true);
  write(36, "data");
  header.setUint32(40, data.byteLength, true);
  const bytes = new Uint8Array(44 + data.byteLength);
  bytes.set(new Uint8Array(header.buffer), 0);
  bytes.set(new Uint8Array(data.buffer), 44);
  return bytes;
}

/** FLAC のメタデータから PADDING のブロックを外す。ffmpeg の FLAC は 8KB の PADDING を書くため。 */
function withoutPadding(flac: Uint8Array): Uint8Array {
  let position = 4;
  const blocks: Uint8Array[] = [];
  while (true) {
    const header = flac[position]!;
    const length =
      (flac[position + 1]! << 16) |
      (flac[position + 2]! << 8) |
      flac[position + 3]!;
    if ((header & 0x7f) !== 1) {
      blocks.push(flac.slice(position, position + 4 + length));
    }
    position += 4 + length;
    if (header & 0x80) {
      break;
    }
  }
  for (const block of blocks) {
    block[0]! &= 0x7f;
  }
  blocks.at(-1)![0]! |= 0x80;
  const frames = flac.slice(position);
  const total = 4 + blocks.reduce((sum, block) => sum + block.length, 0);
  const output = new Uint8Array(total + frames.length);
  output.set(flac.slice(0, 4), 0);
  let offset = 4;
  for (const block of blocks) {
    output.set(block, offset);
    offset += block.length;
  }
  output.set(frames, offset);
  return output;
}

/** 16bit の FLAC にする。STREAMINFO に長さと MD5 を書き戻せるよう、ffmpeg にはパイプではなくファイルへ書かせる。 */
function writeFlac(
  name: string,
  signal: readonly number[],
  workDirectory: string,
) {
  const peak = Math.max(...signal.map(Math.abs));
  if (peak >= 0.95) {
    throw new Error(`ピークが大きすぎる: ${name}`);
  }
  const wav = path.join(workDirectory, `${name}.wav`);
  const flac = path.join(workDirectory, `${name}.flac`);
  writeFileSync(wav, toWav(signal));
  run([
    "ffmpeg",
    "-nostdin",
    "-v",
    "error",
    "-y",
    "-i",
    wav,
    "-map_metadata",
    "-1",
    "-sample_fmt",
    "s16",
    "-ar",
    String(SAMPLE_RATE),
    "-ac",
    "1",
    "-compression_level",
    "12",
    flac,
  ]);
  writeFileSync(
    path.join(SOUND_DIRECTORY, `${name}.flac`),
    withoutPadding(readFileSync(flac)),
  );
}

async function main() {
  const { values } = parseArgs({ options: { vcsl: { type: "string" } } });
  if (!values.vcsl) {
    throw new Error("--vcsl に VCSL を取り出したディレクトリを渡す");
  }
  const recordings = Object.fromEntries(
    (Object.keys(RECORDINGS) as RecordingName[]).map((name) => [
      name,
      readRecording(values.vcsl!, name),
    ]),
  );
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const rendered = await page.evaluate(renderInBrowser, {
    definitions: SOUNDS,
    recordings,
    sampleRate: SAMPLE_RATE,
  });
  await browser.close();

  const workDirectory = mkdtempSync(path.join(tmpdir(), "hakoiri-sounds-"));
  try {
    for (const [name, definition] of Object.entries(SOUNDS)) {
      writeFlac(
        name,
        finish(rendered[name]!, definition.finish),
        workDirectory,
      );
    }
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

await main();

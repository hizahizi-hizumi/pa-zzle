/**
 * 送迎パーキングの効果音を描いて FLAC に書き出す。
 *
 * 使い方（リポジトリのルートから）: bun scripts/assets/shuttle-parking_sounds.ts
 *
 * 音は Chromium の `OfflineAudioContext` で描く（Playwright で Chromium を開き、ページの中で描いた波形を受け取る）。
 * 受け取った波形は、ffmpeg の `ebur128` で測った 400ms 窓の最大ラウドネスを音ごとの値にそろえ、
 * 鳴り始めの前の無音と鳴り終えた後の無音を詰めて、16bit・48kHz・モノラルの FLAC にする。
 * 乱数は種を固定した生成器で作るので、同じ版の Chromium と ffmpeg なら同じ音になる。
 * ffmpeg（6.1）と、環境に入っている playwright（NODE_PATH か /opt/node* の全体インストール）が要る。
 *
 * 音（どれも題材の送迎から作り、パーキングジャムの音は使わない）:
 * - `exited`: 車が駐車場を出て待機枠で止まる。軽く走り出す風の音と、枠で止まるタイヤのきゅっ。
 * - `blocked`: 出せない車を押した。責めない低く短いこつん。進路が塞がれている場合と待機枠が埋まっている場合で同じ。
 * - `boarded-1`〜`boarded-3`: 乗客が1人乗る。シートベルトのかちっ。続けて鳴るので3本を順に回す。
 * - `departed`: 満席の車が出発する。ドアが閉まる軽い音から走り出す。
 * - `cleared`: 全員を送り出した。送迎車の車内チャイムのような3音。クラクションは使わない。
 */
import { spawnSync } from "node:child_process";
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

const SAMPLE_RATE = 48_000;
const OUTPUT_DIRECTORY = path.resolve(
  import.meta.dir,
  "../../frontend/src/games/shuttle-parking/assets/sounds",
);

/** 音ごとの 400ms 窓の最大ラウドネス（LUFS）。既存のゲームの同じ役割の音の近くに置く。 */
const LOUDNESS = {
  exited: -38,
  blocked: -41,
  "boarded-1": -45,
  "boarded-2": -45,
  "boarded-3": -45,
  departed: -38,
  cleared: -33,
} as const;

type SoundName = keyof typeof LOUDNESS;

type Playwright = {
  chromium: {
    launch: () => Promise<{
      newPage: () => Promise<{
        evaluate: <Result, Argument>(
          pageFunction: (argument: Argument) => Promise<Result>,
          argument: Argument,
        ) => Promise<Result>;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

function loadPlaywright(): Playwright {
  const globalModuleDirectories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const directory of globalModuleDirectories) {
    try {
      return createRequire(path.join(directory, "_"))("playwright");
    } catch {}
  }
  throw new Error(
    "playwright が見つからない。NODE_PATH に playwright のある node_modules を指定する",
  );
}

/** ページの中で描く。引数で渡すのは標本化周波数だけで、音の中身はこの関数の中に閉じる。 */
async function renderInPage(
  sampleRate: number,
): Promise<Record<string, number[]>> {
  function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    };
  }

  function createNoise(
    context: BaseAudioContext,
    seconds: number,
    seed: number,
  ): AudioBuffer {
    const buffer = context.createBuffer(
      1,
      Math.ceil(seconds * context.sampleRate),
      context.sampleRate,
    );
    const random = createRandom(seed);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = random() * 2 - 1;
    }
    return buffer;
  }

  type Envelope = readonly (readonly [seconds: number, gain: number])[];

  function applyEnvelope(param: AudioParam, start: number, points: Envelope) {
    param.setValueAtTime(0, start);
    for (const [seconds, gain] of points) {
      param.linearRampToValueAtTime(gain, start + seconds);
    }
  }

  /** 帯域を絞った雑音の粒。`frequency` は始めと終わりの中心周波数。 */
  function noiseBurst(
    context: BaseAudioContext,
    {
      start,
      duration,
      frequency,
      q,
      envelope,
      seed,
      type = "bandpass",
    }: {
      start: number;
      duration: number;
      frequency: readonly [number, number];
      q: number;
      envelope: Envelope;
      seed: number;
      type?: BiquadFilterType;
    },
  ) {
    const source = context.createBufferSource();
    source.buffer = createNoise(context, duration + 0.05, seed);
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency[0], start);
    filter.frequency.exponentialRampToValueAtTime(
      frequency[1],
      start + duration,
    );
    const gain = context.createGain();
    applyEnvelope(gain.gain, start, envelope);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  /** 減衰する正弦波。倍音を重ねて鐘のような響きにする。 */
  function tone(
    context: BaseAudioContext,
    {
      start,
      frequency,
      decaySeconds,
      level,
      partials = [[1, 1]],
      attackSeconds = 0.004,
      glideTo,
    }: {
      start: number;
      frequency: number;
      decaySeconds: number;
      level: number;
      partials?: readonly (readonly [ratio: number, gain: number])[];
      attackSeconds?: number;
      glideTo?: number;
    },
  ) {
    for (const [ratio, partialGain] of partials) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency * ratio, start);
      if (glideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(
          glideTo * ratio,
          start + decaySeconds,
        );
      }
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        level * partialGain,
        start + attackSeconds,
      );
      gain.gain.setTargetAtTime(0, start + attackSeconds, decaySeconds / 4);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + decaySeconds * 1.5);
    }
  }

  async function render(
    seconds: number,
    draw: (context: OfflineAudioContext) => void,
  ): Promise<number[]> {
    const context = new OfflineAudioContext(
      1,
      Math.ceil(seconds * sampleRate),
      sampleRate,
    );
    draw(context);
    const rendered = await context.startRendering();
    return Array.from(rendered.getChannelData(0));
  }

  /** シートベルトの金具が差さる2つの小さな当たり。`variant` で高さと間をずらす。 */
  function seatbelt(variant: number) {
    const pitch = [1, 1.08, 0.94][variant] ?? 1;
    const gap = [0.024, 0.02, 0.028][variant] ?? 0.024;
    const metal = [
      [1, 1],
      [1.52, 0.4],
    ] as const;
    return render(0.08, (context) => {
      tone(context, {
        start: 0.001,
        frequency: 3100 * pitch,
        decaySeconds: 0.012,
        level: 0.4,
        partials: metal,
        attackSeconds: 0.0006,
      });
      tone(context, {
        start: 0.001 + gap,
        frequency: 2350 * pitch,
        decaySeconds: 0.02,
        level: 0.8,
        partials: metal,
        attackSeconds: 0.0006,
      });
      noiseBurst(context, {
        start: 0.001 + gap,
        duration: 0.004,
        frequency: [2600, 2400],
        q: 4,
        envelope: [
          [0.0005, 0.3],
          [0.004, 0],
        ],
        seed: 21 + variant,
      });
    });
  }

  return {
    exited: await render(0.36, (context) => {
      noiseBurst(context, {
        start: 0,
        duration: 0.2,
        frequency: [450, 1000],
        q: 0.7,
        envelope: [
          [0.04, 0.35],
          [0.14, 0.5],
          [0.2, 0],
        ],
        seed: 1,
        type: "lowpass",
      });
      tone(context, {
        start: 0,
        frequency: 70,
        glideTo: 110,
        decaySeconds: 0.2,
        level: 0.25,
        attackSeconds: 0.04,
      });
      tone(context, {
        start: 0.19,
        frequency: 2300,
        glideTo: 2000,
        decaySeconds: 0.05,
        level: 0.12,
        attackSeconds: 0.004,
      });
    }),
    blocked: await render(0.2, (context) => {
      tone(context, {
        start: 0,
        frequency: 190,
        glideTo: 150,
        decaySeconds: 0.12,
        level: 0.8,
        partials: [
          [1, 1],
          [2.1, 0.25],
        ],
      });
      noiseBurst(context, {
        start: 0,
        duration: 0.03,
        frequency: [900, 500],
        q: 1,
        envelope: [
          [0.002, 0.25],
          [0.03, 0],
        ],
        seed: 3,
        type: "lowpass",
      });
    }),
    "boarded-1": await seatbelt(0),
    "boarded-2": await seatbelt(1),
    "boarded-3": await seatbelt(2),
    departed: await render(0.5, (context) => {
      tone(context, {
        start: 0,
        frequency: 95,
        glideTo: 70,
        decaySeconds: 0.1,
        level: 0.7,
      });
      noiseBurst(context, {
        start: 0,
        duration: 0.05,
        frequency: [700, 300],
        q: 1,
        envelope: [
          [0.003, 0.45],
          [0.05, 0],
        ],
        seed: 4,
        type: "lowpass",
      });
      noiseBurst(context, {
        start: 0.08,
        duration: 0.22,
        frequency: [450, 1000],
        q: 0.7,
        envelope: [
          [0.06, 0.3],
          [0.16, 0.38],
          [0.22, 0],
        ],
        seed: 5,
        type: "lowpass",
      });
      tone(context, {
        start: 0.08,
        frequency: 75,
        glideTo: 130,
        decaySeconds: 0.22,
        level: 0.2,
        attackSeconds: 0.06,
      });
    }),
    cleared: await render(1.1, (context) => {
      const bell = [
        [1, 1],
        [2, 0.35],
        [3.01, 0.12],
      ] as const;
      for (const [index, frequency] of [784, 988, 1175].entries()) {
        tone(context, {
          start: index * 0.1,
          frequency,
          decaySeconds: 0.26,
          level: 0.32,
          partials: bell,
        });
      }
    }),
  };
}

function runFfmpeg(args: readonly string[], input?: Buffer): string {
  const result = spawnSync("ffmpeg", ["-nostdin", ...args], {
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr.toString()}`);
  }
  return result.stderr.toString();
}

function toBytes(signal: Float32Array): Buffer {
  return Buffer.from(signal.buffer, signal.byteOffset, signal.byteLength);
}

/** 前後に 400ms の無音を足して、400ms 窓の最大ラウドネス（LUFS）を測る。 */
function measureMomentaryMax(signal: Float32Array): number {
  const silence = new Float32Array(SAMPLE_RATE * 0.4);
  const padded = new Float32Array(silence.length * 2 + signal.length);
  padded.set(signal, silence.length);
  const log = runFfmpeg(
    [
      "-v",
      "info",
      "-f",
      "f32le",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "-i",
      "-",
      "-af",
      "ebur128=metadata=0",
      "-f",
      "null",
      "-",
    ],
    toBytes(padded),
  );
  const values = [...log.matchAll(/M:\s*(-?[\d.]+)/g)].map((match) =>
    Number(match[1]),
  );
  return Math.max(...values);
}

/** 鳴り始めの前の無音を詰め、ピークから 40dB 下がった後を切って 5ms で閉じる。 */
function trim(signal: Float32Array): Float32Array {
  const peak = signal.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const floor = peak * 10 ** (-40 / 20);
  const start = Math.max(
    0,
    signal.findIndex((value) => Math.abs(value) > floor) - 24,
  );
  let end = signal.length;
  while (end > start && Math.abs(signal[end - 1] ?? 0) < floor) end -= 1;
  const fade = Math.min(SAMPLE_RATE * 0.005, end - start);
  const result = signal.slice(start, end);
  for (let index = 0; index < fade; index += 1) {
    const position = result.length - fade + index;
    result[position] =
      (result[position] ?? 0) * Math.cos((index / fade) * (Math.PI / 2)) ** 2;
  }
  return result;
}

function normalize(signal: Float32Array, loudness: number): Float32Array {
  const gain = 10 ** ((loudness - measureMomentaryMax(signal)) / 20);
  const result = signal.map((value) => value * gain);
  const peak = result.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (peak >= 0.95) {
    throw new Error(`ピークが大きすぎる: ${peak}`);
  }
  return result;
}

/** FLAC のメタデータから PADDING のブロックを外す。ffmpeg の FLAC は 8KB の PADDING を書くため。 */
function withoutPadding(flac: Buffer): Buffer {
  let position = 4;
  const blocks: Buffer[] = [];
  for (;;) {
    const header = flac[position] ?? 0;
    const length = flac.readUIntBE(position + 1, 3);
    if ((header & 0x7f) !== 1) {
      blocks.push(Buffer.from(flac.subarray(position, position + 4 + length)));
    }
    position += 4 + length;
    if (header & 0x80) break;
  }
  for (const block of blocks) block[0] = (block[0] ?? 0) & 0x7f;
  const last = blocks.at(-1);
  if (last) last[0] = (last[0] ?? 0) | 0x80;
  return Buffer.concat([
    flac.subarray(0, 4),
    ...blocks,
    flac.subarray(position),
  ]);
}

/** STREAMINFO に長さと MD5 を書き戻せるよう、ffmpeg にはパイプではなくファイルへ書かせる。 */
function writeFlac(name: SoundName, signal: Float32Array): void {
  const workDirectory = mkdtempSync(
    path.join(tmpdir(), "shuttle-parking-sounds-"),
  );
  const temporary = path.join(workDirectory, `${name}.flac`);
  try {
    runFfmpeg(
      [
        "-v",
        "error",
        "-y",
        "-f",
        "f32le",
        "-ar",
        String(SAMPLE_RATE),
        "-ac",
        "1",
        "-i",
        "-",
        "-c:a",
        "flac",
        "-sample_fmt",
        "s16",
        temporary,
      ],
      toBytes(signal),
    );
    writeFileSync(
      path.join(OUTPUT_DIRECTORY, `${name}.flac`),
      withoutPadding(readFileSync(temporary)),
    );
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const rendered = await page.evaluate(renderInPage, SAMPLE_RATE);
    for (const name of Object.keys(LOUDNESS) as SoundName[]) {
      const samples = rendered[name];
      if (!samples) throw new Error(`描けなかった: ${name}`);
      writeFlac(
        name,
        normalize(trim(Float32Array.from(samples)), LOUDNESS[name]),
      );
    }
  } finally {
    await browser.close();
  }
}

await main();

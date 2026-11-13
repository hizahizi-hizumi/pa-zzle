// jsdom の環境には ReadableStream が無い実行方法（vitest の vmForks など）があるので、Node のものを使う。
import { ReadableStream } from "node:stream/web";

import type { BackgroundMusicTrack } from "@/lib/background-music";

import type { VolumeSetting } from "@/lib/stored-volume-setting";

type BackgroundMusic = typeof import("@/lib/background-music");

type FakeAudioBuffer = {
  url: string;
  length: number;
  sampleRate: number;
  duration: number;
  numberOfChannels: number;
  getChannelData: (channel: number) => Float32Array;
};

/** テストの曲の1ループの長さ（48 kHz で 60 秒）。 */
const TRACK_LOOP_LENGTH = 2_880_000;
const SAMPLE_RATE = 48_000;

const realSetTimeout = globalThis.setTimeout;

function createFakeParam(value: number) {
  return {
    value,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn<(value: number, time: number) => void>(),
    setTargetAtTime: vi.fn<(target: number, time: number) => void>(),
    cancelScheduledValues: vi.fn(),
  };
}

function createFakeBufferSource() {
  return {
    buffer: null as FakeAudioBuffer | null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn<(when: number, offset: number) => void>(),
    stop: vi.fn<(when: number) => void>(),
  };
}

function createFakeGain() {
  return {
    gain: createFakeParam(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

class FakeAudio {
  static instances: FakeAudio[] = [];
  static allowsPlay = true;
  src = "";
  preload = "";
  loop = false;
  currentTime = 0;
  duration = Number.NaN;
  error = null;
  listeners = new Map<string, (() => void)[]>();
  play = vi.fn(() =>
    FakeAudio.allowsPlay
      ? Promise.resolve()
      : Promise.reject(new DOMException("操作が要る", "NotAllowedError")),
  );
  pause = vi.fn();
  load = vi.fn();

  constructor() {
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeAttribute(name: string) {
    if (name === "src") {
      this.src = "";
    }
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "suspended";
  currentTime = 10;
  destination = {};
  sources: ReturnType<typeof createFakeBufferSource>[] = [];
  gains: ReturnType<typeof createFakeGain>[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  addEventListener = vi.fn();

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createBufferSource() {
    const source = createFakeBufferSource();
    this.sources.push(source);
    return source;
  }

  createGain() {
    const gain = createFakeGain();
    this.gains.push(gain);
    return gain;
  }

  createMediaElementSource(element: FakeAudio) {
    return { context: this, element, connect: vi.fn(), disconnect: vi.fn() };
  }

  createDynamicsCompressor() {
    return {
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
    };
  }
}

/**
 * `paddingLength` を決めると、MP3 の詰め物を取り除かないブラウザのように、1ループよりその分だけ長くし、
 * 先頭の `leadingPaddingLength` を無音、それより後を音のあるサンプルにする。
 */
class FakeOfflineAudioContext {
  static paddingLength = 0;
  static leadingPaddingLength = 0;

  async decodeAudioData(data: ArrayBuffer): Promise<FakeAudioBuffer> {
    const length = TRACK_LOOP_LENGTH + FakeOfflineAudioContext.paddingLength;
    const { leadingPaddingLength } = FakeOfflineAudioContext;
    return {
      url: new TextDecoder().decode(data).trim(),
      length,
      sampleRate: SAMPLE_RATE,
      duration: length / SAMPLE_RATE,
      numberOfChannels: 1,
      getChannelData() {
        return new Float32Array(length)
          .fill(0.05)
          .fill(0, 0, leadingPaddingLength);
      },
    };
  }
}

function defineTrack(
  backgroundMusic: BackgroundMusic,
  url: string,
): BackgroundMusicTrack {
  return backgroundMusic.defineBackgroundMusicTrack({
    url,
    loopLength: TRACK_LOOP_LENGTH,
  });
}

function stubFetch() {
  const fetch = vi.fn(async (url: string) => ({
    ok: true,
    blob: async () => ({
      arrayBuffer: async () => new TextEncoder().encode(url).buffer,
    }),
  }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function stubStreamingFetch() {
  const controllers = new Map<
    string,
    ReadableStreamDefaultController<Uint8Array>
  >();
  const fetch = vi.fn(async (url: string) => ({
    ok: true,
    headers: new Headers({ "Content-Type": "audio/mpeg" }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controllers.set(url, controller);
      },
    }),
  }));
  vi.stubGlobal("fetch", fetch);
  return {
    fetch,
    /** 要素で流し始められるだけの分を届ける。中身は空白で、読み解くと取り除かれる。 */
    async deliverPart(url: string): Promise<void> {
      controllers.get(url)?.enqueue(new Uint8Array(64 * 1024).fill(0x20));
      await settle();
    },
    /** 残りを届けて取得を終え、読み解き終えるのを待つ。読み解いた曲を見分けられるよう、中身の終わりに URL を置く。 */
    async finish(url: string): Promise<void> {
      const controller = controllers.get(url);
      controller?.enqueue(new TextEncoder().encode(url));
      controller?.close();
      await settle();
    },
  };
}

function stubAudio() {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:track");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
}

/** 取得・読み解き・AudioContext が動き出すのを待ち、`ms` だけ時間を進める。 */
async function settle(ms = 0): Promise<void> {
  await new Promise((resolve) => realSetTimeout(resolve, 0));
  await vi.advanceTimersByTimeAsync(ms);
  await new Promise((resolve) => realSetTimeout(resolve, 0));
}

async function unlockByUserGesture(): Promise<void> {
  window.dispatchEvent(new Event("pointerdown"));
  await settle();
}

/** AudioContext・要素・読み込んだ曲・設定を一つだけ持つモジュールの状態を、テストごとに作り直して読み込む。 */
async function importBackgroundMusic(): Promise<
  BackgroundMusic & { setBackgroundMusicVolume: VolumeSetting["setVolume"] }
> {
  vi.resetModules();
  const [backgroundMusic, setting] = await Promise.all([
    import("@/lib/background-music"),
    import("@/lib/background-music-setting"),
  ]);
  return {
    ...backgroundMusic,
    setBackgroundMusicVolume: setting.backgroundMusicVolumeSetting.setVolume,
  };
}

function getAudioContext(): FakeAudioContext | undefined {
  return FakeAudioContext.instances[0];
}

function getLoopStarts() {
  return (
    getAudioContext()?.sources.map(({ buffer, loop, start }) => ({
      url: buffer?.url,
      loop,
      when: start.mock.calls[0]?.[0],
      offset: start.mock.calls[0]?.[1],
    })) ?? []
  );
}

function getLoopRegions() {
  return (
    getAudioContext()?.sources.map(({ loopStart, loopEnd, start }) => ({
      loopStart,
      loopEnd,
      offset: start.mock.calls[0]?.[1],
    })) ?? []
  );
}

function getStoppedLoopUrls() {
  return (
    getAudioContext()
      ?.sources.filter(({ stop }) => stop.mock.calls.length > 0)
      .map(({ buffer }) => buffer?.url) ?? []
  );
}

/** 曲ごとに掛ける大きさの GainNode。BGM の出口へじかにつないだ GainNode を、作った順に返す。 */
function getVoiceLevels() {
  const context = getAudioContext();
  const output = context?.gains[0];
  return (
    context?.gains.filter(({ connect }) =>
      connect.mock.calls.some(([destination]) => destination === output),
    ) ?? []
  );
}

/** 曲ごとにフェードイン・フェードアウトする GainNode。曲ごとに掛ける大きさの GainNode へつないだ GainNode を、作った順に返す。 */
function getVoiceFaders() {
  const levels: unknown[] = getVoiceLevels();
  return (
    getAudioContext()?.gains.filter(({ connect }) =>
      connect.mock.calls.some(([destination]) => levels.includes(destination)),
    ) ?? []
  );
}

function getLoopStops() {
  return (
    getAudioContext()
      ?.sources.filter(({ stop }) => stop.mock.calls.length > 0)
      .map(({ buffer, stop }) => ({
        url: buffer?.url,
        when: stop.mock.calls[0]?.[0],
      })) ?? []
  );
}

function findAudio(src: string): FakeAudio | undefined {
  return FakeAudio.instances.find((audio) => audio.src === src);
}

function changeVisibility(visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** 前のテストで読み込んだモジュールが待つ操作の購読を、次のテストへ持ち越さない。 */
const addedWindowListeners: [string, EventListenerOrEventListenerObject][] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  FakeAudio.allowsPlay = true;
  FakeOfflineAudioContext.paddingLength = 0;
  FakeOfflineAudioContext.leadingPaddingLength = 0;
  const addEventListener = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(
    function recordListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (!listener) {
        return;
      }
      addedWindowListeners.push([type, listener]);
      addEventListener(type, listener, options);
    },
  );
});

afterEach(() => {
  Reflect.deleteProperty(document, "visibilityState");
  for (const [type, listener] of addedWindowListeners.splice(0)) {
    window.removeEventListener(type, listener, true);
    window.removeEventListener(type, listener);
  }
  FakeAudioContext.instances = [];
  FakeAudio.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("playBackgroundMusic", () => {
  describe("利用者がまだ操作していない場合", () => {
    let backgroundMusic: BackgroundMusic;
    let fetch: ReturnType<typeof stubFetch>;
    let homeTrack: BackgroundMusicTrack;

    beforeEach(async () => {
      stubAudio();
      fetch = stubFetch();
      backgroundMusic = await importBackgroundMusic();
      homeTrack = defineTrack(backgroundMusic, "/home.mp3");
    });

    test("AudioContext を作らず、要素にネットワークから読み込ませずに、曲のファイルを取得すること", async () => {
      backgroundMusic.playBackgroundMusic(homeTrack);
      await settle();

      expect(FakeAudioContext.instances).toEqual([]);
      expect(findAudio("/home.mp3")).toBeUndefined();
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/home.mp3");
    });

    describe("操作の前に曲を読み解き終えた場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(homeTrack);
        await settle();
      });

      test("操作したら、読み解いた曲を頭からループ再生すること", async () => {
        await unlockByUserGesture();

        expect(getLoopStarts()).toEqual([
          { url: "/home.mp3", loop: true, when: 10, offset: 0 },
        ]);
      });
    });
  });

  describe("曲を取得している間に利用者が操作した場合", () => {
    let backgroundMusic: BackgroundMusic;
    let stream: ReturnType<typeof stubStreamingFetch>;

    beforeEach(async () => {
      stubAudio();
      stream = stubStreamingFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
    });

    describe("流し始められるだけの分が届いている場合", () => {
      beforeEach(async () => {
        await stream.deliverPart("/home.mp3");
      });

      test("操作の中で届いた分を要素で流し、もう一つの要素も一度再生して止めること", () => {
        window.dispatchEvent(new Event("pointerdown"));

        expect(
          FakeAudio.instances.map(({ src, loop, play, pause }) => ({
            src,
            loop,
            played: play.mock.calls.length,
            paused: pause.mock.calls.length,
          })),
        ).toEqual([
          { src: "blob:track", loop: false, played: 1, paused: 0 },
          { src: "", loop: false, played: 1, paused: 1 },
        ]);
      });
    });

    describe("流し始められるだけの分がまだ届いていない場合", () => {
      beforeEach(async () => {
        await unlockByUserGesture();
      });

      test("届いてから要素で流し始めること", async () => {
        await stream.deliverPart("/home.mp3");

        expect(findAudio("blob:track")?.play).toHaveBeenCalled();
      });
    });

    describe("取得し終えた場合", () => {
      beforeEach(async () => {
        await stream.deliverPart("/home.mp3");
        await unlockByUserGesture();
      });

      test("曲のファイルを取得し直さないこと", async () => {
        await stream.finish("/home.mp3");

        expect(stream.fetch).toHaveBeenCalledOnce();
      });
    });
  });

  describe("曲を取得できなかった場合", () => {
    beforeEach(async () => {
      stubAudio();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, status: 404 })),
      );
      const backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
    });

    test("操作したら、要素にネットワークから読み込ませて流すこと", async () => {
      await unlockByUserGesture();

      expect(findAudio("/home.mp3")?.play).toHaveBeenCalled();
    });
  });

  describe("要素で流し始めた場合", () => {
    let stream: ReturnType<typeof stubStreamingFetch>;
    let homeAudio: FakeAudio | undefined;

    beforeEach(async () => {
      stubAudio();
      stream = stubStreamingFetch();
      const backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
      await stream.deliverPart("/home.mp3");
      await unlockByUserGesture();
      homeAudio = findAudio("blob:track");
    });

    test("要素が鳴り始めたらフェードインすること", () => {
      homeAudio?.dispatch("playing");

      const fader = getAudioContext()?.gains[1];
      expect(fader?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        expect.any(Number),
      );
    });

    describe("鳴り始めた後に曲を読み解いた場合", () => {
      beforeEach(() => {
        homeAudio?.dispatch("playing");
        if (homeAudio) {
          homeAudio.currentTime = 12;
        }
      });

      test("要素の再生位置からループ再生を始めること", async () => {
        await stream.finish("/home.mp3");

        expect(getLoopStarts()).toEqual([
          { url: "/home.mp3", loop: true, when: 10.1, offset: 12.1 },
        ]);
      });

      test("ループ再生へ渡し終えたら要素を止めること", async () => {
        await stream.finish("/home.mp3");
        await settle(300);

        expect(homeAudio?.pause).toHaveBeenCalled();
        expect(homeAudio?.src).toBe("");
      });
    });
  });

  describe("読み解いた曲が、MP3 の詰め物の分だけ1ループより長い場合", () => {
    // 先頭の情報フレームまで無音として読み解くブラウザの、エンコーダの遅延・情報フレーム・読み解きの遅延を合わせた長さ。
    const leadingPaddingLength = 576 + 1152 + 529;
    const loopStart = leadingPaddingLength / SAMPLE_RATE;
    const loopEnd = loopStart + TRACK_LOOP_LENGTH / SAMPLE_RATE;
    let backgroundMusic: BackgroundMusic;

    beforeEach(async () => {
      stubAudio();
      FakeOfflineAudioContext.paddingLength = 2304;
      FakeOfflineAudioContext.leadingPaddingLength = leadingPaddingLength;
    });

    describe("操作の前に読み解き終えた場合", () => {
      beforeEach(async () => {
        stubFetch();
        backgroundMusic = await importBackgroundMusic();
        backgroundMusic.playBackgroundMusic(
          defineTrack(backgroundMusic, "/home.mp3"),
        );
        await settle();
      });

      test("詰め物を除いた1ループの区間を、区間の頭からループ再生すること", async () => {
        await unlockByUserGesture();

        expect(getLoopRegions()).toEqual([
          { loopStart, loopEnd, offset: loopStart },
        ]);
      });
    });

    describe("要素で流し始めた後に読み解いた場合", () => {
      let stream: ReturnType<typeof stubStreamingFetch>;
      let homeAudio: FakeAudio | undefined;

      beforeEach(async () => {
        stream = stubStreamingFetch();
        backgroundMusic = await importBackgroundMusic();
        backgroundMusic.playBackgroundMusic(
          defineTrack(backgroundMusic, "/home.mp3"),
        );
        await settle();
        await stream.deliverPart("/home.mp3");
        await unlockByUserGesture();
        homeAudio = findAudio("blob:track");
        homeAudio?.dispatch("playing");
      });

      describe("要素の曲の長さが1ループと同じ場合", () => {
        beforeEach(() => {
          if (homeAudio) {
            homeAudio.duration = 60;
            homeAudio.currentTime = 59.95;
          }
        });

        test("要素の再生位置を1ループの区間の中の位置に直して、ループ再生を始めること", async () => {
          await stream.finish("/home.mp3");

          const [region] = getLoopRegions();
          expect(region?.offset).toBeCloseTo(loopStart + 0.05);
        });
      });

      describe("要素の曲も詰め物の分だけ長い場合", () => {
        beforeEach(() => {
          if (homeAudio) {
            homeAudio.duration = 60 + 1152 / SAMPLE_RATE;
            homeAudio.currentTime = 12;
          }
        });

        test("要素の再生位置から詰め物の分を差し引くこと", async () => {
          await stream.finish("/home.mp3");

          const [region] = getLoopRegions();
          expect(region?.offset).toBeCloseTo(12.1);
        });
      });
    });
  });

  describe("要素の再生を拒まれた場合", () => {
    let homeAudio: FakeAudio | undefined;

    beforeEach(async () => {
      stubAudio();
      const stream = stubStreamingFetch();
      FakeAudio.allowsPlay = false;
      const backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
      await stream.deliverPart("/home.mp3");
      await unlockByUserGesture();
      homeAudio = findAudio("blob:track");
      FakeAudio.allowsPlay = true;
    });

    test("次の操作の中で再生し直すこと", () => {
      window.dispatchEvent(new Event("pointerup"));

      expect(homeAudio?.play).toHaveBeenCalledTimes(2);
    });
  });

  describe("曲をループ再生している場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;
    let stream: ReturnType<typeof stubStreamingFetch>;

    beforeEach(async () => {
      stubAudio();
      stream = stubStreamingFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
      await stream.finish("/home.mp3");
      await unlockByUserGesture();
    });

    test("同じ曲を流すよう頼まれても頭から流し直さないこと", async () => {
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();

      expect(getLoopStarts()).toHaveLength(1);
      expect(FakeAudio.instances.some(({ src }) => src !== "")).toBe(false);
    });

    describe("別の曲に切り替えた場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(
          defineTrack(backgroundMusic, "/result.mp3"),
        );
        await settle();
        await stream.deliverPart("/result.mp3");
      });

      test("次の曲を要素で流し始め、鳴り始めるまでは前の曲を止めないこと", () => {
        const resultAudio = findAudio("blob:track");

        expect(resultAudio?.play).toHaveBeenCalled();
        expect(getStoppedLoopUrls()).toEqual([]);
      });

      test("次の曲が鳴り始めたら、前の曲をフェードアウトして止めること", () => {
        findAudio("blob:track")?.dispatch("playing");

        expect(getStoppedLoopUrls()).toEqual(["/home.mp3"]);
      });
    });

    describe("区切って別の曲に切り替えた場合", () => {
      const transition = {
        kind: "break",
        fadeOutSec: 0.5,
        silenceSec: 1,
        fadeInSec: 4,
      } as const;
      const homeFadedAt = 10 + transition.fadeOutSec;
      const playStartsAt = homeFadedAt + transition.silenceSec;
      let playTrack: BackgroundMusicTrack;
      let now: number;

      beforeEach(() => {
        now = 1000;
        vi.spyOn(performance, "now").mockImplementation(() => now);
        playTrack = defineTrack(backgroundMusic, "/play.mp3");
      });

      test("次の曲を待たずに、前の曲を決めた長さでフェードアウトして止めること", () => {
        backgroundMusic.playBackgroundMusic(playTrack, { transition });

        const [homeFader] = getVoiceFaders();
        expect(
          homeFader?.gain.linearRampToValueAtTime,
        ).toHaveBeenLastCalledWith(0, homeFadedAt);
        expect(getLoopStops()).toEqual([
          { url: "/home.mp3", when: homeFadedAt },
        ]);
      });

      test("前の曲を引き切って無音を空けてから、次の曲を決めた長さでフェードインすること", async () => {
        backgroundMusic.playBackgroundMusic(playTrack, { transition });
        await settle();
        await stream.finish("/play.mp3");

        const playStart = getLoopStarts().at(-1);
        const [, playFader] = getVoiceFaders();
        expect(playStart?.url).toBe("/play.mp3");
        expect(playStart?.when).toBeCloseTo(playStartsAt);
        expect(playFader?.gain.setValueAtTime).toHaveBeenCalledWith(
          0,
          playStart?.when,
        );
        expect(
          playFader?.gain.linearRampToValueAtTime,
        ).toHaveBeenLastCalledWith(
          1,
          (playStart?.when ?? 0) + transition.fadeInSec,
        );
      });

      describe("次の曲を読み解き終えていない場合", () => {
        beforeEach(async () => {
          backgroundMusic.playBackgroundMusic(playTrack, { transition });
          await settle();
          await stream.deliverPart("/play.mp3");
        });

        test("無音を空け終えるまでは、次の曲を要素で流し始めないこと", () => {
          const loadsAnyTrack = FakeAudio.instances.some(
            ({ src }) => src !== "",
          );

          expect(loadsAnyTrack).toBe(false);
        });

        test("無音を空け終えたら、次の曲を要素で流し始めること", async () => {
          now += (playStartsAt - 10) * 1000;
          await settle((playStartsAt - 10) * 1000);

          expect(findAudio("blob:track")?.play).toHaveBeenCalled();
        });
      });

      describe("無音を空け終える前に元の曲へ戻した場合", () => {
        beforeEach(async () => {
          backgroundMusic.playBackgroundMusic(playTrack, { transition });
          await settle();
          await stream.finish("/play.mp3");
        });

        test("次の曲を鳴らさずに止め、空けた無音のあとに元の曲をクロスフェードの長さで流し直すこと", async () => {
          backgroundMusic.playBackgroundMusic(
            defineTrack(backgroundMusic, "/home.mp3"),
          );
          await settle();
          await stream.finish("/home.mp3");

          const starts = getLoopStarts();
          const playStop = getLoopStops().find(
            ({ url }) => url === "/play.mp3",
          );
          const homeRestart = starts.at(-1);
          const homeFader = getVoiceFaders().at(-1);
          expect(starts.map(({ url }) => url)).toEqual([
            "/home.mp3",
            "/play.mp3",
            "/home.mp3",
          ]);
          expect(playStop).toEqual({ url: "/play.mp3", when: undefined });
          expect(homeRestart?.when).toBeCloseTo(playStartsAt);
          expect(
            homeFader?.gain.linearRampToValueAtTime,
          ).toHaveBeenLastCalledWith(1, (homeRestart?.when ?? 0) + 1.2);
        });
      });
    });

    describe("掛ける大きさを決めて別の曲に切り替えた場合", () => {
      test("次の曲にだけ、決めた大きさを掛けること", async () => {
        backgroundMusic.playBackgroundMusic(
          defineTrack(backgroundMusic, "/result.mp3"),
          { gain: 0.5 },
        );
        await settle();
        await stream.deliverPart("/result.mp3");

        const levels = getVoiceLevels().map(({ gain }) => gain.value);
        expect(levels).toEqual([1, 0.5]);
      });
    });

    describe("同じ曲に掛ける大きさだけを変えた場合", () => {
      test("流し直さずに、曲に掛ける大きさを変えること", async () => {
        backgroundMusic.playBackgroundMusic(
          defineTrack(backgroundMusic, "/home.mp3"),
          { gain: 0.5 },
        );
        await settle();

        const [level] = getVoiceLevels();
        expect(getLoopStarts()).toHaveLength(1);
        expect(level?.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0.5);
      });
    });

    describe("初期の音量から 1 段階下げた場合", () => {
      let output: ReturnType<typeof createFakeGain> | undefined;
      let initialGain: number;

      beforeEach(() => {
        output = getAudioContext()?.gains[0];
        initialGain = output?.gain.value ?? 0;
      });

      test("流している曲の出口の大きさを、音量の比の二乗にすること", () => {
        backgroundMusic.setBackgroundMusicVolume(4);

        const target = output?.gain.setTargetAtTime.mock.lastCall?.[0];
        expect(target).toBeCloseTo(initialGain * (4 / 5) ** 2);
        expect(getStoppedLoopUrls()).toEqual([]);
      });
    });

    describe("画面が見えなくなった場合", () => {
      test("フェードアウトして止めること", () => {
        changeVisibility("hidden");

        expect(getStoppedLoopUrls()).toEqual(["/home.mp3"]);
      });
    });

    describe("画面が見えなくなってから見えるようになった場合", () => {
      beforeEach(async () => {
        const context = getAudioContext();
        if (context) {
          context.currentTime = 22;
        }
        changeVisibility("hidden");
        await settle(1000);
      });

      test("止めた位置から流し直すこと", () => {
        changeVisibility("visible");

        expect(getLoopStarts()).toEqual([
          { url: "/home.mp3", loop: true, when: 10, offset: 0 },
          { url: "/home.mp3", loop: true, when: 22, offset: 12 },
        ]);
      });

      describe("AudioContext が止まっている場合", () => {
        beforeEach(() => {
          const context = getAudioContext();
          if (context) {
            context.state = "suspended";
          }
        });

        test("見えるようになっただけでは流さず、次の操作で流し直すこと", async () => {
          changeVisibility("visible");
          const loopCountBeforeGesture = getLoopStarts().length;
          await unlockByUserGesture();

          expect(loopCountBeforeGesture).toBe(1);
          expect(getLoopStarts().at(-1)).toMatchObject({
            url: "/home.mp3",
            offset: 12,
          });
        });
      });
    });

    test("流さない画面に移るとフェードアウトして止めること", () => {
      backgroundMusic.playBackgroundMusic(null);

      const homeFader = getAudioContext()?.gains[1];
      expect(homeFader?.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
        0,
        expect.any(Number),
      );
      expect(getStoppedLoopUrls()).toEqual(["/home.mp3"]);
    });
  });

  describe("流し始めを待たせている場合", () => {
    let backgroundMusic: BackgroundMusic;
    let resultTrack: BackgroundMusicTrack;

    beforeEach(async () => {
      stubAudio();
      stubFetch();
      vi.spyOn(performance, "now").mockReturnValue(1000);
      backgroundMusic = await importBackgroundMusic();
      resultTrack = defineTrack(backgroundMusic, "/result.mp3");
      backgroundMusic.prepareBackgroundMusic([resultTrack]);
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
      backgroundMusic.playBackgroundMusic(null);
      backgroundMusic.holdBackgroundMusicStart(1500);
    });

    test("待たせた時間が過ぎてから流し始めること", async () => {
      backgroundMusic.playBackgroundMusic(resultTrack);
      await settle();

      expect(getLoopStarts().at(-1)).toEqual({
        url: "/result.mp3",
        loop: true,
        when: 11.5,
        offset: 0,
      });
    });
  });

  describe("待たせた時間が過ぎても曲を読み解き終えていない場合", () => {
    let backgroundMusic: BackgroundMusic;
    let now: number;

    beforeEach(async () => {
      stubAudio();
      stubFetch();
      vi.stubGlobal(
        "OfflineAudioContext",
        class PendingOfflineAudioContext {
          decodeAudioData() {
            return new Promise(() => {});
          }
        },
      );
      now = 1000;
      vi.spyOn(performance, "now").mockImplementation(() => now);
      backgroundMusic = await importBackgroundMusic();
      const resultTrack = defineTrack(backgroundMusic, "/result.mp3");
      backgroundMusic.prepareBackgroundMusic([resultTrack]);
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
      backgroundMusic.playBackgroundMusic(null);
      backgroundMusic.holdBackgroundMusicStart(1500);
      for (const audio of FakeAudio.instances) {
        audio.play.mockClear();
      }
      backgroundMusic.playBackgroundMusic(resultTrack);
      await settle();
    });

    test("待たせている間は要素を再生しないこと", () => {
      const resultAudio = findAudio("blob:track");

      expect(resultAudio?.play).not.toHaveBeenCalled();
    });

    test("待たせた時間が過ぎたら要素で流し始めること", async () => {
      now += 1500;
      await settle(1500);

      expect(findAudio("blob:track")?.play).toHaveBeenCalled();
    });
  });

  describe("音量が 0 の設定の場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;
    let fetch: ReturnType<typeof stubFetch>;
    let homeTrack: BackgroundMusicTrack;

    beforeEach(async () => {
      stubAudio();
      fetch = stubFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.setBackgroundMusicVolume(0);
      homeTrack = defineTrack(backgroundMusic, "/home.mp3");
    });

    test("曲を読み込まず、利用者が操作しても AudioContext を作らないこと", async () => {
      backgroundMusic.playBackgroundMusic(homeTrack);
      await unlockByUserGesture();

      expect(fetch).not.toHaveBeenCalled();
      expect(FakeAudio.instances).toEqual([]);
      expect(FakeAudioContext.instances).toEqual([]);
    });

    describe("流したい曲を決めた後に音量を上げた場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(homeTrack);
        backgroundMusic.setBackgroundMusicVolume(6);
        await settle();
      });

      test("利用者が操作したら流し始めること", async () => {
        await unlockByUserGesture();

        expect(getLoopStarts().map(({ url }) => url)).toEqual(["/home.mp3"]);
      });
    });
  });

  describe("流している間に音量を 0 にした場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;

    beforeEach(async () => {
      stubAudio();
      stubFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        defineTrack(backgroundMusic, "/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
    });

    test("フェードアウトして止めること", () => {
      backgroundMusic.setBackgroundMusicVolume(0);

      expect(getStoppedLoopUrls()).toEqual(["/home.mp3"]);
    });

    describe("音量を上げ直した場合", () => {
      beforeEach(async () => {
        backgroundMusic.setBackgroundMusicVolume(0);
        await settle(1000);
      });

      test("同じ曲をもう一度流し始めること", async () => {
        backgroundMusic.setBackgroundMusicVolume(6);
        await settle();

        expect(getLoopStarts().map(({ url }) => url)).toEqual([
          "/home.mp3",
          "/home.mp3",
        ]);
      });
    });
  });
});

describe("prepareBackgroundMusic", () => {
  let backgroundMusic: BackgroundMusic;
  let fetch: ReturnType<typeof stubFetch>;
  let tracks: BackgroundMusicTrack[];

  beforeEach(async () => {
    stubAudio();
    fetch = stubFetch();
    backgroundMusic = await importBackgroundMusic();
    tracks = ["/home.mp3", "/result.mp3"].map((url) =>
      defineTrack(backgroundMusic, url),
    );
  });

  test("流す曲が無ければ、渡した曲を1曲ずつ取得すること", async () => {
    backgroundMusic.prepareBackgroundMusic(tracks);
    await settle();

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/home.mp3",
      "/result.mp3",
    ]);
  });

  describe("流す曲が決まっている場合", () => {
    beforeEach(() => {
      backgroundMusic.prepareBackgroundMusic(tracks);
      backgroundMusic.playBackgroundMusic(tracks[1] ?? null);
    });

    test("流す曲を先に取得し、そのあとに渡した曲を取得すること", async () => {
      await settle();

      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        "/result.mp3",
        "/home.mp3",
      ]);
    });
  });
});

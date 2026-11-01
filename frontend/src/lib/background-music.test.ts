import type { BackgroundMusicTrack } from "@/lib/background-music";

import type { VolumeSetting } from "@/lib/stored-volume-setting";

type BackgroundMusic = typeof import("@/lib/background-music");

type FakeAudioBuffer = { url: string; duration: number };

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

/** 再生を許すかをテストごとに決められ、要素の出来事をテストから起こせる `<audio>` 要素。 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static allowsPlay = true;
  src = "";
  preload = "";
  loop = false;
  currentTime = 0;
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

/** 音声ファイルの中身として、取得した URL をそのまま持つ音のデータを返す。 */
class FakeOfflineAudioContext {
  async decodeAudioData(data: ArrayBuffer): Promise<FakeAudioBuffer> {
    return { url: new TextDecoder().decode(data), duration: 60 };
  }
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

/** 利用者が操作し、AudioContext が動き出すのを待つ。 */
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

function getStoppedLoopUrls() {
  return (
    getAudioContext()
      ?.sources.filter(({ stop }) => stop.mock.calls.length > 0)
      .map(({ buffer }) => buffer?.url) ?? []
  );
}

function findAudio(src: string): FakeAudio | undefined {
  return FakeAudio.instances.find((audio) => audio.src === src);
}

/** 要素が続けて再生できるだけ読み込み、裏で曲のファイルを取得して読み解き終えるのを待つ。 */
async function finishLoading(audio: FakeAudio | undefined): Promise<void> {
  audio?.dispatch("canplaythrough");
  await settle();
}

/** 前のテストで読み込んだモジュールが待つ操作の購読を、次のテストへ持ち越さない。 */
const addedWindowListeners: [string, EventListenerOrEventListenerObject][] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  FakeAudio.allowsPlay = true;
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
      homeTrack = backgroundMusic.defineBackgroundMusicTrack("/home.mp3");
    });

    test("AudioContext を作らず、流す曲を要素に読み込ませるだけにすること", async () => {
      backgroundMusic.playBackgroundMusic(homeTrack);
      await settle();

      expect(FakeAudioContext.instances).toEqual([]);
      expect(FakeAudio.instances).toMatchObject([
        { src: "/home.mp3", preload: "auto" },
      ]);
      expect(FakeAudio.instances[0]?.play).not.toHaveBeenCalled();
    });

    test("要素が続けて再生できるだけ読み込むまで、曲のファイルを取得しないこと", async () => {
      backgroundMusic.playBackgroundMusic(homeTrack);
      await settle();

      expect(fetch).not.toHaveBeenCalled();
    });

    describe("要素が続けて再生できるだけ読み込んだ場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(homeTrack);
        await settle();
      });

      test("曲のファイルを取得すること", async () => {
        findAudio("/home.mp3")?.dispatch("canplaythrough");
        await settle();

        expect(fetch).toHaveBeenCalledExactlyOnceWith("/home.mp3");
      });
    });

    describe("流したい曲を決めた後に利用者が操作した場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(homeTrack);
        await settle();
      });

      test("操作の中で曲の要素を再生し、もう一つの要素も一度再生して止めること", () => {
        window.dispatchEvent(new Event("pointerdown"));

        expect(
          FakeAudio.instances.map(({ play, pause }) => ({
            played: play.mock.calls.length,
            paused: pause.mock.calls.length,
          })),
        ).toEqual([
          { played: 1, paused: 0 },
          { played: 1, paused: 1 },
        ]);
      });
    });

    describe("操作の前に曲を読み解き終えた場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(homeTrack);
        await settle();
        await finishLoading(findAudio("/home.mp3"));
      });

      test("操作したら、読み解いた曲を頭からループ再生すること", async () => {
        await unlockByUserGesture();

        expect(getLoopStarts()).toEqual([
          { url: "/home.mp3", loop: true, when: 10, offset: 0 },
        ]);
      });
    });
  });

  describe("要素で流し始めた場合", () => {
    let backgroundMusic: BackgroundMusic;
    let homeAudio: FakeAudio | undefined;

    beforeEach(async () => {
      stubAudio();
      stubFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
      homeAudio = findAudio("/home.mp3");
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
        await finishLoading(homeAudio);

        expect(getLoopStarts()).toEqual([
          { url: "/home.mp3", loop: true, when: 10.1, offset: 12.1 },
        ]);
      });

      test("ループ再生へ渡し終えたら要素を止めること", async () => {
        await finishLoading(homeAudio);
        await settle(300);

        expect(homeAudio?.pause).toHaveBeenCalled();
        expect(homeAudio?.src).toBe("");
      });
    });
  });

  describe("要素の再生を拒まれた場合", () => {
    let homeAudio: FakeAudio | undefined;

    beforeEach(async () => {
      stubAudio();
      stubFetch();
      FakeAudio.allowsPlay = false;
      const backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
      homeAudio = findAudio("/home.mp3");
      FakeAudio.allowsPlay = true;
    });

    test("次の操作の中で再生し直すこと", () => {
      window.dispatchEvent(new Event("pointerup"));

      expect(homeAudio?.play).toHaveBeenCalledTimes(2);
    });
  });

  describe("曲をループ再生している場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;

    beforeEach(async () => {
      stubAudio();
      stubFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await finishLoading(findAudio("/home.mp3"));
      await unlockByUserGesture();
    });

    test("同じ曲を流すよう頼まれても頭から流し直さないこと", async () => {
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();

      expect(getLoopStarts()).toHaveLength(1);
      expect(FakeAudio.instances.some(({ src }) => src !== "")).toBe(false);
    });

    describe("別の曲に切り替えた場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(
          backgroundMusic.defineBackgroundMusicTrack("/result.mp3"),
        );
        await settle();
      });

      test("次の曲を要素で流し始め、鳴り始めるまでは前の曲を止めないこと", () => {
        const resultAudio = findAudio("/result.mp3");

        expect(resultAudio?.play).toHaveBeenCalled();
        expect(getStoppedLoopUrls()).toEqual([]);
      });

      test("次の曲が鳴り始めたら、前の曲をフェードアウトして止めること", () => {
        findAudio("/result.mp3")?.dispatch("playing");

        expect(getStoppedLoopUrls()).toEqual(["/home.mp3"]);
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
      resultTrack = backgroundMusic.defineBackgroundMusicTrack("/result.mp3");
      backgroundMusic.prepareBackgroundMusic([resultTrack]);
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await finishLoading(findAudio("/home.mp3"));
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
      const resultTrack =
        backgroundMusic.defineBackgroundMusicTrack("/result.mp3");
      backgroundMusic.prepareBackgroundMusic([resultTrack]);
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
      await finishLoading(findAudio("/home.mp3"));
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
      homeTrack = backgroundMusic.defineBackgroundMusicTrack("/home.mp3");
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

        expect(findAudio("/home.mp3")?.play).toHaveBeenCalled();
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
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await finishLoading(findAudio("/home.mp3"));
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
    tracks = ["/home.mp3", "/result.mp3"].map(
      backgroundMusic.defineBackgroundMusicTrack,
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

  describe("流す曲を要素がネットワークから読み込んでいる場合", () => {
    beforeEach(() => {
      backgroundMusic.prepareBackgroundMusic(tracks);
      backgroundMusic.playBackgroundMusic(tracks[0] ?? null);
    });

    test("要素が続けて再生できるだけ読み込むまで、何も取得しないこと", async () => {
      await settle();

      expect(fetch).not.toHaveBeenCalled();
    });

    test("要素が読み込んだら、流す曲のあとに渡した曲を取得すること", async () => {
      await settle();
      await finishLoading(findAudio("/home.mp3"));

      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        "/home.mp3",
        "/result.mp3",
      ]);
    });
  });
});

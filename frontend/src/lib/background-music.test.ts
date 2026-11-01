import type { BackgroundMusicTrack } from "@/lib/background-music";

import type { VolumeSetting } from "@/lib/stored-volume-setting";

type BackgroundMusic = typeof import("@/lib/background-music");

type FakeAudioBuffer = { url: string; duration: number };

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
    addEventListener: vi.fn(),
    start: vi.fn<(when: number) => void>(),
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
    arrayBuffer: async () => new TextEncoder().encode(url).buffer,
  }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function stubWebAudio() {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
}

/** 読み込みと、AudioContext が動き出すのを待つ。 */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 利用者が操作し、AudioContext が動き出すのを待つ。 */
async function unlockByUserGesture(): Promise<void> {
  window.dispatchEvent(new Event("pointerdown"));
  await settle();
}

/** AudioContext・読み込んだ曲・設定を一つだけ持つモジュールの状態を、テストごとに作り直して読み込む。 */
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

function getStartedSources() {
  return (
    getAudioContext()?.sources.map(({ buffer, loop, start }) => ({
      url: buffer?.url,
      loop,
      when: start.mock.calls[0]?.[0],
    })) ?? []
  );
}

function getStoppedUrls() {
  return (
    getAudioContext()
      ?.sources.filter(({ stop }) => stop.mock.calls.length > 0)
      .map(({ buffer }) => buffer?.url) ?? []
  );
}

/** 前のテストで読み込んだモジュールが待つ操作の購読を、次のテストへ持ち越さない。 */
const addedWindowListeners: [string, EventListenerOrEventListenerObject][] = [];

beforeEach(() => {
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
      stubWebAudio();
      fetch = stubFetch();
      backgroundMusic = await importBackgroundMusic();
      homeTrack = backgroundMusic.defineBackgroundMusicTrack("/home.mp3");
    });

    test("AudioContext を作らずに曲の読み込みだけを始めること", async () => {
      backgroundMusic.playBackgroundMusic(homeTrack);
      await settle();

      expect(FakeAudioContext.instances).toEqual([]);
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/home.mp3");
    });

    describe("流したい曲を決めた後に利用者が操作した場合", () => {
      beforeEach(async () => {
        backgroundMusic.playBackgroundMusic(homeTrack);
        await settle();
      });

      test("AudioContext が動き出した時点で曲をループして流し始めること", async () => {
        await unlockByUserGesture();

        expect(getStartedSources()).toEqual([
          { url: "/home.mp3", loop: true, when: 10 },
        ]);
      });
    });
  });

  describe("曲を流している場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;
    let homeTrack: BackgroundMusicTrack;

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      backgroundMusic = await importBackgroundMusic();
      homeTrack = backgroundMusic.defineBackgroundMusicTrack("/home.mp3");
      backgroundMusic.playBackgroundMusic(homeTrack);
      await settle();
      await unlockByUserGesture();
    });

    test("同じ曲を流すよう頼まれても頭から流し直さないこと", async () => {
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();

      expect(getStartedSources()).toHaveLength(1);
      expect(getStoppedUrls()).toEqual([]);
    });

    test("別の曲に切り替えると、前の曲をフェードアウトして止め、次の曲をフェードインすること", async () => {
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/result.mp3"),
      );
      await settle();

      expect(getStartedSources().map(({ url }) => url)).toEqual([
        "/home.mp3",
        "/result.mp3",
      ]);
      expect(getStoppedUrls()).toEqual(["/home.mp3"]);
    });

    describe("初期の音量から半分の音量にした場合", () => {
      let output: ReturnType<typeof createFakeGain> | undefined;
      let initialGain: number;

      beforeEach(() => {
        output = getAudioContext()?.gains[0];
        initialGain = output?.gain.value ?? 0;
      });

      test("流している曲の出口の大きさを 1/4 にすること", () => {
        backgroundMusic.setBackgroundMusicVolume(3);

        const target = output?.gain.setTargetAtTime.mock.lastCall?.[0];
        expect(target).toBeCloseTo(initialGain / 4);
        expect(getStoppedUrls()).toEqual([]);
      });
    });

    test("流さない画面に移るとフェードアウトして止めること", () => {
      backgroundMusic.playBackgroundMusic(null);

      const homeFader = getAudioContext()?.gains[1];
      expect(homeFader?.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
        0,
        expect.any(Number),
      );
      expect(getStoppedUrls()).toEqual(["/home.mp3"]);
    });
  });

  describe("流し始めを待たせている場合", () => {
    let backgroundMusic: BackgroundMusic;
    let resultTrack: BackgroundMusicTrack;

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      vi.spyOn(performance, "now").mockReturnValue(1000);
      backgroundMusic = await importBackgroundMusic();
      resultTrack = backgroundMusic.defineBackgroundMusicTrack("/result.mp3");
      backgroundMusic.prepareBackgroundMusic([resultTrack]);
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
      backgroundMusic.playBackgroundMusic(null);
      backgroundMusic.holdBackgroundMusicStart(1500);
    });

    test("待たせた時間が過ぎてから流し始めること", () => {
      backgroundMusic.playBackgroundMusic(resultTrack);

      expect(getStartedSources().at(-1)).toEqual({
        url: "/result.mp3",
        loop: true,
        when: 11.5,
      });
    });
  });

  describe("音量が 0 の設定の場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;
    let fetch: ReturnType<typeof stubFetch>;
    let homeTrack: BackgroundMusicTrack;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.setBackgroundMusicVolume(0);
      homeTrack = backgroundMusic.defineBackgroundMusicTrack("/home.mp3");
    });

    test("曲を読み込まず、利用者が操作しても AudioContext を作らないこと", async () => {
      backgroundMusic.playBackgroundMusic(homeTrack);
      await unlockByUserGesture();

      expect(fetch).not.toHaveBeenCalled();
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

        expect(getStartedSources().map(({ url }) => url)).toEqual([
          "/home.mp3",
        ]);
      });
    });
  });

  describe("流している間に音量を 0 にした場合", () => {
    let backgroundMusic: Awaited<ReturnType<typeof importBackgroundMusic>>;

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      backgroundMusic = await importBackgroundMusic();
      backgroundMusic.playBackgroundMusic(
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
      );
      await settle();
      await unlockByUserGesture();
    });

    test("フェードアウトして止めること", () => {
      backgroundMusic.setBackgroundMusicVolume(0);

      expect(getStoppedUrls()).toEqual(["/home.mp3"]);
    });

    describe("音量を上げ直した場合", () => {
      beforeEach(() => {
        backgroundMusic.setBackgroundMusicVolume(0);
      });

      test("同じ曲をもう一度流し始めること", () => {
        backgroundMusic.setBackgroundMusicVolume(6);

        expect(getStartedSources().map(({ url }) => url)).toEqual([
          "/home.mp3",
          "/home.mp3",
        ]);
      });
    });
  });
});

describe("prepareBackgroundMusic", () => {
  describe("音量が 0 より大きい設定の場合", () => {
    let backgroundMusic: BackgroundMusic;
    let fetch: ReturnType<typeof stubFetch>;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch();
      backgroundMusic = await importBackgroundMusic();
    });

    test("渡した曲を、流す前に読み込み始めること", () => {
      backgroundMusic.prepareBackgroundMusic([
        backgroundMusic.defineBackgroundMusicTrack("/home.mp3"),
        backgroundMusic.defineBackgroundMusicTrack("/result.mp3"),
      ]);

      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        "/home.mp3",
        "/result.mp3",
      ]);
    });
  });
});

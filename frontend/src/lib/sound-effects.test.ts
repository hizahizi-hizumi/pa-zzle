import type { MockInstance } from "vitest";

import type { SoundEffect, SoundLayer } from "@/lib/sound-effects";

type SoundEffects = typeof import("@/lib/sound-effects");
type SoundEffectsSetting = typeof import("@/lib/sound-effects-setting");

type FakeAudioBuffer = { url: string };

function createFakeBufferSource() {
  return {
    buffer: null as FakeAudioBuffer | null,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    addEventListener: vi.fn(),
    start: vi.fn<(when: number) => void>(),
  };
}

function createFakeGain() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn<(target: number, time: number) => void>(),
      cancelScheduledValues: vi.fn(),
    },
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
    return { url: new TextDecoder().decode(data) };
  }
}

/** `failingUrls` に入っている URL の取得は失敗させる。テストの途中で `failingUrls` を変えると、それ以降の取得に効く。 */
function stubFetch(failingUrls: Iterable<string> = []) {
  const failing = new Set(failingUrls);
  const fetch = vi.fn(async (url: string) => ({
    ok: !failing.has(url),
    arrayBuffer: async () => new TextEncoder().encode(url).buffer,
  }));
  vi.stubGlobal("fetch", fetch);
  return Object.assign(fetch, { failing });
}

function stubWebAudio() {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
}

/** 読み込みの取得と読み解きを終わらせる。 */
function finishLoading(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** AudioContext と設定を一つだけ持つモジュールの状態を、テストごとに作り直して読み込む。 */
async function importSoundEffects(): Promise<
  SoundEffects & Pick<SoundEffectsSetting, "setSoundEffectsEnabled">
> {
  vi.resetModules();
  const [soundEffects, setting] = await Promise.all([
    import("@/lib/sound-effects"),
    import("@/lib/sound-effects-setting"),
  ]);
  return {
    ...soundEffects,
    setSoundEffectsEnabled: setting.setSoundEffectsEnabled,
  };
}

function getStartedSources() {
  return (
    FakeAudioContext.instances[0]?.sources.map(
      ({ buffer, playbackRate, start }) => ({
        url: buffer?.url,
        playbackRate: playbackRate.value,
        when: start.mock.calls[0]?.[0],
      }),
    ) ?? []
  );
}

afterEach(() => {
  FakeAudioContext.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("playSound", () => {
  describe("Web Audio API が無い環境の場合", () => {
    let soundEffects: SoundEffects;
    let fetch: ReturnType<typeof stubFetch>;
    let sound: SoundEffect;

    beforeEach(async () => {
      vi.stubGlobal("AudioContext", undefined);
      vi.stubGlobal("OfflineAudioContext", undefined);
      fetch = stubFetch();
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
      soundEffects.prepareSoundEffects([sound]);
    });

    test("音声ファイルを読み込まず、何もせずに終わること", () => {
      const act = () => soundEffects.playSound(sound);

      expect(act).not.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("読み込みを終えた効果音の場合", () => {
    let soundEffects: SoundEffects;
    let sound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
      soundEffects.prepareSoundEffects([sound]);
      await finishLoading();
    });

    test("止まっている AudioContext を動かし、遅らせた時刻から鳴らすこと", () => {
      soundEffects.playSound(sound, { delayMs: 500 });

      expect(FakeAudioContext.instances[0]?.resume).toHaveBeenCalled();
      expect(getStartedSources()).toEqual([
        { url: "/tap.flac", playbackRate: 1, when: 10.5 },
      ]);
    });
  });

  describe("読み込みを終えた効果音と同じ URL から別に作った効果音の場合", () => {
    let soundEffects: SoundEffects;
    let fetch: ReturnType<typeof stubFetch>;
    let sameUrlSound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch();
      soundEffects = await importSoundEffects();
      soundEffects.prepareSoundEffects([
        soundEffects.defineSoundEffect("/tap.flac"),
      ]);
      await finishLoading();
      sameUrlSound = soundEffects.defineSoundEffect("/tap.flac");
    });

    test("読み直さずに鳴らすこと", () => {
      soundEffects.playSound(sameUrlSound);

      expect(fetch).toHaveBeenCalledOnce();
      expect(getStartedSources()).toEqual([
        { url: "/tap.flac", playbackRate: 1, when: 10 },
      ]);
    });
  });

  describe("まだ読み込めていない効果音の場合", () => {
    let soundEffects: SoundEffects;
    let sound: SoundEffect;
    let respond: () => void;

    beforeEach(async () => {
      stubWebAudio();
      const fetchResponded = new Promise<void>((resolve) => {
        respond = resolve;
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          await fetchResponded;
          return {
            ok: true,
            arrayBuffer: async () => new TextEncoder().encode(url).buffer,
          };
        }),
      );
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
      soundEffects.prepareSoundEffects([sound]);
    });

    test("読み込みを待って遅れて鳴らすことをしないこと", async () => {
      soundEffects.playSound(sound);
      respond();
      await finishLoading();

      expect(getStartedSources()).toEqual([]);
    });
  });

  describe("読み込みを頼んでいない効果音の場合", () => {
    let soundEffects: SoundEffects;
    let fetch: ReturnType<typeof stubFetch>;
    let sound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch();
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
    });

    test("鳴らさずに読み込みを始めること", () => {
      soundEffects.playSound(sound);

      expect(getStartedSources()).toEqual([]);
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/tap.flac");
    });

    describe("一度鳴らそうとして読み込みを終えた場合", () => {
      beforeEach(async () => {
        soundEffects.playSound(sound);
        await finishLoading();
      });

      test("次は鳴らすこと", () => {
        soundEffects.playSound(sound);

        expect(getStartedSources()).toEqual([
          { url: "/tap.flac", playbackRate: 1, when: 10 },
        ]);
      });
    });
  });

  describe("鳴らさない設定の場合", () => {
    let soundEffects: Awaited<ReturnType<typeof importSoundEffects>>;
    let sound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
      soundEffects.prepareSoundEffects([sound]);
      await finishLoading();
      soundEffects.setSoundEffectsEnabled(false);
    });

    test("AudioContext を作らないこと", () => {
      soundEffects.playSound(sound);

      expect(FakeAudioContext.instances).toEqual([]);
    });
  });

  describe("鳴らしている間に鳴らさない設定へ切り替えた場合", () => {
    let soundEffects: Awaited<ReturnType<typeof importSoundEffects>>;

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      soundEffects = await importSoundEffects();
      const sound = soundEffects.defineSoundEffect("/tap.flac");
      soundEffects.prepareSoundEffects([sound]);
      await finishLoading();
      soundEffects.playSound(sound);
    });

    test("鳴っている音を出口で消すこと", () => {
      soundEffects.setSoundEffectsEnabled(false);

      const master = FakeAudioContext.instances[0]?.gains[0];
      expect(master?.gain.setTargetAtTime).toHaveBeenCalledWith(
        0,
        10,
        expect.any(Number),
      );
    });
  });
});

describe("playLayeredSound", () => {
  describe("読み込みを終えた素材を重ねた場合", () => {
    let soundEffects: SoundEffects;
    let layers: SoundLayer[];

    beforeEach(async () => {
      stubWebAudio();
      stubFetch();
      vi.spyOn(Math, "random").mockReturnValue(1);
      soundEffects = await importSoundEffects();
      layers = [
        { sound: soundEffects.defineSoundEffect("/low.flac"), offsetMs: 0 },
        { sound: soundEffects.defineSoundEffect("/high.flac"), offsetMs: 50 },
      ];
      soundEffects.prepareSoundEffects(layers.map(({ sound }) => sound));
      await finishLoading();
    });

    test("素材ごとにずらした時刻から鳴らすこと", () => {
      soundEffects.playLayeredSound(layers, { delayMs: 500 });

      expect(getStartedSources()).toEqual([
        { url: "/low.flac", playbackRate: 1, when: 10.5 },
        { url: "/high.flac", playbackRate: 1, when: 10.55 },
      ]);
    });

    describe("揺らぎを付けた場合", () => {
      const variation = { pitchCents: 1200, volumeRatio: 0.5 };

      test("素材すべてを同じ幅だけ高く大きくして鳴らすこと", () => {
        soundEffects.playLayeredSound(layers, { variation });

        const effectVolumes = FakeAudioContext.instances[0]?.gains
          .slice(1)
          .map(({ gain }) => gain.value);
        expect(
          getStartedSources().map(({ playbackRate }) => playbackRate),
        ).toEqual([2, 2]);
        expect(effectVolumes).toEqual([1.5]);
      });
    });
  });

  describe("読み込みに失敗した素材を含む場合", () => {
    let soundEffects: SoundEffects;
    let layers: SoundLayer[];

    beforeEach(async () => {
      stubWebAudio();
      stubFetch(["/missing.flac"]);
      vi.spyOn(console, "warn").mockImplementation(() => {});
      soundEffects = await importSoundEffects();
      layers = [
        { sound: soundEffects.defineSoundEffect("/tap.flac"), offsetMs: 0 },
        { sound: soundEffects.defineSoundEffect("/missing.flac"), offsetMs: 0 },
      ];
      soundEffects.prepareSoundEffects(layers.map(({ sound }) => sound));
      await finishLoading();
    });

    test("どの素材も鳴らさないこと", () => {
      soundEffects.playLayeredSound(layers);

      expect(getStartedSources()).toEqual([]);
    });
  });
});

describe("prepareSoundEffects", () => {
  describe("鳴らす設定の場合", () => {
    let soundEffects: SoundEffects;
    let fetch: ReturnType<typeof stubFetch>;
    let sound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch();
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
    });

    test("利用者が操作するまで AudioContext を作らず、音声ファイルの読み込みを始めること", () => {
      soundEffects.prepareSoundEffects([sound]);

      expect(FakeAudioContext.instances).toEqual([]);
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/tap.flac");
    });

    test("同じ URL の効果音を一度だけ読み込むこと", () => {
      soundEffects.prepareSoundEffects([sound]);
      soundEffects.prepareSoundEffects([
        soundEffects.defineSoundEffect("/tap.flac"),
      ]);

      expect(fetch).toHaveBeenCalledOnce();
    });

    describe("呼んだ後に利用者が操作した場合", () => {
      beforeEach(() => {
        soundEffects.prepareSoundEffects([sound]);
      });

      test("AudioContext を作って動かすこと", () => {
        window.dispatchEvent(new Event("pointerdown"));

        expect(FakeAudioContext.instances[0]?.resume).toHaveBeenCalled();
      });
    });
  });

  describe("読み込みに失敗した効果音の場合", () => {
    let soundEffects: SoundEffects;
    let fetch: ReturnType<typeof stubFetch>;
    let warn: MockInstance<typeof console.warn>;
    let sound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch(["/tap.flac"]);
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      soundEffects = await importSoundEffects();
      sound = soundEffects.defineSoundEffect("/tap.flac");
    });

    test("読み込めなかった URL を警告すること", async () => {
      soundEffects.prepareSoundEffects([sound]);
      await finishLoading();

      const warnedMessages = warn.mock.calls.map(([message]) => message);
      expect(warnedMessages).toEqual(["効果音を読み込めない: /tap.flac"]);
    });

    describe("失敗した後に読み込めるようになった場合", () => {
      beforeEach(async () => {
        soundEffects.prepareSoundEffects([sound]);
        await finishLoading();
        fetch.failing.clear();
      });

      test("もう一度呼ぶと読み直し、鳴らせるようにすること", async () => {
        soundEffects.prepareSoundEffects([sound]);
        await finishLoading();
        soundEffects.playSound(sound);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(getStartedSources()).toHaveLength(1);
      });
    });
  });

  describe("鳴らさない設定の場合", () => {
    let soundEffects: Awaited<ReturnType<typeof importSoundEffects>>;
    let fetch: ReturnType<typeof stubFetch>;
    let sound: SoundEffect;

    beforeEach(async () => {
      stubWebAudio();
      fetch = stubFetch();
      soundEffects = await importSoundEffects();
      soundEffects.setSoundEffectsEnabled(false);
      sound = soundEffects.defineSoundEffect("/tap.flac");
    });

    test("音声ファイルを読み込まないこと", () => {
      soundEffects.prepareSoundEffects([sound]);

      expect(fetch).not.toHaveBeenCalled();
    });

    describe("呼んだ後に鳴らす設定へ変えた場合", () => {
      beforeEach(async () => {
        soundEffects.prepareSoundEffects([sound]);
        soundEffects.setSoundEffectsEnabled(true);
        await finishLoading();
      });

      test("読み込み、鳴らせるようにすること", () => {
        soundEffects.playSound(sound);

        expect(fetch).toHaveBeenCalledExactlyOnceWith("/tap.flac");
        expect(getStartedSources()).toHaveLength(1);
      });
    });
  });
});

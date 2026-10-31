import type { SoundTone } from "@/lib/sound-effects";

type SoundEffects = typeof import("@/lib/sound-effects");
type SoundEffectsSetting = typeof import("@/lib/sound-effects-setting");

function createFakeOscillator() {
  return {
    type: "sine" as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn<(value: number, time: number) => void>(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    addEventListener: vi.fn(),
    start: vi.fn<(when: number) => void>(),
    stop: vi.fn(),
  };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "suspended";
  currentTime = 10;
  destination = {};
  oscillators: ReturnType<typeof createFakeOscillator>[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator() {
    const oscillator = createFakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  gains: ReturnType<typeof createFakeGain>[] = [];

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

function createFakeGain() {
  return {
    gain: {
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn<(target: number, time: number) => void>(),
      cancelScheduledValues: vi.fn(),
      linearRampToValueAtTime: vi.fn<(value: number, time: number) => void>(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

const tones: SoundTone[] = [
  { waveform: "triangle", frequency: 440, durationMs: 100, volume: 0.1 },
  {
    waveform: "sine",
    frequency: 660,
    offsetMs: 50,
    durationMs: 100,
    volume: 0.1,
  },
];

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

afterEach(() => {
  FakeAudioContext.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("playSound", () => {
  describe("Web Audio API が無い環境の場合", () => {
    let soundEffects: SoundEffects;

    beforeEach(async () => {
      vi.stubGlobal("AudioContext", undefined);
      soundEffects = await importSoundEffects();
    });

    test("何もせずに終わること", () => {
      const act = () => soundEffects.playSound(tones);

      expect(act).not.toThrow();
    });
  });

  describe("Web Audio API がある環境の場合", () => {
    let soundEffects: SoundEffects;

    beforeEach(async () => {
      vi.stubGlobal("AudioContext", FakeAudioContext);
      soundEffects = await importSoundEffects();
    });

    test("止まっている AudioContext を動かし、音ごとに遅らせた時刻から鳴らすこと", () => {
      soundEffects.playSound(tones, { delayMs: 500 });

      const [context] = FakeAudioContext.instances;
      expect(context?.resume).toHaveBeenCalled();
      expect(
        context?.oscillators.map(({ type, start }) => [
          type,
          start.mock.calls[0]?.[0],
        ]),
      ).toEqual([
        ["triangle", 10.5],
        ["sine", 10.55],
      ]);
    });
  });

  describe("揺らぎを付けた場合", () => {
    let soundEffects: SoundEffects;

    beforeEach(async () => {
      vi.stubGlobal("AudioContext", FakeAudioContext);
      vi.spyOn(Math, "random").mockReturnValue(1);
      soundEffects = await importSoundEffects();
    });

    test("一つの効果音の音すべてを、同じ幅だけ高く大きくして鳴らすこと", () => {
      soundEffects.playSound(tones, {
        variation: { pitchCents: 1200, volumeRatio: 0.5 },
      });

      const [context] = FakeAudioContext.instances;
      const frequencies = context?.oscillators.map(
        ({ frequency }) => frequency.setValueAtTime.mock.calls[0]?.[0],
      );
      const peakVolumes = context?.gains
        .slice(1)
        .map(({ gain }) => gain.linearRampToValueAtTime.mock.calls[0]?.[0]);
      expect(frequencies).toEqual([880, 1320]);
      expect(peakVolumes).toEqual([expect.closeTo(0.15), expect.closeTo(0.15)]);
    });
  });

  describe("鳴らさない設定の場合", () => {
    let soundEffects: Awaited<ReturnType<typeof importSoundEffects>>;

    beforeEach(async () => {
      vi.stubGlobal("AudioContext", FakeAudioContext);
      soundEffects = await importSoundEffects();
      soundEffects.setSoundEffectsEnabled(false);
    });

    test("AudioContext を作らないこと", () => {
      soundEffects.playSound(tones);

      expect(FakeAudioContext.instances).toEqual([]);
    });
  });

  describe("鳴らしている間に鳴らさない設定へ切り替えた場合", () => {
    let soundEffects: Awaited<ReturnType<typeof importSoundEffects>>;

    beforeEach(async () => {
      vi.stubGlobal("AudioContext", FakeAudioContext);
      soundEffects = await importSoundEffects();
      soundEffects.playSound(tones);
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

describe("prepareSoundEffects", () => {
  beforeEach(async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const soundEffects = await importSoundEffects();
    soundEffects.prepareSoundEffects();
  });

  test("利用者が操作するまで AudioContext を作らないこと", () => {
    const contexts = FakeAudioContext.instances;

    expect(contexts).toEqual([]);
  });

  test("利用者の操作で AudioContext を作って動かすこと", () => {
    window.dispatchEvent(new Event("pointerdown"));

    expect(FakeAudioContext.instances[0]?.resume).toHaveBeenCalled();
  });
});

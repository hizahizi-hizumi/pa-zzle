import type { SoundTone } from "@/lib/sound-effects";

type SoundEffects = typeof import("@/lib/sound-effects");

function createFakeOscillator() {
  return {
    type: "sine" as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
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

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
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

/** AudioContext を一つだけ持つモジュールの状態を、テストごとに作り直して読み込む。 */
async function importSoundEffects(): Promise<SoundEffects> {
  vi.resetModules();
  return import("@/lib/sound-effects");
}

afterEach(() => {
  FakeAudioContext.instances = [];
  vi.unstubAllGlobals();
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

  describe("鳴らさない設定の場合", () => {
    let soundEffects: SoundEffects;

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

import {
  createStoredVolumeSetting,
  getVolumeGain,
  type VolumeSetting,
} from "@/lib/stored-volume-setting";

const storageKey = "pa-zzle.test-volume.v1";
const legacyEnabledStorageKey = "pa-zzle.test.v1";

/** 端末に保存した値を、はじめて読む設定を作る。 */
function createSetting(): VolumeSetting {
  return createStoredVolumeSetting({ storageKey, legacyEnabledStorageKey });
}

function readStored(): unknown {
  const stored = window.localStorage.getItem(storageKey);
  return stored === null ? null : JSON.parse(stored);
}

afterEach(() => {
  window.localStorage.clear();
});

describe("getVolume", () => {
  const cases = [
    ["何も保存していない", null, null, 5],
    ["音量を保存した", { volume: 3, unmutedVolume: 3 }, null, 3],
    ["消音した音量を保存した", { volume: 0, unmutedVolume: 8 }, null, 0],
    [
      "音量と以前の鳴らさない設定を保存した",
      { volume: 3, unmutedVolume: 3 },
      { enabled: false },
      3,
    ],
    ["以前の鳴らさない設定だけを保存した", null, { enabled: false }, 0],
    ["以前の鳴らす設定だけを保存した", null, { enabled: true }, 5],
    ["以前の設定として形の違う値を保存した", null, { enabled: "no" }, 5],
    ["範囲を超える音量を保存した", { volume: 11, unmutedVolume: 6 }, null, 5],
    ["整数でない音量を保存した", { volume: 2.5, unmutedVolume: 6 }, null, 5],
    ["戻す音量が 0 の値を保存した", { volume: 0, unmutedVolume: 0 }, null, 5],
  ] as const;

  describe.each(cases)("%s端末の場合", (_, stored, legacyStored, expected) => {
    let setting: VolumeSetting;

    beforeEach(() => {
      if (stored !== null) {
        window.localStorage.setItem(storageKey, JSON.stringify(stored));
      }
      if (legacyStored !== null) {
        window.localStorage.setItem(
          legacyEnabledStorageKey,
          JSON.stringify(legacyStored),
        );
      }
      setting = createSetting();
    });

    test(`${expected} を返すこと`, () => {
      const volume = setting.getVolume();

      expect(volume).toBe(expected);
    });
  });

  describe("JSON として読めない値を保存した端末の場合", () => {
    let setting: VolumeSetting;

    beforeEach(() => {
      window.localStorage.setItem(storageKey, "{");
      setting = createSetting();
    });

    test("初期の音量を返すこと", () => {
      const volume = setting.getVolume();

      expect(volume).toBe(5);
    });
  });

  describe("以前の鳴らさない設定だけを保存した端末で消音を戻した場合", () => {
    let setting: VolumeSetting;

    beforeEach(() => {
      window.localStorage.setItem(
        legacyEnabledStorageKey,
        JSON.stringify({ enabled: false }),
      );
      setting = createSetting();
    });

    test("初期の音量に戻すこと", () => {
      setting.toggleMuted();

      expect(setting.getVolume()).toBe(5);
    });
  });
});

describe("setVolume", () => {
  let setting: VolumeSetting;
  let onChange: () => void;

  beforeEach(() => {
    setting = createSetting();
    onChange = vi.fn();
    setting.subscribe(onChange);
  });

  test("音量を変えて保存し、購読している側へ知らせること", () => {
    setting.setVolume(2);

    expect(setting.getVolume()).toBe(2);
    expect(readStored()).toEqual({ volume: 2, unmutedVolume: 5 });
    expect(onChange).toHaveBeenCalledOnce();
  });

  test("範囲の外の値は範囲に収めた整数にすること", () => {
    setting.setVolume(14.2);

    expect(setting.getVolume()).toBe(10);
  });

  test("変えた音量を次に開いたときも引き継ぐこと", () => {
    setting.setVolume(2);

    const reopened = createSetting();

    expect(reopened.getVolume()).toBe(2);
  });

  describe("動かしている途中で 0 にした場合", () => {
    beforeEach(() => {
      setting.setVolume(0);
    });

    test("消音を戻すと、その前に選び終えた音量へ戻すこと", () => {
      setting.toggleMuted();

      expect(setting.getVolume()).toBe(5);
    });
  });
});

describe("commitVolume", () => {
  let setting: VolumeSetting;

  beforeEach(() => {
    setting = createSetting();
  });

  test("選び終えた音量に変えること", () => {
    setting.commitVolume(4);

    expect(setting.getVolume()).toBe(4);
  });

  describe("音量を選び終えてから 0 を選び終えた場合", () => {
    beforeEach(() => {
      setting.commitVolume(4);
      setting.commitVolume(0);
    });

    test("消音を戻すと、0 の前に選び終えた音量へ戻すこと", () => {
      setting.toggleMuted();

      expect(setting.getVolume()).toBe(4);
    });
  });
});

describe("toggleMuted", () => {
  let setting: VolumeSetting;

  beforeEach(() => {
    setting = createSetting();
    setting.commitVolume(3);
  });

  test("鳴らしていれば 0 にし、戻す音量と一緒に保存すること", () => {
    setting.toggleMuted();

    expect(setting.getVolume()).toBe(0);
    expect(readStored()).toEqual({ volume: 0, unmutedVolume: 3 });
  });

  describe("消音して開き直した場合", () => {
    let reopened: VolumeSetting;

    beforeEach(() => {
      setting.toggleMuted();
      reopened = createSetting();
    });

    test("消音する前の音量へ戻すこと", () => {
      reopened.toggleMuted();

      expect(reopened.getVolume()).toBe(3);
    });
  });
});

describe("subscribe", () => {
  let setting: VolumeSetting;
  let onChange: () => void;

  beforeEach(() => {
    setting = createSetting();
    setting.getVolume();
    onChange = vi.fn();
    setting.subscribe(onChange);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ volume: 1, unmutedVolume: 1 }),
    );
  });

  test("別のタブで変えた音量を読み直して知らせること", () => {
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));

    expect(setting.getVolume()).toBe(1);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("getVolumeGain", () => {
  const cases = [
    [0, 0],
    [5, 0.5],
    [6, 0.72],
    [10, 2],
  ] as const;

  test.each(cases)(
    "音量 %i を、最大の大きさに音量の割合の二乗を掛けた大きさにすること",
    (volume, expected) => {
      const gain = getVolumeGain(volume, 2);

      expect(gain).toBeCloseTo(expected);
    },
  );
});

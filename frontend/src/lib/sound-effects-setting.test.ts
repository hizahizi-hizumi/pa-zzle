type SoundEffectsSetting = typeof import("@/lib/sound-effects-setting");

const storageKey = "pa-zzle.sound-effects.v1";

/** 読み込んだ設定を覚えておくモジュールの状態を、テストごとに作り直して読み込む。 */
async function importSoundEffectsSetting(): Promise<SoundEffectsSetting> {
  vi.resetModules();
  return import("@/lib/sound-effects-setting");
}

afterEach(() => {
  window.localStorage.clear();
});

describe("isSoundEffectsEnabled", () => {
  const cases = [
    ["保存した値が無い", null, true],
    ["鳴らさないと保存した", JSON.stringify({ enabled: false }), false],
    ["鳴らすと保存した", JSON.stringify({ enabled: true }), true],
    ["JSON として読めない値を保存した", "{", true],
    ["形の違う値を保存した", JSON.stringify({ enabled: "no" }), true],
  ] as const;

  describe.each(cases)("%s端末の場合", (_, stored, expected) => {
    let setting: SoundEffectsSetting;

    beforeEach(async () => {
      if (stored !== null) {
        window.localStorage.setItem(storageKey, stored);
      }
      setting = await importSoundEffectsSetting();
    });

    test(`${expected} を返すこと`, () => {
      const enabled = setting.isSoundEffectsEnabled();

      expect(enabled).toBe(expected);
    });
  });
});

describe("setSoundEffectsEnabled", () => {
  let setting: SoundEffectsSetting;
  let onChange: () => void;

  beforeEach(async () => {
    setting = await importSoundEffectsSetting();
    onChange = vi.fn();
    setting.subscribeSoundEffectsEnabled(onChange);
  });

  test("選んだ設定を返し、購読している側へ知らせること", () => {
    setting.setSoundEffectsEnabled(false);

    expect(setting.isSoundEffectsEnabled()).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test("選んだ設定を次に開いたときも引き継ぐこと", async () => {
    setting.setSoundEffectsEnabled(false);

    const reopened = await importSoundEffectsSetting();

    expect(reopened.isSoundEffectsEnabled()).toBe(false);
  });
});

describe("subscribeSoundEffectsEnabled", () => {
  let setting: SoundEffectsSetting;
  let onChange: () => void;

  beforeEach(async () => {
    setting = await importSoundEffectsSetting();
    setting.isSoundEffectsEnabled();
    onChange = vi.fn();
    setting.subscribeSoundEffectsEnabled(onChange);
    window.localStorage.setItem(storageKey, JSON.stringify({ enabled: false }));
  });

  test("別のタブで変えた設定を読み直して知らせること", () => {
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));

    expect(setting.isSoundEffectsEnabled()).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

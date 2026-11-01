type SoundEffectsSetting = typeof import("@/lib/sound-effects-setting");

const storageKey = "pa-zzle.sound-effects-volume.v1";
const legacyEnabledStorageKey = "pa-zzle.sound-effects.v1";

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
    ["何も保存していない", null, null, true],
    ["音量を 0 と保存した", { volume: 0, unmutedVolume: 60 }, null, false],
    [
      "以前の効果音をオフにした設定だけを保存した",
      null,
      { enabled: false },
      false,
    ],
    [
      "以前の効果音をオンにした設定だけを保存した",
      null,
      { enabled: true },
      true,
    ],
  ] as const;

  describe.each(cases)("%s端末の場合", (_, stored, legacyStored, expected) => {
    let setting: SoundEffectsSetting;

    beforeEach(async () => {
      if (stored !== null) {
        window.localStorage.setItem(storageKey, JSON.stringify(stored));
      }
      if (legacyStored !== null) {
        window.localStorage.setItem(
          legacyEnabledStorageKey,
          JSON.stringify(legacyStored),
        );
      }
      setting = await importSoundEffectsSetting();
    });

    test(`${expected} を返すこと`, () => {
      const enabled = setting.isSoundEffectsEnabled();

      expect(enabled).toBe(expected);
    });
  });
});

describe("soundEffectsVolumeSetting", () => {
  let setting: SoundEffectsSetting;

  beforeEach(async () => {
    setting = await importSoundEffectsSetting();
  });

  test("選んだ音量を効果音の音量として保存すること", () => {
    setting.soundEffectsVolumeSetting.commitVolume(30);

    expect(window.localStorage.getItem(storageKey)).toBe(
      JSON.stringify({ volume: 30, unmutedVolume: 30 }),
    );
  });
});

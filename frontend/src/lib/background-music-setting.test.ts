type BackgroundMusicSetting = typeof import("@/lib/background-music-setting");

const storageKey = "pa-zzle.background-music-volume.v1";
const legacyEnabledStorageKey = "pa-zzle.background-music.v1";

/** 読み込んだ設定を覚えておくモジュールの状態を、テストごとに作り直して読み込む。 */
async function importBackgroundMusicSetting(): Promise<BackgroundMusicSetting> {
  vi.resetModules();
  return import("@/lib/background-music-setting");
}

afterEach(() => {
  window.localStorage.clear();
});

describe("isBackgroundMusicEnabled", () => {
  const cases = [
    ["何も保存していない", null, null, true],
    ["音量を 0 と保存した", { volume: 0, unmutedVolume: 6 }, null, false],
    [
      "以前のBGMをオフにした設定だけを保存した",
      null,
      { enabled: false },
      false,
    ],
    ["以前のBGMをオンにした設定だけを保存した", null, { enabled: true }, true],
  ] as const;

  describe.each(cases)("%s端末の場合", (_, stored, legacyStored, expected) => {
    let setting: BackgroundMusicSetting;

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
      setting = await importBackgroundMusicSetting();
    });

    test(`${expected} を返すこと`, () => {
      const enabled = setting.isBackgroundMusicEnabled();

      expect(enabled).toBe(expected);
    });
  });
});

describe("backgroundMusicVolumeSetting", () => {
  let setting: BackgroundMusicSetting;

  beforeEach(async () => {
    setting = await importBackgroundMusicSetting();
  });

  test("選んだ音量をBGMの音量として保存すること", () => {
    setting.backgroundMusicVolumeSetting.commitVolume(3);

    expect(window.localStorage.getItem(storageKey)).toBe(
      JSON.stringify({ volume: 3, unmutedVolume: 3 }),
    );
  });
});

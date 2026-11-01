type BackgroundMusicSetting = typeof import("@/lib/background-music-setting");

const storageKey = "pa-zzle.background-music.v1";

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
    ["保存した値が無い", null, true],
    ["流さないと保存した", JSON.stringify({ enabled: false }), false],
    ["流すと保存した", JSON.stringify({ enabled: true }), true],
    ["JSON として読めない値を保存した", "{", true],
  ] as const;

  describe.each(cases)("%s端末の場合", (_, stored, expected) => {
    let setting: BackgroundMusicSetting;

    beforeEach(async () => {
      if (stored !== null) {
        window.localStorage.setItem(storageKey, stored);
      }
      setting = await importBackgroundMusicSetting();
    });

    test(`${expected} を返すこと`, () => {
      const enabled = setting.isBackgroundMusicEnabled();

      expect(enabled).toBe(expected);
    });
  });

  describe("効果音を鳴らさないと保存した端末の場合", () => {
    let setting: BackgroundMusicSetting;

    beforeEach(async () => {
      window.localStorage.setItem(
        "pa-zzle.sound-effects.v1",
        JSON.stringify({ enabled: false }),
      );
      setting = await importBackgroundMusicSetting();
    });

    test("効果音の設定とは別に、流す設定を返すこと", () => {
      const enabled = setting.isBackgroundMusicEnabled();

      expect(enabled).toBe(true);
    });
  });
});

describe("setBackgroundMusicEnabled", () => {
  let setting: BackgroundMusicSetting;
  let onChange: () => void;

  beforeEach(async () => {
    setting = await importBackgroundMusicSetting();
    onChange = vi.fn();
    setting.subscribeBackgroundMusicEnabled(onChange);
  });

  test("選んだ設定を返し、購読している側へ知らせること", () => {
    setting.setBackgroundMusicEnabled(false);

    expect(setting.isBackgroundMusicEnabled()).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test("選んだ設定を次に開いたときも引き継ぐこと", async () => {
    setting.setBackgroundMusicEnabled(false);

    const reopened = await importBackgroundMusicSetting();

    expect(reopened.isBackgroundMusicEnabled()).toBe(false);
  });
});

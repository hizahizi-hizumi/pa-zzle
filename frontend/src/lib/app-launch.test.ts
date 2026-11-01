import type { AppLaunchTitle } from "@/lib/app-launch";
import type { SoundEffect } from "@/lib/sound-effects";

type AppLaunch = typeof import("@/lib/app-launch");
type SoundEffectsSetting = typeof import("@/lib/sound-effects-setting");

type SoundLoading = {
  reportProgress: (progress: number) => void;
  finish: () => void;
};

/** 読み込みを始めたら、その進みと終わりをテストから進められるようにする。 */
const { soundLoadings, loadSoundEffects } = vi.hoisted(() => {
  const soundLoadings: SoundLoading[] = [];
  const loadSoundEffects = vi.fn(
    (
      _sounds: readonly SoundEffect[],
      onProgress?: (progress: number) => void,
    ) =>
      new Promise<void>((resolve) => {
        soundLoadings.push({
          reportProgress: (progress) => onProgress?.(progress),
          finish: resolve,
        });
      }),
  );
  return { soundLoadings, loadSoundEffects };
});

vi.mock("@/lib/sound-effects", () => ({ loadSoundEffects }));

const sounds: readonly SoundEffect[] = [
  { url: "/select.flac" },
  { url: "/tap.flac" },
];

/** 一度だけ始められるモジュールの状態を、テストごとに作り直して読み込む。 */
async function importAppLaunch(): Promise<
  AppLaunch & Pick<SoundEffectsSetting, "setSoundEffectsEnabled">
> {
  vi.resetModules();
  const [appLaunch, setting] = await Promise.all([
    import("@/lib/app-launch"),
    import("@/lib/sound-effects-setting"),
  ]);
  return {
    ...appLaunch,
    setSoundEffectsEnabled: setting.setSoundEffectsEnabled,
  };
}

/** 読み込みの終わりを受け取った後の状態まで進める。 */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  soundLoadings.length = 0;
  loadSoundEffects.mockClear();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("startAppLaunch", () => {
  describe("タイトルを出さない場合", () => {
    let appLaunch: AppLaunch;

    beforeEach(async () => {
      appLaunch = await importAppLaunch();
    });

    test("タイトルを出さずに、効果音すべての読み込みを始めること", () => {
      appLaunch.startAppLaunch({ showTitle: false, sounds });

      const title = appLaunch.getAppLaunchTitle();
      expect(title).toEqual({ status: "hidden" });
      expect(loadSoundEffects).toHaveBeenCalledWith(sounds);
    });
  });

  describe("タイトルを出す場合", () => {
    let appLaunch: AppLaunch;

    beforeEach(async () => {
      appLaunch = await importAppLaunch();
      appLaunch.startAppLaunch({ showTitle: true, sounds });
    });

    test("効果音すべての読み込みを待ち、進みを見せること", () => {
      soundLoadings[0]?.reportProgress(0.5);

      const title = appLaunch.getAppLaunchTitle();
      expect(loadSoundEffects).toHaveBeenCalledWith(
        sounds,
        expect.any(Function),
      );
      expect(title).toEqual({ status: "loading", progress: 0.5 });
    });

    test("読み込みが済んだら入れるようにすること", async () => {
      soundLoadings[0]?.finish();
      await settle();

      const title = appLaunch.getAppLaunchTitle();
      expect(title).toEqual({ status: "ready" });
    });

    test("上限の直前までは待つこと", async () => {
      await vi.advanceTimersByTimeAsync(
        appLaunch._private.SOUND_LOADING_LIMIT_MS - 1,
      );

      const title = appLaunch.getAppLaunchTitle();
      expect(title.status).toBe("loading");
    });

    test("上限まで待っても済まなければ、待つのをやめて入れるようにすること", async () => {
      await vi.advanceTimersByTimeAsync(
        appLaunch._private.SOUND_LOADING_LIMIT_MS,
      );

      const title = appLaunch.getAppLaunchTitle();
      expect(title).toEqual({ status: "ready" });
    });

    test("待つのをやめた後に届いた進みでは、入れる状態を変えないこと", async () => {
      await vi.advanceTimersByTimeAsync(
        appLaunch._private.SOUND_LOADING_LIMIT_MS,
      );
      soundLoadings[0]?.reportProgress(0.9);

      const title = appLaunch.getAppLaunchTitle();
      expect(title).toEqual({ status: "ready" });
    });

    test("2回目は何もしないこと", () => {
      appLaunch.startAppLaunch({ showTitle: false, sounds });

      const title = appLaunch.getAppLaunchTitle();
      expect(title.status).toBe("loading");
      expect(loadSoundEffects).toHaveBeenCalledOnce();
    });
  });

  describe("効果音を鳴らさない設定の場合", () => {
    let appLaunch: AppLaunch;

    beforeEach(async () => {
      const imported = await importAppLaunch();
      imported.setSoundEffectsEnabled(false);
      appLaunch = imported;
    });

    test("待たずに入れるようにすること", () => {
      appLaunch.startAppLaunch({ showTitle: true, sounds });

      const title = appLaunch.getAppLaunchTitle();
      expect(title).toEqual({ status: "ready" });
    });
  });

  describe("待っている間に効果音を鳴らさない設定へ変えた場合", () => {
    let appLaunch: Awaited<ReturnType<typeof importAppLaunch>>;

    beforeEach(async () => {
      appLaunch = await importAppLaunch();
      appLaunch.startAppLaunch({ showTitle: true, sounds });
    });

    test("待つのをやめて入れるようにすること", () => {
      appLaunch.setSoundEffectsEnabled(false);

      const title = appLaunch.getAppLaunchTitle();
      expect(title).toEqual({ status: "ready" });
    });
  });
});

describe("enterApp", () => {
  describe("読み込みを待っている場合", () => {
    let appLaunch: AppLaunch;
    let notifiedTitles: AppLaunchTitle[];

    beforeEach(async () => {
      appLaunch = await importAppLaunch();
      appLaunch.startAppLaunch({ showTitle: true, sounds });
      notifiedTitles = [];
      appLaunch.subscribeAppLaunchTitle(() => {
        notifiedTitles.push(appLaunch.getAppLaunchTitle());
      });
    });

    test("タイトルを閉じ、後から読み込みが済んでも出し直さないこと", async () => {
      appLaunch.enterApp();
      soundLoadings[0]?.finish();
      await settle();

      expect(notifiedTitles).toEqual([{ status: "hidden" }]);
    });
  });
});

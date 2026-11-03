import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useNavigate } from "react-router";

import {
  type AppBackgroundMusicScene,
  type AppBackgroundMusicTracks,
  getAppBackgroundMusicScene,
  type PlayScreenMusicState,
  selectAppBackgroundMusic,
  selectAppBackgroundMusicTransition,
  useAppBackgroundMusic,
  usePlayScreenMusicState,
} from "@/components/app-background-music";
import {
  type BackgroundMusicTrack,
  type BackgroundMusicTransition,
  playBackgroundMusic,
} from "@/lib/background-music";

vi.mock("@/lib/background-music", () => ({
  defineBackgroundMusicTrack: (track: BackgroundMusicTrack) => track,
  playBackgroundMusic: vi.fn(),
  prepareBackgroundMusic: vi.fn(),
}));

const playPath = "/puzzles/nanpure/play/3";

function createWrapper(path: string) {
  return function RouterWrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };
}

function renderPlayScreen(initialProps: PlayScreenMusicState) {
  return renderHook(
    ({ progress, resultShown }: PlayScreenMusicState) =>
      usePlayScreenMusicState(progress, resultShown),
    { initialProps },
  );
}

/** 最後に流すよう頼んだ曲の URL と、掛ける大きさ。 */
function getLastPlayedMusic() {
  const [track, options] = vi.mocked(playBackgroundMusic).mock.lastCall ?? [];
  return { url: track?.url ?? null, gain: options?.gain };
}

/** 最後に流すよう頼んだ曲の、切り替え方の種類。 */
function getLastTransitionKind() {
  const [, options] = vi.mocked(playBackgroundMusic).mock.lastCall ?? [];
  return options?.transition?.kind;
}

/** 画面に合わせて BGM を流し、画面を移れるようにする。 */
function renderAppBackgroundMusic(path: string) {
  return renderHook(
    () => {
      useAppBackgroundMusic();
      return useNavigate();
    },
    { wrapper: createWrapper(path) },
  );
}

afterEach(() => {
  vi.mocked(playBackgroundMusic).mockClear();
});

describe("getAppBackgroundMusicScene", () => {
  const solving: PlayScreenMusicState = {
    progress: "playing",
    resultShown: false,
  };
  const cases = [
    ["ホーム", "/", "home"],
    ["ゲームのホーム", "/puzzles/nanpure", "home"],
    ["記録", "/records", "home"],
    ["ページが見つからない画面", "/no-such-page", "home"],
    ["プレイ画面", playPath, "play"],
    ["記録の結果画面", "/puzzles/nanpure/result/record-1", "result"],
  ] as const;

  test.each(cases)("%sの場面を返すこと", (_, pathname, expected) => {
    const scene = getAppBackgroundMusicScene(pathname, solving);

    expect(scene).toBe(expected);
  });

  describe("プレイ画面の場合", () => {
    const playScreenCases = [
      {
        situation: "盤面を解いている",
        progress: "playing",
        resultShown: false,
        expected: "play",
      },
      {
        situation: "完成演出を見せている",
        progress: "clearing",
        resultShown: false,
        expected: "silent",
      },
      {
        situation: "記録の結果画面へ移るのを待っている",
        progress: "result",
        resultShown: false,
        expected: "silent",
      },
      {
        situation: "その場で結果画面を出している",
        progress: "result",
        resultShown: true,
        expected: "result",
      },
    ] as const;

    test.each(playScreenCases)(
      "$situation間は $expected の場面を返すこと",
      ({ progress, resultShown, expected }) => {
        const scene = getAppBackgroundMusicScene(playPath, {
          progress,
          resultShown,
        });

        expect(scene).toBe(expected);
      },
    );
  });
});

describe("selectAppBackgroundMusic", () => {
  const tracks: AppBackgroundMusicTracks = {
    home: { url: "/home.mp3", loopLength: 48_000 },
    play: { url: "/play.mp3", loopLength: 48_000 },
    result: { url: "/result.mp3", loopLength: 48_000 },
  };
  const cases = [
    ["home", tracks.home],
    ["play", tracks.play],
    ["result", tracks.result],
  ] as const;

  test.each(cases)("%s の場面で流す曲を選ぶこと", (scene, expected) => {
    const music = selectAppBackgroundMusic(scene, tracks);

    expect(music?.track).toBe(expected);
  });

  test("silent の場面では曲を選ばないこと", () => {
    const music = selectAppBackgroundMusic("silent", tracks);

    expect(music).toBeNull();
  });

  test("プレイ中の曲を、ホームと結果の曲より小さく流すこと", () => {
    const home = selectAppBackgroundMusic("home", tracks);
    const play = selectAppBackgroundMusic("play", tracks);
    const result = selectAppBackgroundMusic("result", tracks);

    expect(play?.gain).toBeGreaterThan(0);
    expect(play?.gain).toBeLessThan(home?.gain ?? 0);
    expect(play?.gain).toBeLessThan(result?.gain ?? 0);
  });
});

describe("selectAppBackgroundMusicTransition", () => {
  const cases: {
    situation: string;
    previousScene: AppBackgroundMusicScene | null;
    scene: AppBackgroundMusicScene;
    expected: BackgroundMusicTransition["kind"];
  }[] = [
    {
      situation: "ホームからプレイに入る",
      previousScene: "home",
      scene: "play",
      expected: "break",
    },
    {
      situation: "結果からプレイに入る",
      previousScene: "result",
      scene: "play",
      expected: "break",
    },
    {
      situation: "プレイ画面を開いて初めて流す",
      previousScene: null,
      scene: "play",
      expected: "break",
    },
    {
      situation: "プレイ中に曲だけを替える",
      previousScene: "play",
      scene: "play",
      expected: "crossfade",
    },
    {
      situation: "プレイからホームへ戻る",
      previousScene: "play",
      scene: "home",
      expected: "crossfade",
    },
    {
      situation: "クリアして曲を止める",
      previousScene: "play",
      scene: "silent",
      expected: "crossfade",
    },
    {
      situation: "結果からホームへ戻る",
      previousScene: "result",
      scene: "home",
      expected: "crossfade",
    },
    {
      situation: "ホームを開いて初めて流す",
      previousScene: null,
      scene: "home",
      expected: "crossfade",
    },
  ];

  test.each(cases)(
    "$situation切り替えを $expected にすること",
    ({ previousScene, scene, expected }) => {
      const transition = selectAppBackgroundMusicTransition(
        previousScene,
        scene,
      );

      expect(transition.kind).toBe(expected);
    },
  );
});

describe("useAppBackgroundMusic", () => {
  describe("ゲームのホームからプレイ画面に移った場合", () => {
    let navigate: ReturnType<typeof useNavigate>;

    beforeEach(() => {
      navigate = renderAppBackgroundMusic("/puzzles/nanpure").result.current;
    });

    test("ホームの曲を引いて間を空けてから、プレイ中の曲を流すこと", () => {
      act(() => navigate(playPath));

      expect(getLastPlayedMusic().url).toMatch(/play.*\.mp3$/);
      expect(getLastTransitionKind()).toBe("break");
    });

    describe("プレイ画面から戻った場合", () => {
      beforeEach(() => {
        act(() => navigate(playPath));
      });

      test("ホームの曲へクロスフェードすること", () => {
        act(() => navigate("/puzzles/nanpure"));

        expect(getLastPlayedMusic().url).toMatch(/home\.mp3$/);
        expect(getLastTransitionKind()).toBe("crossfade");
      });
    });
  });

  describe("ホームからゲームのホームに移った場合", () => {
    let navigate: ReturnType<typeof useNavigate>;

    beforeEach(() => {
      navigate = renderAppBackgroundMusic("/").result.current;
      vi.mocked(playBackgroundMusic).mockClear();
    });

    test("ホームの曲を流し直さないこと", () => {
      act(() => navigate("/puzzles/nanpure"));

      expect(playBackgroundMusic).not.toHaveBeenCalled();
    });
  });

  describe("プレイ画面で盤面を解いている場合", () => {
    let playScreen: ReturnType<typeof renderPlayScreen>;

    beforeEach(() => {
      renderHook(useAppBackgroundMusic, { wrapper: createWrapper(playPath) });
      playScreen = renderPlayScreen({
        progress: "playing",
        resultShown: false,
      });
    });

    test("プレイ中の曲を、ホームの曲より小さく流すこと", () => {
      const music = getLastPlayedMusic();

      expect(music.url).toMatch(/play.*\.mp3$/);
      expect(music.gain).toBeLessThan(1);
    });

    test("新しい問題でプレイ画面を描き直しても、曲を流し直さないこと", () => {
      vi.mocked(playBackgroundMusic).mockClear();

      playScreen.unmount();
      renderPlayScreen({ progress: "playing", resultShown: false });

      expect(playBackgroundMusic).not.toHaveBeenCalled();
    });

    test("クリアして完成演出が始まったら、曲を止めること", () => {
      playScreen.rerender({ progress: "clearing", resultShown: false });

      expect(getLastPlayedMusic().url).toBeNull();
    });

    describe("クリアしてその場で結果画面を出した場合", () => {
      beforeEach(() => {
        playScreen.rerender({ progress: "clearing", resultShown: false });
      });

      test("結果の曲を流すこと", () => {
        playScreen.rerender({ progress: "result", resultShown: true });

        expect(getLastPlayedMusic()).toEqual({
          url: expect.stringMatching(/result\.mp3$/),
          gain: 1,
        });
      });
    });
  });
});

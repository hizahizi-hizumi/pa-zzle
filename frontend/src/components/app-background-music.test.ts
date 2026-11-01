import {
  type AppBackgroundMusicTracks,
  getAppBackgroundMusicScene,
  selectAppBackgroundMusicTrack,
} from "@/components/app-background-music";

describe("getAppBackgroundMusicScene", () => {
  const cases = [
    ["ホーム", "/", "home"],
    ["難易度選択", "/puzzles/nanpure", "home"],
    ["記録", "/records", "home"],
    ["ページが見つからない画面", "/no-such-page", "home"],
    ["プレイ画面", "/puzzles/nanpure/play/3", "silent"],
    ["記録の結果画面", "/puzzles/nanpure/result/record-1", "result"],
  ] as const;

  test.each(cases)("%sの場面を返すこと", (_, pathname, expected) => {
    const scene = getAppBackgroundMusicScene(pathname, false);

    expect(scene).toBe(expected);
  });

  describe("プレイ画面がその場で結果画面を出している場合", () => {
    const pathname = "/puzzles/nanpure/play/3";

    test("結果の場面を返すこと", () => {
      const scene = getAppBackgroundMusicScene(pathname, true);

      expect(scene).toBe("result");
    });
  });
});

describe("selectAppBackgroundMusicTrack", () => {
  const tracks: AppBackgroundMusicTracks = {
    home: { url: "/home.mp3" },
    result: { url: "/result.mp3" },
  };
  const cases = [
    ["home", tracks.home],
    ["result", tracks.result],
    ["silent", null],
  ] as const;

  test.each(cases)("%s の場面で流す曲を選ぶこと", (scene, expected) => {
    const track = selectAppBackgroundMusicTrack(scene, tracks);

    expect(track).toBe(expected);
  });
});

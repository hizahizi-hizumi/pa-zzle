import gameSelectSoundUrl from "@/assets/sounds/game-select.flac";
import playStartSoundUrl from "@/assets/sounds/play-start.flac";
import resultRewardPerfectSoundUrl from "@/assets/sounds/result-reward-perfect.flac";
import { playSound, REPEATED_SOUND_VARIATION } from "@/lib/sound-effects";
import type { ZukanStamp } from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import {
  listZukanStampSoundCues,
  playZukanStampSound,
} from "@/zukan/ui/GameHomeScreen/zukan-stamp-sound";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  REPEATED_SOUND_VARIATION: { pitchCents: 30, volumeRatio: 0.12 },
}));

afterEach(() => {
  vi.mocked(playSound).mockClear();
});

function listCueUrls(stamp: ZukanStamp): string[] {
  return listZukanStampSoundCues(stamp).map(({ sound }) => sound.url);
}

describe("listZukanStampSoundCues", () => {
  describe("新しく clear で解いた場合", () => {
    const stamp: ZukanStamp = { level: "clear", isRaised: false };

    test("選ぶ音を、good より小さく、鳴らすたびに揺らして1つ鳴らすこと", () => {
      const [cue, ...rest] = listZukanStampSoundCues(stamp);
      const [goodCue] = listZukanStampSoundCues({
        level: "good",
        isRaised: false,
      });

      expect(rest).toEqual([]);
      expect(cue?.sound.url).toBe(gameSelectSoundUrl);
      expect(cue?.varies).toBe(true);
      expect(cue?.volume).toBeLessThan(goodCue?.volume ?? 0);
    });
  });

  describe("新しく good で解いた場合", () => {
    test("選ぶ音を clear より高くして1つ鳴らすこと", () => {
      const [cue, ...rest] = listZukanStampSoundCues({
        level: "good",
        isRaised: false,
      });

      expect(rest).toEqual([]);
      expect(cue?.sound.url).toBe(gameSelectSoundUrl);
      expect(cue?.playbackRate).toBeGreaterThan(1);
    });
  });

  describe("新しく great で解いた場合", () => {
    test("選ぶ音より重い始める音を鳴らすこと", () => {
      const urls = listCueUrls({ level: "great", isRaised: false });

      expect(urls).toEqual([playStartSoundUrl]);
    });
  });

  describe("段階が上がった場合", () => {
    const stamp: ZukanStamp = { level: "great", isRaised: true };

    test("選ぶ音を2つ、後の音を遅らせて高くして鳴らすこと", () => {
      const [first, second, ...rest] = listZukanStampSoundCues(stamp);

      expect(rest).toEqual([]);
      expect([first?.sound.url, second?.sound.url]).toEqual([
        gameSelectSoundUrl,
        gameSelectSoundUrl,
      ]);
      expect(second?.delayMs).toBeGreaterThan(first?.delayMs ?? 0);
      expect(second?.playbackRate).toBeGreaterThan(first?.playbackRate ?? 0);
    });
  });

  describe.each([
    ["新しく perfect で解いた", false],
    ["perfect へ上がった", true],
  ])("%s場合", (_, isRaised) => {
    test("始める音と、結果の報酬の perfect の音を重ねて鳴らすこと", () => {
      const urls = listCueUrls({ level: "perfect", isRaised });

      expect(urls).toEqual([playStartSoundUrl, resultRewardPerfectSoundUrl]);
    });

    test("報酬の音を、結果画面より小さく鳴らすこと", () => {
      const reward = listZukanStampSoundCues({
        level: "perfect",
        isRaised,
      }).find(({ sound }) => sound.url === resultRewardPerfectSoundUrl);

      expect(reward?.volume).toBeLessThan(1);
    });
  });
});

describe("playZukanStampSound", () => {
  test("段階が上がったマスの2つの音を、それぞれの遅れと高さで鳴らすこと", () => {
    playZukanStampSound({ level: "good", isRaised: true });
    const calls = vi.mocked(playSound).mock.calls.map(([sound, options]) => ({
      url: sound.url,
      delayMs: options?.delayMs,
      variation: options?.variation,
    }));

    expect(calls).toEqual([
      { url: gameSelectSoundUrl, delayMs: 0, variation: undefined },
      { url: gameSelectSoundUrl, delayMs: 80, variation: undefined },
    ]);
  });

  test("回数の多い新しく解いたマスの音を、揺らして鳴らすこと", () => {
    playZukanStampSound({ level: "clear", isRaised: false });
    const variation = vi.mocked(playSound).mock.calls[0]?.[1]?.variation;

    expect(variation).toEqual(REPEATED_SOUND_VARIATION);
  });
});

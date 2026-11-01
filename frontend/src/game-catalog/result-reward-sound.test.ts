import { renderHook } from "@testing-library/react";

import { getGameResultSound } from "@/components/game-result-sound";
import { useResultRewardSound } from "@/game-catalog/result-reward-sound";
import type { GameProgress } from "@/games/play";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

type RewardSoundProps = {
  progress: GameProgress;
  score: number | null;
};

function renderRewardSound(initialProps: RewardSoundProps) {
  return renderHook(
    ({ progress, score }: RewardSoundProps) =>
      useResultRewardSound(progress, score),
    { initialProps, reactStrictMode: true },
  );
}

afterEach(() => {
  vi.mocked(playSound).mockClear();
});

describe("useResultRewardSound", () => {
  describe("完成演出を終えて結果を受け取った場合", () => {
    const cases = [
      [100, "perfect"],
      [95, "great"],
      [85, "good"],
      [40, "clear"],
    ] as const;

    describe.each(cases)("評価点が %d の場合", (score, level) => {
      let rerender: (props: RewardSoundProps) => void;

      beforeEach(() => {
        ({ rerender } = renderRewardSound({ progress: "clearing", score }));
      });

      test(`${level} の報酬の音を一度だけ鳴らすこと`, () => {
        rerender({ progress: "result", score });
        rerender({ progress: "result", score });

        expect(playSound).toHaveBeenCalledOnce();
        expect(playSound).toHaveBeenCalledWith(getGameResultSound(level));
      });
    });
  });

  describe("画面を出した時点で結果を見せている場合", () => {
    let rerender: (props: RewardSoundProps) => void;

    beforeEach(() => {
      ({ rerender } = renderRewardSound({ progress: "result", score: 100 }));
    });

    test("鳴らさないこと", () => {
      rerender({ progress: "result", score: 100 });

      expect(playSound).not.toHaveBeenCalled();
    });
  });

  describe("盤面を完成させて完成演出を始めた場合", () => {
    let rerender: (props: RewardSoundProps) => void;

    beforeEach(() => {
      ({ rerender } = renderRewardSound({ progress: "playing", score: null }));
    });

    test("まだ鳴らさないこと", () => {
      rerender({ progress: "clearing", score: 100 });

      expect(playSound).not.toHaveBeenCalled();
    });
  });
});

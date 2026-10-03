import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { TsumeShogiResultScreen } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen";

const performance = {
  elapsedMs: 30_000,
  wrongCheckCount: 1,
  refutationViewCount: 2,
  returnCount: 1,
  undoCount: 3,
  restartCount: 0,
  illegalInputCount: 4,
  inputCount: 15,
};

// 誤王手の紛れの無い3手詰。基準時間は 8 + 2×4 + 3×2 = 22秒。
const result: TsumeShogiResult = {
  ...performance,
  workload: { plies: 3, rootChecks: 3, plausibleWrong: 0, deepDecoyCount: 0 },
  speedFullScoreMs: 22_000,
  speedZeroScoreMs: 66_000,
  timeDeltaMs: 8_000,
  score: { total: 80, breakdown: { accuracy: 15, speed: 65 } },
};

const handlers = {
  recordOutcomeNotice: null,
  onReplay: vi.fn(),
  onStartNewProblem: vi.fn(),
  onOpenRecords: vi.fn(),
  onChangeDifficulty: vi.fn(),
  onBackToHome: vi.fn(),
};

afterEach(cleanup);

describe("TsumeShogiResultScreen", () => {
  describe("問題集の問題を詰ませた場合", () => {
    beforeEach(() => {
      render(
        <TsumeShogiResultScreen
          difficultyLabel="レベル 1"
          result={result}
          {...handlers}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
      );
    });

    test("時間と基準時間との差・誤王手の回数を主要成績に示すこと", () => {
      const elapsed = screen.getByText("00:30");
      const delta = screen.getByText("基準 +00:08");
      const wrongCheckLabel = screen.getAllByText("誤王手");

      expect(elapsed).toBeTruthy();
      expect(delta).toBeTruthy();
      expect(wrongCheckLabel.length).toBeGreaterThan(0);
    });

    test("読みの確かさと速さの内訳を示すこと", () => {
      const accuracy = screen.getByText("15 / 20");
      const speed = screen.getByText("65 / 80");

      expect(accuracy).toBeTruthy();
      expect(speed).toBeTruthy();
    });

    test("基準時間の式から0の項を省いて示すこと", () => {
      const criteria = screen.getByText(/^基準時間00:22以内で80点/);

      expect(criteria.textContent).toContain(
        "基準時間は8秒 + 攻方の手2手 × 4秒 + 初手の王手3個 × 2秒です。",
      );
    });
  });
});

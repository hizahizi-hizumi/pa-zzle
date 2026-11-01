import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { GameResultScreen } from "@/components/GameResultScreen";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
});

function createProps(): ComponentProps<typeof GameResultScreen> {
  return {
    gameName: "テストパズル",
    difficultyLabel: "ふつう",
    pictogramSvg: "<svg></svg>",
    score: 82,
    metrics: [
      { label: "時間", value: "01:05", detail: "基準 +00:10" },
      { label: "ミス", value: "2回" },
    ],
    recordOutcomeNotice: <p>記録を保存しました</p>,
    scoreBreakdown: [{ label: "速さ", value: "30 / 40" }],
    scoreCriteria: [{ label: "速さ", description: "基準時間以内で満点。" }],
    onStartNewProblem: vi.fn(),
    onReplay: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    onOpenDiagnostics: vi.fn(),
  };
}

describe("GameResultScreen", () => {
  let props: ComponentProps<typeof GameResultScreen>;

  beforeEach(() => {
    props = createProps();
    render(<GameResultScreen {...props} />);
  });

  test("評価・記録・主要成績を結果画面にまとめて表示すること", () => {
    const resultScreen = screen.getByRole("region", { name: "プレイ結果" });
    const gameName = screen.getByText("テストパズル");
    const recordNotice = screen.getByText("記録を保存しました");
    const metricDetail = screen.getByText("基準 +00:10");

    expect(document.activeElement).toBe(resultScreen);
    expect(gameName).toBeTruthy();
    expect(recordNotice).toBeTruthy();
    expect(metricDetail).toBeTruthy();
  });

  test("次の行動を主要行動・補助操作の順に並べること", () => {
    const buttonNames = screen
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(buttonNames).toEqual([
      "プレイ！",
      "同じ問題",
      "記録を確認",
      "難易度変更",
      "ホーム",
      "スコアの内訳・採点基準",
      "検証情報",
    ]);
  });

  test("スコアの内訳と、全ゲーム共通の丸め方を添えた採点基準を開けること", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
    );

    const criterion = screen.getByText("基準時間以内で満点。");
    const note = screen.getByText(
      "各項目は1点単位に四捨五入し、0点を下限とする。",
    );
    expect(criterion).toBeTruthy();
    expect(note).toBeTruthy();
  });

  test("検証情報を開く操作を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

    expect(props.onOpenDiagnostics).toHaveBeenCalledOnce();
  });

  const playStartActions = [
    ["プレイ！", "onStartNewProblem"],
    ["同じ問題", "onReplay"],
  ] as const;

  test.each(playStartActions)(
    "%s でプレイを始める音を鳴らして操作を通知すること",
    (buttonName, callbackName) => {
      fireEvent.click(screen.getByRole("button", { name: buttonName }));

      expect(playSound).toHaveBeenCalledExactlyOnceWith(
        appDecisionSound.playStartSound,
      );
      expect(props[callbackName]).toHaveBeenCalledOnce();
    },
  );

  const silentActions = [
    ["記録を確認", "onOpenRecords"],
    ["難易度変更", "onChangeDifficulty"],
    ["ホーム", "onBackToHome"],
  ] as const;

  test.each(silentActions)(
    "%s では音を鳴らさずに操作を通知すること",
    (buttonName, callbackName) => {
      fireEvent.click(screen.getByRole("button", { name: buttonName }));

      expect(playSound).not.toHaveBeenCalled();
      expect(props[callbackName]).toHaveBeenCalledOnce();
    },
  );
});

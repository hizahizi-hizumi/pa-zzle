import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";

afterEach(cleanup);

function createProps(): ComponentProps<typeof GameResultScreen> {
  return {
    gameName: "テストパズル",
    difficultyLabel: "ふつう",
    pictogramSvg: "<svg></svg>",
    score: 82,
    metrics: [
      { label: "時間", value: "01:05", detail: "基準 +00:10" },
      { label: "ミス", value: "2" },
    ],
    recordOutcomeNotice: <p>記録を保存しました</p>,
    scoreBreakdown: [{ label: "速さ", value: "30 / 40" }],
    scoreCriteria: {
      items: [{ label: "速さ", description: "基準時間以内で満点。" }],
      note: { label: "下限", description: "各項目は0点を下限とします。" },
    },
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

  test("スコアの内訳と採点基準を開けること", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
    );

    const criterion = screen.getByText("基準時間以内で満点。");
    const note = screen.getByText("各項目は0点を下限とします。");
    expect(criterion).toBeTruthy();
    expect(note).toBeTruthy();
  });

  test("検証情報を開く操作を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

    expect(props.onOpenDiagnostics).toHaveBeenCalledOnce();
  });
});

describe("スコアを出さないプレイの場合", () => {
  beforeEach(() => {
    const {
      score: _score,
      scoreBreakdown: _scoreBreakdown,
      scoreCriteria: _scoreCriteria,
      ...common
    } = createProps();
    render(
      <GameResultScreen
        {...common}
        score={null}
        unscoredReason="評価の材料が無いため、スコアは出しません。"
      />,
    );
  });

  test("スコアの代わりに理由を示し、内訳を開く操作を出さないこと", () => {
    const reason = screen.getByText(
      "評価の材料が無いため、スコアは出しません。",
    );
    const score = screen.queryByText("スコア");
    const details = screen.queryByRole("button", {
      name: "スコアの内訳・採点基準",
    });

    expect(reason).toBeTruthy();
    expect(score).toBeNull();
    expect(details).toBeNull();
  });
});

describe("同じ問題を遊び直せない場合", () => {
  beforeEach(() => {
    const { onReplay: _onReplay, ...props } = createProps();
    render(<GameResultScreen {...props} />);
  });

  test("同じ問題の操作を押せない状態で出すこと", () => {
    const replayButton = screen.getByRole("button", { name: "同じ問題" });

    expect(replayButton.hasAttribute("disabled")).toBe(true);
  });
});

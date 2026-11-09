import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
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
    score: 82,
    metrics: [
      {
        label: "時間",
        recordMetricId: "time-delta-ms",
        value: "01:05",
        comparison: {
          basis: "referenceTime",
          difference: 10_000,
          display: "+00:10",
        },
      },
      { label: "ミス", value: "2回", recordMetricId: "mistake-count" },
    ],
    recordFeedback: { kind: "first-record" },
    scoreBreakdown: [{ label: "速さ", value: "30 / 40" }],
    scoreCriteria: [{ label: "速さ", description: "基準時間以内で満点。" }],
    onStartNewProblem: vi.fn(),
    onReplay: vi.fn(),
    onOpenGameHome: vi.fn(),
    onOpenDiagnostics: vi.fn(),
  };
}

describe("GameResultScreen", () => {
  let props: ComponentProps<typeof GameResultScreen>;

  beforeEach(() => {
    props = createProps();
    render(
      <MemoryRouter>
        <GameResultScreen {...props} />
      </MemoryRouter>,
    );
  });

  test("全パズル共通の静かな結果画面で評価・記録・主要成績をまとめて表示すること", () => {
    const resultScreen = screen.getByRole("region", { name: "プレイ結果" });
    const gameName = screen.getByText("テストパズル");
    const recordNotice = screen.getByText("初記録");
    const metricDetail = screen.getByLabelText("基準時間より長い +00:10");
    const grade = screen.getByText("82点（100点満点）");

    expect(document.activeElement).toBe(resultScreen);
    expect(gameName).toBeTruthy();
    expect(recordNotice).toBeTruthy();
    expect(metricDetail).toBeTruthy();
    expect(grade).toBeTruthy();
  });

  test("チェックを上部に重ねず、スコアを主役に表示すること", () => {
    expect(document.querySelector(".result-grade-complete")).toBeNull();
    expect(screen.getByText("82点（100点満点）")).toBeTruthy();
  });

  test("主操作を上段に1つ、副操作3つを下段に並べること", () => {
    const actions = screen.getByRole("navigation", { name: "結果からの操作" });
    expect(
      actions.firstElementChild?.classList.contains("result-action--primary"),
    ).toBe(true);
    expect(actions.children).toHaveLength(4);
  });

  test("次の行動を主要行動・補助操作の順に並べること", () => {
    const buttonNames = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);

    expect(buttonNames).toEqual([
      "採点内訳",
      "検証情報",
      "次の問題",
      "問題選択",
      "もう一度",
    ]);
  });

  test("4つの行動をアイコンを主役、文字を補助とする並びで表示すること", () => {
    const navigation = screen.getByRole("navigation", {
      name: "結果からの操作",
    });
    const actions = [
      ...within(navigation).getAllByRole("button"),
      ...within(navigation).getAllByRole("link"),
    ];

    expect(actions).toHaveLength(4);
    for (const action of actions) {
      expect(action.firstElementChild?.tagName.toLowerCase()).toBe("svg");
      expect(action.lastElementChild?.tagName.toLowerCase()).toBe("span");
    }
  });

  test("次の行動の最後に、パズル選択へ移るリンクを置くこと", () => {
    const replayButton = screen.getByRole("button", { name: "もう一度" });
    const puzzleSelectionLink = screen.getByRole("link", {
      name: "パズル選択",
    });

    const position = replayButton.compareDocumentPosition(puzzleSelectionLink);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(puzzleSelectionLink.getAttribute("href")).toBe("/");
  });

  test("スコアの内訳と、全ゲーム共通の丸め方を添えた採点基準を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "採点内訳" }));

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
    ["次の問題", "onStartNewProblem"],
    ["もう一度", "onReplay"],
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

  test("問題選択では音を鳴らさずに操作を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "問題選択" }));

    expect(playSound).not.toHaveBeenCalled();
    expect(props.onOpenGameHome).toHaveBeenCalledOnce();
  });

  test("ブランドの帯からホームへ戻れること", () => {
    const homeLink = screen.getByRole("link", { name: "pa-zzle ホーム" });

    const href = homeLink.getAttribute("href");

    expect(href).toBe("/");
  });
});

describe("GameResultScreen のパズル選択", () => {
  beforeEach(() => {
    render(
      <MemoryRouter initialEntries={["/puzzles/test/play/1"]}>
        <Routes>
          <Route
            path="/puzzles/test/play/1"
            element={<GameResultScreen {...createProps()} />}
          />
          <Route path="/" element={<p>パズル選択画面</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  test("押すと音を鳴らさずにパズル選択画面へ移ること", () => {
    fireEvent.click(screen.getByRole("link", { name: "パズル選択" }));

    expect(screen.getByText("パズル選択画面")).toBeTruthy();
    expect(playSound).not.toHaveBeenCalled();
  });
});

describe("GameResultScreen の遊び直せない記録", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <GameResultScreen {...createProps()} onReplay={undefined} />
      </MemoryRouter>,
    );
  });

  test("もう一度を押せない姿で出すこと", () => {
    const replayButton = screen.getByRole("button", { name: "もう一度" });

    expect(replayButton.hasAttribute("disabled")).toBe(true);
  });
});

describe("GameResultScreen の指標と自己ベスト", () => {
  test("更新幅を点数と対応する成績へ関連づけて表示すること", () => {
    const props = createProps();
    props.recordFeedback = {
      kind: "updated",
      improvements: [
        {
          id: "play-score",
          label: "スコア",
          previous: "80点",
          current: "82点",
          improvement: "+2点",
        },
        {
          id: "time-delta-ms",
          label: "基準時間との差",
          previous: "+00:12",
          current: "+00:10",
          improvement: "2秒短縮",
        },
        {
          id: "mistake-count",
          label: "ミス",
          previous: "3回",
          current: "2回",
          improvement: "1回減",
        },
      ],
    };
    const { container } = render(
      <MemoryRouter>
        <GameResultScreen {...props} />
      </MemoryRouter>,
    );
    const score = screen.getByLabelText(
      "スコアの自己ベスト更新：80点から82点、+2点",
    );
    const time = screen.getByLabelText(
      "基準時間との差の自己ベスト更新：+00:12から+00:10、2秒短縮",
    );
    const mistake = screen.getByLabelText(
      "ミスの自己ベスト更新：3回から2回、1回減",
    );
    expect(score.closest(".result-grade")).toBeTruthy();
    expect(time.closest(".result-quiet-metric")?.textContent).toContain("時間");
    expect(mistake.closest(".result-quiet-metric")?.textContent).toContain(
      "ミス",
    );
    expect(container.querySelector(".result-record-updates")).toBeNull();
  });
});

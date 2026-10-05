import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { createReflectionPlayRecord } from "@/games/reflection/play-record";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import type { PlayAttempt } from "@/records/play-attempt";

import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import type { PlayRecordGameCatalog } from "@/records/ui/play-record-display";

const playRecordGames = [
  { name: "ウォーターソート", playRecordDisplay: waterSortPlayRecordDisplay },
  { name: "ナンプレ", playRecordDisplay: nanpurePlayRecordDisplay },
  { name: "マインスイーパー", playRecordDisplay: minesweeperPlayRecordDisplay },
  { name: "バイナリパズル", playRecordDisplay: takuzuPlayRecordDisplay },
  { name: "リフレクション", playRecordDisplay: reflectionPlayRecordDisplay },
] as const satisfies PlayRecordGameCatalog;

const records = [
  createWaterSortPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "1",
      seed: "water-1",
      conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
      generationAttempt: 1,
    },
    startedAt: 1_000,
    completedAt: 61_000,
    result: {
      elapsedMs: 60_000,
      moveCount: 12,
      completionMoveCount: 12,
      undoCount: 0,
      restartCount: 0,
      optimalMoveCount: 10,
    },
  }),
  createWaterSortPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "1",
      seed: "water-2",
      conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
      generationAttempt: 1,
    },
    startedAt: 200_000,
    completedAt: 275_000,
    result: {
      elapsedMs: 75_000,
      moveCount: 10,
      completionMoveCount: 10,
      undoCount: 0,
      restartCount: 0,
      optimalMoveCount: 10,
    },
  }),
  // 3段階の難易度で記録したナンプレのプレイ。レベルの記録とは別の開始条件として比べる。
  {
    id: "nanpure-three-level",
    gameId: "nanpure",
    startedAt: 1_000,
    completedAt: 2_000,
    payloadVersion: 1,
    payload: {
      difficulty: "easy",
      problemIdentity: {
        generatorVersion: "1",
        seed: "nanpure-0",
        conditions: { clueCount: 36 },
        generationAttempt: 1,
      },
      performance: {
        elapsedMs: 60_000,
        mistakeCount: 0,
        undoCount: 0,
        restartCount: 0,
      },
    },
  },
  createNanpurePlayRecord({
    difficulty: "2",
    problemIdentity: createNanpureProblemIdentity("naked-single", 41),
    startedAt: 5_000,
    completedAt: 95_000,
    result: {
      elapsedMs: 90_000,
      mistakeCount: 0,
      undoCount: 1,
      restartCount: 0,
    },
  }),
  createMinesweeperPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "1",
      seed: "minesweeper-1",
      conditions: {
        rows: 10,
        columns: 10,
        mineCount: 16,
        startCellPlacement: "random",
      },
      generationAttempt: 1,
    },
    startedAt: 10_000,
    completedAt: 160_000,
    result: { elapsedMs: 150_000, mistakeCount: 1, minimumOpenCount: 25 },
  }),
  // 基準時間 10 + 46×2 + 18×3 + 2×10 = 176秒を 220秒で、置き直し1回で解いた記録。
  createTakuzuPlayRecord({
    difficulty: "4",
    problemIdentity: createTakuzuProblemIdentity("duplicate-avoidance", 2, 160),
    workload: { emptyCellCount: 46, roundCount: 18, lineReadingRoundCount: 2 },
    startedAt: 10_000,
    completedAt: 230_000,
    result: {
      elapsedMs: 220_000,
      correctionCount: 1,
      restartCount: 0,
      undoCount: 0,
      inputCount: 70,
    },
  }),
  // 基準時間 28×0.5 + 12×3.5 + 8×1.25 + 8×3.5 = 94秒を 110秒で、置き直し1回で解いた記録。
  createReflectionPlayRecord({
    difficulty: "4",
    problemIdentity: createReflectionProblemIdentity(7, 12, 0),
    workload: {
      pieceCount: 12,
      clueCount: 28,
      propagationRoundCount: 8,
      assumptionTestCount: 8,
      trialMoveCount: null,
    },
    startedAt: 10_000,
    completedAt: 120_000,
    result: {
      elapsedMs: 110_000,
      relocationCount: 1,
      restartCount: 0,
      laserCheckCount: 2,
      inputCount: 12,
    },
  }),
];

function createAbandonedWaterSortAttempt(
  difficulty: string,
  startedAt: number,
  abandonedAt: number,
): PlayAttempt {
  return {
    gameId: "water-sort",
    startedAt,
    start: { difficulty, problemIdentity: { seed: "water-3" } },
    abandonment: {
      abandonedAt,
      progress: { elapsedMs: abandonedAt - startedAt, moveCount: 5 },
    },
  };
}

const attempts: PlayAttempt[] = [
  // レベル3で、2件のクリアの間に離れたプレイ。
  createAbandonedWaterSortAttempt("3", 100_000, 130_000),
  // 別の開始条件で離れたプレイ。
  createAbandonedWaterSortAttempt("4", 100_000, 140_000),
  // 離脱を記録したあとにクリアしたプレイ。完了記録で表示する。
  createAbandonedWaterSortAttempt("3", 1_000, 50_000),
  // 開始だけを記録したプレイ。
  { ...createAbandonedWaterSortAttempt("3", 300_000, 0), abandonment: null },
];

type RenderScreenOptions = {
  isAttemptReplayable?: (attempt: PlayAttempt) => boolean;
  onReplayAttempt?: (attempt: PlayAttempt) => void;
};

function renderScreen(
  screenRecords: typeof records,
  screenAttempts: readonly PlayAttempt[],
  {
    isAttemptReplayable = () => true,
    onReplayAttempt = () => {},
  }: RenderScreenOptions = {},
) {
  render(
    <PlayRecordsScreen
      records={screenRecords}
      attempts={screenAttempts}
      games={playRecordGames}
      emptyAction={<a href="/">パズルを選ぶ</a>}
      isReplayable={() => true}
      onReplay={() => {}}
      isAttemptReplayable={isAttemptReplayable}
      onReplayAttempt={onReplayAttempt}
    />,
  );
}

function selectFilter(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "表示するプレイ" }), {
    target: { value },
  });
}

function selectComparison(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "開始条件" }), {
    target: { value },
  });
}

function getAbandonedRow(): HTMLElement {
  const row = screen
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText("離脱"));
  if (!row) {
    throw new Error("離脱したプレイの行がありません");
  }
  return row;
}

describe("PlayRecordsScreen", () => {
  let onReplayAttempt: (attempt: PlayAttempt) => void;

  beforeEach(() => {
    onReplayAttempt = vi.fn<(attempt: PlayAttempt) => void>();
    renderScreen(records, attempts, { onReplayAttempt });
  });

  afterEach(cleanup);

  test("見出しとパズルと開始条件を同じヘッダーで選べること", () => {
    const heading = screen.getByRole("heading", { name: "記録" });
    const gameSelect = screen.getByRole("combobox", { name: "パズル" });
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    });

    expect(heading).toBeTruthy();
    expect(gameSelect).toBeTruthy();
    expect(comparisonSelect).toBeTruthy();
  });

  test("比較指標を列として揃えて自己ベストの文字列を履歴へ追加しないこと", () => {
    const replayButtons = screen.getAllByRole("button", {
      name: "同じ問題をプレイ",
    });

    expect(screen.getAllByText("93点").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-00:04").length).toBeGreaterThan(0);
    expect(screen.getAllByText("±0").length).toBeGreaterThan(0);
    expect(screen.queryByText("ベスト")).toBeNull();
    expect(replayButtons).toHaveLength(2);
    expect(screen.getByText("2件")).toBeTruthy();
  });

  test("指標の推移を折れ線グラフへ切り替えて確認できること", () => {
    const trendButton = screen.getByRole("tab", { name: "推移" });
    fireEvent.mouseDown(trendButton, { button: 0, ctrlKey: false });
    const metricSelect = screen.getByRole("combobox", { name: "推移する指標" });
    fireEvent.change(metricSelect, { target: { value: "time-delta-ms" } });
    const chart = screen.getByRole("img", { name: "基準時間との差の推移" });

    expect(chart).toBeTruthy();
  });

  test("ゲームを切り替えるとゲーム固有の比較指標へ切り替わること", () => {
    const gameSelect = screen.getByRole("combobox", { name: "パズル" });
    fireEvent.change(gameSelect, { target: { value: "nanpure" } });

    expect(screen.getAllByText("01:30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ミス").length).toBeGreaterThan(0);
    expect(screen.getByText("1件")).toBeTruthy();
  });

  test("ナンプレの3段階の記録をレベルと混ぜず旧区分の開始条件として選べること", () => {
    const gameSelect = screen.getByRole("combobox", { name: "パズル" });
    fireEvent.change(gameSelect, { target: { value: "nanpure" } });
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    });
    fireEvent.change(comparisonSelect, { target: { value: "easy" } });

    expect(comparisonSelect.textContent).toContain("レベル 2");
    expect(comparisonSelect.textContent).toContain("かんたん");
    expect(screen.getAllByText("01:00").length).toBeGreaterThan(0);
    expect(screen.getByText("1件")).toBeTruthy();
  });

  test("マインスイーパーでは難易度ごとに評価点・基準時間との差・ミスを比較すること", () => {
    const gameSelect = screen.getByRole("combobox", { name: "パズル" });
    fireEvent.change(gameSelect, { target: { value: "minesweeper" } });
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    });

    expect(comparisonSelect.textContent).toContain("レベル 3");
    expect(screen.getAllByText("75点").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+00:31").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1回").length).toBeGreaterThan(0);
    expect(screen.getByText("1件")).toBeTruthy();
  });

  test("バイナリパズルでは難易度ごとにスコア・基準時間との差・置き直しを比較すること", () => {
    const gameSelect = screen.getByRole("combobox", { name: "パズル" });
    fireEvent.change(gameSelect, { target: { value: "takuzu" } });
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    });

    expect(comparisonSelect.textContent).toContain("レベル 4");
    expect(screen.getAllByText("85点").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+00:44").length).toBeGreaterThan(0);
    expect(screen.getAllByText("置き直し").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1回").length).toBeGreaterThan(0);
    expect(screen.getByText("1件")).toBeTruthy();
  });

  test("リフレクションでは難易度ごとにスコア・基準時間との差を比較すること", () => {
    const gameSelect = screen.getByRole("combobox", { name: "パズル" });
    fireEvent.change(gameSelect, { target: { value: "reflection" } });
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    });

    expect(gameSelect.textContent).toContain("リフレクション");
    expect(comparisonSelect.textContent).toContain("レベル 4");
    expect(screen.getAllByText("91点").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+00:16").length).toBeGreaterThan(0);
    expect(screen.getByText("1件")).toBeTruthy();
  });

  test("既定ではクリアしたプレイだけを履歴に並べること", () => {
    const abandonedLabel = screen.queryByText("離脱");
    const count = screen.getByText("2件");

    expect(abandonedLabel).toBeNull();
    expect(count).toBeTruthy();
  });

  describe("すべてに切り替えた場合", () => {
    beforeEach(() => {
      selectFilter("all");
    });

    test("同じ開始条件の離脱したプレイを時系列で混ぜ、クリアした記録だけをコピーの対象にすること", () => {
      const rowLabels = screen
        .getAllByRole("listitem")
        .map((row) => within(row).queryByText("離脱") !== null);
      const copyButton = screen.getByRole("button", {
        name: "クリアした記録をJSONでコピー",
      });

      expect(rowLabels).toEqual([false, true, false]);
      expect(screen.getByText("3件")).toBeTruthy();
      expect(copyButton).toBeTruthy();
    });

    test("離脱したプレイには評価を示さず、離れた時点の進み具合と遊び直しの操作を示すこと", () => {
      const row = getAbandonedRow();
      const buttons = within(row).getAllByRole("button");
      fireEvent.click(
        within(row).getByRole("button", { name: "同じ問題をプレイ" }),
      );

      expect(within(row).getByText("時間")).toBeTruthy();
      expect(within(row).getByText("00:30")).toBeTruthy();
      expect(within(row).getByText("5手")).toBeTruthy();
      expect(within(row).queryByText(/点$/)).toBeNull();
      expect(buttons).toHaveLength(1);
      expect(onReplayAttempt).toHaveBeenCalledExactlyOnceWith(attempts[0]);
    });
  });

  describe("離脱しかない開始条件を選んだ場合", () => {
    beforeEach(() => {
      selectComparison("4");
    });

    test("自己ベストを持たず、切り替えによらず離脱したプレイだけを並べること", () => {
      const filterSelect = screen.getByRole("combobox", {
        name: "表示するプレイ",
      }) as HTMLSelectElement;
      const rows = screen.getAllByRole("listitem");

      expect(screen.getByText("まだクリアしていません")).toBeTruthy();
      expect(filterSelect.value).toBe("all");
      expect(filterSelect.disabled).toBe(true);
      expect(rows).toHaveLength(1);
      expect(screen.queryByRole("button", { name: /JSONでコピー/ })).toBeNull();
    });
  });
});

describe("完了記録が無く離脱したプレイだけがある場合", () => {
  beforeEach(() => {
    renderScreen([], [createAbandonedWaterSortAttempt("3", 100_000, 130_000)], {
      isAttemptReplayable: () => false,
    });
  });

  afterEach(cleanup);

  test("離脱したゲームを開いて離脱したプレイを表示すること", () => {
    const gameSelect = screen.getByRole("combobox", {
      name: "パズル",
    }) as HTMLSelectElement;

    expect(gameSelect.value).toBe("water-sort");
    expect(screen.getByText("離脱")).toBeTruthy();
  });

  test("遊び直せない離脱したプレイでは押せないボタンで今は遊べないことを示すこと", () => {
    const unavailableButton = within(getAbandonedRow()).getByRole("button", {
      name: "この記録の問題は今は遊べません",
    });

    expect(unavailableButton.hasAttribute("disabled")).toBe(true);
  });
});

describe("最後に遊んだのが離脱したプレイの場合", () => {
  beforeEach(() => {
    renderScreen(records, [
      createAbandonedWaterSortAttempt("4", 900_000, 1_000_000),
    ]);
  });

  afterEach(cleanup);

  test("その開始条件を最初に開くこと", () => {
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    }) as HTMLSelectElement;

    expect(comparisonSelect.value).toBe("4");
  });
});

describe("PlayRecordsScreen の同じ問題をプレイ", () => {
  const [unreplayableRecord, replayableRecord] = records;
  const onReplay = vi.fn();

  beforeEach(() => {
    render(
      <PlayRecordsScreen
        records={records}
        attempts={[]}
        games={playRecordGames}
        emptyAction={<a href="/">パズルを選ぶ</a>}
        isReplayable={(record) => record !== unreplayableRecord}
        onReplay={onReplay}
        isAttemptReplayable={() => true}
        onReplayAttempt={() => {}}
      />,
    );
  });

  afterEach(() => {
    cleanup();
    onReplay.mockReset();
  });

  test("遊び直せる記録ではその記録を渡して遊び直しを求めること", () => {
    const history = screen.getByRole("list");
    const replayButton = within(history).getByRole("button", {
      name: "同じ問題をプレイ",
    });
    fireEvent.click(replayButton);

    expect(onReplay).toHaveBeenCalledExactlyOnceWith(replayableRecord);
  });

  test("遊び直せない記録では押せないボタンで今は遊べないことを示すこと", () => {
    const history = screen.getByRole("list");
    const unavailableButton = within(history).getByRole("button", {
      name: "この記録の問題は今は遊べません",
    });

    expect(unavailableButton.hasAttribute("disabled")).toBe(true);
    expect(unavailableButton.parentElement?.getAttribute("title")).toBe(
      "この記録の問題は今は遊べません",
    );
  });
});

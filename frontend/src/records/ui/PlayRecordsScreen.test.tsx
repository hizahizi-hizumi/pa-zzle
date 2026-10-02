import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { minesweeperPlayAttemptDisplay } from "@/games/minesweeper/ui/play-attempt-display";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { nanpurePlayAttemptDisplay } from "@/games/nanpure/ui/play-attempt-display";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { createReflectionPlayRecord } from "@/games/reflection/play-record";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { reflectionPlayAttemptDisplay } from "@/games/reflection/ui/play-attempt-display";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { takuzuPlayAttemptDisplay } from "@/games/takuzu/ui/play-attempt-display";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { createWaterSortPlayAttempt } from "@/games/water-sort/play-attempt";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { waterSortPlayAttemptDisplay } from "@/games/water-sort/ui/play-attempt-display";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import type { PlayAttempt } from "@/records/play-attempt";

import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import type { PlayRecordGameCatalog } from "@/records/ui/play-record-display";

const playRecordGames = [
  {
    name: "ウォーターソート",
    playRecordDisplay: waterSortPlayRecordDisplay,
    playAttemptDisplay: waterSortPlayAttemptDisplay,
  },
  {
    name: "ナンプレ",
    playRecordDisplay: nanpurePlayRecordDisplay,
    playAttemptDisplay: nanpurePlayAttemptDisplay,
  },
  {
    name: "マインスイーパー",
    playRecordDisplay: minesweeperPlayRecordDisplay,
    playAttemptDisplay: minesweeperPlayAttemptDisplay,
  },
  {
    name: "バイナリパズル",
    playRecordDisplay: takuzuPlayRecordDisplay,
    playAttemptDisplay: takuzuPlayAttemptDisplay,
  },
  {
    name: "リフレクション",
    playRecordDisplay: reflectionPlayRecordDisplay,
    playAttemptDisplay: reflectionPlayAttemptDisplay,
  },
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

const waterSortProblemIdentity = {
  generatorVersion: "1",
  seed: "water-3",
  conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
  generationAttempt: 1,
} as const;

function createAbandonedWaterSortAttempt(
  difficulty: "3" | "4",
  startedAt: number,
  abandonedAt: number,
): PlayAttempt {
  return {
    ...createWaterSortPlayAttempt({
      difficulty,
      problemIdentity: waterSortProblemIdentity,
      startedAt,
    }),
    abandonment: {
      abandonedAt,
      progress: {
        elapsedMs: abandonedAt - startedAt,
        moveCount: 5,
        undoCount: 1,
        restartCount: 0,
      },
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
  createWaterSortPlayAttempt({
    difficulty: "3",
    problemIdentity: waterSortProblemIdentity,
    startedAt: 300_000,
  }),
  // 今のアプリが読めない形で記録したプレイ。
  {
    ...createAbandonedWaterSortAttempt("3", 400_000, 450_000),
    payloadVersion: 99,
  },
];

describe("PlayRecordsScreen", () => {
  beforeEach(() => {
    render(
      <PlayRecordsScreen
        records={records}
        attempts={attempts}
        games={playRecordGames}
        emptyAction={<a href="/">パズルを選ぶ</a>}
        onReplay={() => {}}
      />,
    );
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
    const filterSelect = screen.getByRole("combobox", {
      name: "表示するプレイ",
    });

    expect((filterSelect as HTMLSelectElement).value).toBe("cleared");
    expect(screen.queryByText("離脱")).toBeNull();
    expect(screen.getByText("2件")).toBeTruthy();
  });

  test("すべてに切り替えると同じ開始条件の離脱したプレイを時系列で混ぜて並べること", () => {
    const filterSelect = screen.getByRole("combobox", {
      name: "表示するプレイ",
    });
    fireEvent.change(filterSelect, { target: { value: "all" } });
    const rows = screen.getAllByRole("listitem");
    const [newestRow, abandonedRow, oldestRow] = rows as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];

    expect(rows).toHaveLength(3);
    expect(within(abandonedRow).getByText("離脱")).toBeTruthy();
    expect(within(abandonedRow).getByText("経過")).toBeTruthy();
    expect(within(abandonedRow).getByText("00:30")).toBeTruthy();
    expect(within(abandonedRow).getByText("手数")).toBeTruthy();
    expect(within(abandonedRow).getByText("5手")).toBeTruthy();
    expect(within(abandonedRow).queryByText(/点$/)).toBeNull();
    expect(within(abandonedRow).queryByRole("button")).toBeNull();
    expect(within(newestRow).queryByText("離脱")).toBeNull();
    expect(within(oldestRow).queryByText("離脱")).toBeNull();
    expect(screen.getAllByText("離脱")).toHaveLength(1);
    expect(screen.getByText("3件")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "クリアした記録をJSONでコピー" }),
    ).toBeTruthy();
  });

  test("離脱したプレイを自己ベストと推移の対象にしないこと", () => {
    const filterSelect = screen.getByRole("combobox", {
      name: "表示するプレイ",
    });
    fireEvent.change(filterSelect, { target: { value: "all" } });
    const trendButton = screen.getByRole("tab", { name: "推移" });
    fireEvent.mouseDown(trendButton, { button: 0, ctrlKey: false });

    expect(
      screen.queryByRole("combobox", { name: "表示するプレイ" }),
    ).toBeNull();
    expect(screen.getByText("2件")).toBeTruthy();
  });
});

describe("PlayRecordsScreen の離脱だけの比較文脈", () => {
  afterEach(cleanup);

  function renderScreen(
    screenRecords: typeof records,
    screenAttempts: readonly PlayAttempt[],
  ) {
    render(
      <PlayRecordsScreen
        records={screenRecords}
        attempts={screenAttempts}
        games={playRecordGames}
        emptyAction={<a href="/">パズルを選ぶ</a>}
        onReplay={() => {}}
      />,
    );
  }

  test("離脱しかない開始条件も、新しく遊んだ順に開始条件として選べること", () => {
    renderScreen(records, attempts);
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    }) as HTMLSelectElement;

    expect(
      Array.from(comparisonSelect.options, (option) => option.value),
    ).toEqual(["3", "4"]);
  });

  test("離脱しかない開始条件では自己ベストを持たず、離脱したプレイを表示すること", () => {
    renderScreen(records, attempts);
    fireEvent.change(screen.getByRole("combobox", { name: "開始条件" }), {
      target: { value: "4" },
    });
    const filterSelect = screen.getByRole("combobox", {
      name: "表示するプレイ",
    }) as HTMLSelectElement;

    expect(screen.getByText("まだクリアしていません")).toBeTruthy();
    expect(filterSelect.value).toBe("all");
    expect(filterSelect.disabled).toBe(true);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("離脱")).toBeTruthy();
    expect(screen.getByText("1件")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /JSONでコピー/ })).toBeNull();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "推移" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText("表示できる記録がありません。")).toBeTruthy();
  });

  test("最後に離脱したプレイの開始条件を最初に開くこと", () => {
    renderScreen(records, [
      createAbandonedWaterSortAttempt("4", 900_000, 1_000_000),
    ]);
    const comparisonSelect = screen.getByRole("combobox", {
      name: "開始条件",
    }) as HTMLSelectElement;

    expect(comparisonSelect.value).toBe("4");
    expect(screen.getByText("離脱")).toBeTruthy();
  });

  test("完了記録が無くても、離脱したゲームを開いて離脱したプレイを表示すること", () => {
    renderScreen([], [createAbandonedWaterSortAttempt("3", 100_000, 130_000)]);

    expect(screen.queryByText("まだ記録がありません")).toBeNull();
    expect(
      (screen.getByRole("combobox", { name: "パズル" }) as HTMLSelectElement)
        .value,
    ).toBe("water-sort");
    expect(screen.getByText("離脱")).toBeTruthy();
    expect(screen.getByText("まだクリアしていません")).toBeTruthy();
  });

  test("完了記録も離脱も無ければ空の状態を表示すること", () => {
    renderScreen([], []);

    expect(screen.getByText("まだ記録がありません")).toBeTruthy();
  });
});

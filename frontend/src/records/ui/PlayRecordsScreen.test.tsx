import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";

import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import type { PlayRecordDisplayCatalog } from "@/records/ui/play-record-display";

const playRecordDisplays = [
  waterSortPlayRecordDisplay,
  nanpurePlayRecordDisplay,
] as const satisfies PlayRecordDisplayCatalog;

const records = [
  createWaterSortPlayRecord({
    difficulty: "normal",
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
    difficulty: "normal",
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
  createNanpurePlayRecord({
    difficulty: "easy",
    problemIdentity: {
      generatorVersion: "1",
      seed: "nanpure-1",
      conditions: { clueCount: 36 },
      generationAttempt: 1,
    },
    startedAt: 5_000,
    completedAt: 95_000,
    result: {
      elapsedMs: 90_000,
      mistakeCount: 0,
      undoCount: 1,
      restartCount: 0,
    },
  }),
];

describe("PlayRecordsScreen", () => {
  beforeEach(() => {
    render(
      <PlayRecordsScreen
        records={records}
        displays={playRecordDisplays}
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
});

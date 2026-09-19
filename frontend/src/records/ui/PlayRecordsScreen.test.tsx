import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";

import { PlayRecordsScreen } from "./PlayRecordsScreen";

afterEach(cleanup);

function createWaterRecord(
  idTime: number,
  moveCount: number,
  elapsedMs: number,
) {
  return createWaterSortPlayRecord({
    difficulty: "normal",
    problemIdentity: {
      generatorVersion: "1",
      seed: `water-${idTime}`,
      conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
      generationAttempt: 1,
    },
    startedAt: idTime,
    completedAt: idTime + elapsedMs,
    result: {
      elapsedMs,
      moveCount,
      completionMoveCount: moveCount,
      undoCount: 0,
      restartCount: 0,
      optimalMoveCount: 10,
    },
  });
}

function createNanpureRecord() {
  return createNanpurePlayRecord({
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
  });
}

function renderScreen() {
  const records = [
    createWaterRecord(1_000, 12, 60_000),
    createWaterRecord(200_000, 10, 75_000),
    createNanpureRecord(),
  ];
  return render(
    <MemoryRouter>
      <PlayRecordsScreen records={records} />
    </MemoryRouter>,
  );
}

test("最新のゲーム条件について自己ベストと履歴一覧を表示すること", () => {
  renderScreen();

  const heading = screen.getByRole("heading", { name: "自己ベスト" });
  const historyHeading = screen.getByRole("heading", { name: "プレイ履歴" });

  expect(heading).toBeTruthy();
  expect(historyHeading).toBeTruthy();
  expect(screen.getAllByText("93点").length).toBeGreaterThan(0);
  expect(screen.getAllByText("01:00").length).toBeGreaterThan(0);
  expect(screen.getByText("2件")).toBeTruthy();
});

test("ゲームを選択してそのゲームの自己ベストと履歴を確認できること", () => {
  renderScreen();

  const gameSelect = screen.getByRole("combobox", { name: "パズル" });
  fireEvent.click(gameSelect);
  fireEvent.click(screen.getByRole("option", { name: "ナンプレ" }));

  expect(screen.getAllByText("01:30").length).toBeGreaterThan(0);
  expect(screen.getAllByText("最少ミス").length).toBeGreaterThan(0);
  expect(screen.getByText("1件")).toBeTruthy();
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import type { DifficultyLevel } from "@/games/difficulty";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { serializePlayRecordsForCopy } from "@/records/play-record-copy";
import { PlayRecordsPerformance } from "@/records/ui/PlayRecordsPerformance";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

function createRecord(
  difficulty: DifficultyLevel,
  seed: string,
  completedAt: number,
  elapsedMs: number,
  completionMoveCount: number,
) {
  return createWaterSortPlayRecord({
    difficulty,
    problemIdentity: {
      generatorVersion: "1",
      seed,
      conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
      generationAttempt: 1,
    },
    startedAt: completedAt - elapsedMs,
    completedAt,
    result: {
      elapsedMs,
      moveCount: completionMoveCount,
      completionMoveCount,
      undoCount: 0,
      restartCount: 0,
      optimalMoveCount: 10,
    },
  });
}

const olderLevelThree = createRecord("3", "water-1", 61_000, 60_000, 12);
const newerLevelThree = createRecord("3", "water-2", 275_000, 75_000, 10);
const levelFour = createRecord("4", "water-3", 500_000, 40_000, 10);
const records = [olderLevelThree, levelFour, newerLevelThree];

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
});

describe("PlayRecordsPerformance", () => {
  describe("比較単位の記録がある場合", () => {
    beforeEach(() => {
      render(
        <PlayRecordsPerformance
          records={records}
          display={waterSortPlayRecordDisplay}
          comparisonKey="3"
        />,
      );
    });

    test("比較単位の記録だけから、指標ごとの自己ベストを示すこと", () => {
      const bests = screen
        .getByRole("region", { name: "自己ベスト" })
        .querySelectorAll("dd");

      expect([...bests].map((best) => best.textContent)).toEqual([
        "93点",
        "-00:04",
        "±0",
      ]);
      expect(screen.getByText("2件")).toBeTruthy();
    });

    test("指標を選ぶと、その指標の推移を示すこと", () => {
      fireEvent.change(screen.getByRole("combobox", { name: "推移する指標" }), {
        target: { value: "time-delta-ms" },
      });
      const chart = screen.getByRole("img", { name: "基準時間との差の推移" });

      expect(chart).toBeTruthy();
    });

    test("記録の JSON コピーを出さないこと", () => {
      const copy = screen.queryByRole("button", { name: "記録をJSONでコピー" });

      expect(copy).toBeNull();
    });
  });

  describe("内部診断が有効なビルドで比較単位の記録がある場合", () => {
    let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

    beforeEach(() => {
      internalDiagnostics.available = true;
      writeText = vi.fn(async (_text: string) => undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      render(
        <PlayRecordsPerformance
          records={records}
          display={waterSortPlayRecordDisplay}
          comparisonKey="3"
        />,
      );
    });

    test("比較単位の記録を新しい順に JSON でコピーすること", async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "記録をJSONでコピー" }),
      );

      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      expect(writeText).toHaveBeenCalledWith(
        serializePlayRecordsForCopy([newerLevelThree, olderLevelThree]),
      );
    });
  });

  describe("比較単位の記録が無い場合", () => {
    beforeEach(() => {
      render(
        <PlayRecordsPerformance
          records={records}
          display={waterSortPlayRecordDisplay}
          comparisonKey="5"
        />,
      );
    });

    test("まだクリアしていないことだけを示し、推移とコピーを出さないこと", () => {
      const message = screen.getByText("まだクリアしていません");
      const copy = screen.queryByRole("button", { name: "記録をJSONでコピー" });
      const metricSelect = screen.queryByRole("combobox");

      expect(message).toBeTruthy();
      expect(copy).toBeNull();
      expect(metricSelect).toBeNull();
    });
  });
});

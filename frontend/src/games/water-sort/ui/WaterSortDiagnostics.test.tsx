import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  serializeWaterSortDiagnosticSnapshot,
  type WaterSortDiagnosticSnapshot,
} from "@/games/water-sort/diagnostics";

import { WaterSortDiagnostics } from "./WaterSortDiagnostics";

const snapshot: WaterSortDiagnosticSnapshot = {
  formatVersion: 1,
  game: "water-sort",
  difficulty: "normal",
  problemIdentity: {
    generatorVersion: "1",
    seed: "diagnostics-ui-seed",
    conditions: {
      colorCount: 5,
      capacity: 4,
      emptyBottleCount: 2,
    },
    generationAttempt: 7,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WaterSortDiagnostics", () => {
  test("閉じている間は診断情報を表示しないこと", () => {
    render(
      <WaterSortDiagnostics
        snapshot={snapshot}
        open={false}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.queryByRole("dialog");

    expect(dialog).toBeNull();
  });

  test("問題識別情報を表示して再現用JSONをコピーできること", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<WaterSortDiagnostics snapshot={snapshot} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "再現用JSONをコピー" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(
      serializeWaterSortDiagnosticSnapshot(snapshot),
    );
    expect(screen.getByText("diagnostics-ui-seed")).toBeTruthy();
    expect(screen.getByText("abcdef1234567890")).toBeTruthy();
    expect(screen.getByRole("button", { name: "コピーしました" })).toBeTruthy();
  });

  test("閉じる操作を通知すること", () => {
    const onClose = vi.fn();
    render(<WaterSortDiagnostics snapshot={snapshot} open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

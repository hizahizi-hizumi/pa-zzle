import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { InternalDiagnosticsDialog } from "./InternalDiagnosticsDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InternalDiagnosticsDialog", () => {
  let onClose: () => void;
  let writeText: (text: string) => Promise<void>;

  beforeEach(() => {
    onClose = vi.fn();
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <InternalDiagnosticsDialog
        difficultyLabel="ふつう"
        seed="diagnostics-ui-seed"
        generatorVersion="1"
        generationConditions="条件表示"
        generationAttempt={7}
        buildRevision="abcdef1234567890"
        serializedSnapshot='{"game":"test"}'
        onClose={onClose}
      />,
    );
  });

  test("診断情報を表示して再現用JSONをコピーできること", async () => {
    fireEvent.click(screen.getByRole("button", { name: "再現用JSONをコピー" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith('{"game":"test"}');
    expect(screen.getByText("diagnostics-ui-seed")).toBeTruthy();
    expect(screen.getByText("条件表示")).toBeTruthy();
    expect(screen.getByText("abcdef1234567890")).toBeTruthy();
    expect(screen.getByRole("button", { name: "コピーしました" })).toBeTruthy();
  });

  test("閉じる操作を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("Escapeキーで閉じる操作を通知すること", () => {
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

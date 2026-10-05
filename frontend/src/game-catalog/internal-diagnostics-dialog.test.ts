import { act, renderHook } from "@testing-library/react";
import type { Mock } from "vitest";

import {
  type InternalDiagnosticsDialog,
  useInternalDiagnosticsDialog,
} from "@/game-catalog/internal-diagnostics-dialog";

const internalDiagnostics = vi.hoisted(() => ({ available: true }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: "abc123",
}));

type Snapshot = { buildRevision: string | null };

describe("useInternalDiagnosticsDialog", () => {
  let createSnapshot: Mock<(buildRevision: string | null) => Snapshot>;
  let result: { current: InternalDiagnosticsDialog<Snapshot> };

  function renderDialog(): void {
    createSnapshot = vi.fn((buildRevision: string | null) => ({
      buildRevision,
    }));
    ({ result } = renderHook(() =>
      useInternalDiagnosticsDialog(createSnapshot),
    ));
  }

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderDialog();
    });

    test("開くまではスナップショットを作らないこと", () => {
      const { snapshot } = result.current;

      expect(snapshot).toBeNull();
      expect(createSnapshot).not.toHaveBeenCalled();
    });

    test("開くとビルドの版を渡してスナップショットを作り、閉じると捨てること", () => {
      act(() => result.current.open?.());
      const opened = result.current.snapshot;
      act(() => result.current.close());
      const closed = result.current.snapshot;

      expect(opened).toEqual({ buildRevision: "abc123" });
      expect(closed).toBeNull();
    });
  });

  describe("内部診断を使えないビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = false;
      renderDialog();
    });

    test("開く操作を出さないこと", () => {
      const { open } = result.current;

      expect(open).toBeUndefined();
    });
  });
});

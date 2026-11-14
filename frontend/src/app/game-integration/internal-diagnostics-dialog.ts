import { useState } from "react";

import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

export type InternalDiagnosticsDialog<Snapshot> = {
  /** 開いている間だけ値を持つ。 */
  snapshot: Snapshot | null;
  /** 内部診断を使えないビルドでは `undefined`。 */
  open: (() => void) | undefined;
  close: () => void;
};

/** 問題の復元や難易度分析を伴う診断もあるので、プレイ中や結果を見ている間は作らない。 */
export function useInternalDiagnosticsDialog<Snapshot>(
  createSnapshot: (buildRevision: string | null) => Snapshot | null,
): InternalDiagnosticsDialog<Snapshot> {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  return {
    snapshot,
    open: internalDiagnosticsAvailable
      ? () => setSnapshot(createSnapshot(buildRevision))
      : undefined,
    close: () => setSnapshot(null),
  };
}

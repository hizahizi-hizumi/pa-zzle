import { useState } from "react";

import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

/** 検証情報のダイアログの開閉と、開いている間に見せる診断スナップショット。 */
export type InternalDiagnosticsDialog<Snapshot> = {
  /** 開いている間だけ値を持つ。 */
  snapshot: Snapshot | null;
  /** 検証情報を開く。内部診断を使えないビルドでは `undefined` で、開く操作を出さない。 */
  open: (() => void) | undefined;
  close: () => void;
};

/**
 * 検証情報のダイアログを開いたときだけ、診断スナップショットを作る。
 * 問題の復元や難易度分析を伴う診断もあるので、プレイ中や結果を見ている間は作らない。
 * スナップショットを作れないとき（`null`）は開かない。
 */
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

/**
 * 盤面デザインの試作の切り替え（比較用。採用後に1つへ絞る）。
 * - `current`: これまでの盤。
 * - `quiet`: アプリの他のゲームと同じ静けさの、平らな盤と駒。
 * - `real`: 榧の盤と柘植の駒に見えるところまで寄せた盤。
 * URL のクエリで選ぶと、同じタブの間は覚えておく。
 * - `boardStyle`: 上の3案。
 * - `pieceFont` / `coordFont`: 案R の駒の字・筋段の書体候補（`board/real/font-candidates.ts` の id）。
 * - `wood`: 案R の木目。`photo`（写真由来）か `procedural`（手続き生成）。
 */
export type TsumeShogiBoardStyle = "current" | "quiet" | "real";
export type TsumeShogiWoodSource = "photo" | "procedural";

function readOption<T extends string>(
  key: string,
  isValid: (value: string | null) => value is T,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  const storageKey = `tsume-shogi-${key}`;
  try {
    const requested = new URLSearchParams(window.location.search).get(key);
    if (isValid(requested)) {
      window.sessionStorage.setItem(storageKey, requested);
      return requested;
    }
    const stored = window.sessionStorage.getItem(storageKey);
    return isValid(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function isBoardStyle(value: string | null): value is TsumeShogiBoardStyle {
  return value === "current" || value === "quiet" || value === "real";
}

function isWoodSource(value: string | null): value is TsumeShogiWoodSource {
  return value === "photo" || value === "procedural";
}

function isAnyText(value: string | null): value is string {
  return value !== null && value !== "";
}

export const tsumeShogiBoardStyle: TsumeShogiBoardStyle = readOption(
  "boardStyle",
  isBoardStyle,
  "current",
);

export const tsumeShogiWoodSource: TsumeShogiWoodSource = readOption(
  "wood",
  isWoodSource,
  "procedural",
);

/** 書体の id。候補に無い id は使う側で既定に戻す。 */
export const tsumeShogiRequestedPieceFont: string | null = readOption<string>(
  "pieceFont",
  isAnyText,
  "",
);
export const tsumeShogiRequestedCoordinateFont: string | null =
  readOption<string>("coordFont", isAnyText, "");

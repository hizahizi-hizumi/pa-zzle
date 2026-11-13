import { useMemo } from "react";
import { ZUKAN_PIECE_VIEW_BOX } from "@/features/zukan/ui/zukan-piece-shape";
import { getZukanSolvedPiecePath } from "@/features/zukan/ui/zukan-play-piece";
import type { ZukanSheetPlace } from "@/features/zukan/zukan-collection";

const PICTOGRAM_SIZE = 0.5;

type ZukanResultPieceProps = {
  /** ゲームの濃淡2色のピクトグラム。ピースの面に白抜きで載せる。 */
  pictogramSvg: string;
  /** このピースの、台紙の中の場所。台紙に無い問題では `null`。 */
  sheetPlace: ZukanSheetPlace | null;
};

export function ZukanResultPiece({
  pictogramSvg,
  sheetPlace,
}: ZukanResultPieceProps) {
  const piecePath = getZukanSolvedPiecePath(sheetPlace?.problemId);
  const pictogram = useMemo(() => {
    const parsed = new DOMParser().parseFromString(
      pictogramSvg,
      "image/svg+xml",
    ).documentElement;
    if (parsed.localName !== "svg") return null;
    const offset = (1 - PICTOGRAM_SIZE) / 2;
    parsed.setAttribute("x", String(offset));
    parsed.setAttribute("y", String(offset));
    parsed.setAttribute("width", String(PICTOGRAM_SIZE));
    parsed.setAttribute("height", String(PICTOGRAM_SIZE));
    return parsed.outerHTML;
  }, [pictogramSvg]);

  return (
    <svg
      aria-hidden="true"
      viewBox={ZUKAN_PIECE_VIEW_BOX}
      data-zukan-result-piece=""
      data-sheet-game-id={sheetPlace?.gameId}
      data-sheet-problem-id={sheetPlace?.problemId}
      data-sheet-difficulty={sheetPlace?.difficulty}
      data-sheet-index={sheetPlace?.index}
      className="block size-full overflow-visible text-(--result-award-soft) [--game-pictogram-soft:var(--result-emblem-mark,var(--background))] [--game-pictogram-strong:var(--result-emblem-mark,var(--background))]"
    >
      <path d={piecePath} fill="currentColor" />
      {pictogram !== null && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: ゲームが同梱する SVG を、ピースの面に載せる。
        <g dangerouslySetInnerHTML={{ __html: pictogram }} />
      )}
    </svg>
  );
}

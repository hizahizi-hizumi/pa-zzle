import { useMemo } from "react";
import {
  getZukanPiecePath,
  ZUKAN_PIECE_VIEW_BOX,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import {
  DEFAULT_ZUKAN_PIECE_SHAPE,
  getZukanPlayPiecePath,
} from "@/zukan/ui/zukan-piece-transit";

const PICTOGRAM_SIZE = 0.5;

type ZukanResultPieceProps = {
  /** ゲームの濃淡2色のピクトグラム。ピースの面に白抜きで載せる。 */
  pictogramSvg: string;
};

/**
 * 結果に添える、解いた問題のピース。1問は台紙の1ピースで、解くとそのピースに評価の色が付く。
 * 台紙でそのマスに入る色と同じ評価の色で塗り、結果からゲームのホームへ戻るときに、このピースを台紙の元の場所へ運ぶ。
 */
export function ZukanResultPiece({ pictogramSvg }: ZukanResultPieceProps) {
  const piecePath =
    getZukanPlayPiecePath() ?? getZukanPiecePath(DEFAULT_ZUKAN_PIECE_SHAPE);
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
      className="block size-full overflow-visible text-(--result-award-soft) [--game-pictogram-soft:var(--background)] [--game-pictogram-strong:var(--background)]"
    >
      <path d={piecePath} fill="currentColor" />
      {pictogram !== null && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: ゲームが同梱する SVG を、ピースの面に載せる。
        <g dangerouslySetInnerHTML={{ __html: pictogram }} />
      )}
    </svg>
  );
}

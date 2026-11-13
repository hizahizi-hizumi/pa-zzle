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
  /** このピースの、台紙の中の場所。台紙の難易度と、番号の順の位置。台紙に無い問題では `null`。 */
  sheetPlace: { difficulty: string; index: number } | null;
};

/**
 * 結果に添える、解いた問題のピース。1問は図鑑の台紙の1ピースで、解くとそのピースに今回の評価の色が付く。
 * 結果からゲームのホーム・パズル選択へ戻るときに、このピースを台紙の元の場所へ運ぶ。台紙のマスの色は問題ごとの最高評価なので、
 * 今回の評価が最高評価より低いときは、マスの色と同じにならない。
 */
export function ZukanResultPiece({
  pictogramSvg,
  sheetPlace,
}: ZukanResultPieceProps) {
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

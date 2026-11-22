import { useId, useRef } from "react";
import { useZukanPieceModel } from "@/features/zukan/ui/use-zukan-piece-model";
import { ZukanPieceMaterialDefs } from "@/features/zukan/ui/ZukanResultPiece/ZukanPieceMaterialDefs";
import { ZukanPieceSurface } from "@/features/zukan/ui/ZukanResultPiece/ZukanPieceSurface";
import { ZUKAN_PIECE_MATERIAL } from "@/features/zukan/ui/zukan-piece-material";
import { ZUKAN_PIECE_VIEW_BOX } from "@/features/zukan/ui/zukan-piece-shape";
import { getZukanSolvedPiecePath } from "@/features/zukan/ui/zukan-play-piece";
import type { ZukanSheetPlace } from "@/features/zukan/zukan-collection";

type ZukanResultPieceProps = {
  /** このピースの、台紙の中の場所。台紙に無い問題では `null`。 */
  sheetPlace: ZukanSheetPlace | null;
};

/**
 * 解いた問題のピース。置かれた箱をピースの面（1辺）とし、評価の色（`--result-award-soft`）で塗って、少し浮かせる。
 * 立体で回せる間は立体で、それまでと回せないときは、同じ質感の平面で見せる。
 */
export function ZukanResultPiece({ sheetPlace }: ZukanResultPieceProps) {
  const idPrefix = `zukan-result-piece-${useId().replace(/[^\w-]/g, "")}`;
  const path = getZukanSolvedPiecePath(sheetPlace?.problemId);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const flatRef = useRef<SVGSVGElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  useZukanPieceModel(path, { bodyRef, flatRef, shadowRef });

  return (
    <span aria-hidden="true" className="relative block size-full">
      <span
        ref={shadowRef}
        // 浮いたピースの下に落ちる、淡く広い影。ピースの下のタブの先から少し離して置く。
        className="absolute top-[138%] left-[-10%] block h-[26%] w-[120%] rounded-[50%]"
        style={{
          background: `radial-gradient(closest-side, rgb(0 0 0 / ${ZUKAN_PIECE_MATERIAL.dropShadowOpacity}), transparent)`,
        }}
      />
      <span ref={bodyRef} className="absolute inset-0 block">
        <svg
          ref={flatRef}
          viewBox={ZUKAN_PIECE_VIEW_BOX}
          data-zukan-result-piece=""
          data-sheet-game-id={sheetPlace?.gameId}
          data-sheet-problem-id={sheetPlace?.problemId}
          data-sheet-difficulty={sheetPlace?.difficulty}
          data-sheet-index={sheetPlace?.index}
          className="absolute -inset-1/2 block size-[200%] overflow-visible text-(--result-award-soft)"
        >
          <ZukanPieceMaterialDefs
            lightId={`${idPrefix}-light`}
            clips={[{ id: `${idPrefix}-clip`, path }]}
          />
          <ZukanPieceSurface
            path={path}
            clipId={`${idPrefix}-clip`}
            lightId={`${idPrefix}-light`}
          />
        </svg>
      </span>
    </span>
  );
}

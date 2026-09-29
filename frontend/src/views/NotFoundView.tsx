import { useState } from "react";

import { Digit404 } from "@/views/NotFoundView/Digit404";
import { JigsawBoard } from "@/views/NotFoundView/JigsawBoard";
import { JigsawSeamOverlay } from "@/views/NotFoundView/JigsawSeamOverlay";
import {
  createJigsawSeed,
  createNotFoundJigsawLayout,
  type ZeroPieceId,
} from "@/views/NotFoundView/jigsawLayout";
import { LoosePuzzlePiece } from "@/views/NotFoundView/LoosePuzzlePiece";
import { PuzzleListLinkPiece } from "@/views/NotFoundView/PuzzleListLinkPiece";
import { useElementSize } from "@/views/NotFoundView/useElementSize";
import type { SnapPieceStatus } from "@/views/NotFoundView/useSnapPiece";

const zeroPieceOrdinals = {
  upper: "1つ目",
  lower: "2つ目",
} satisfies Record<ZeroPieceId, string>;

export function NotFoundView() {
  const [areaRef, area] = useElementSize<HTMLElement>();
  // 凸凹の模様はページを開くたびに変え、リサイズや再レンダーではピースの位置と噛み合わせを保つため変えない。
  const [jigsawSeed] = useState(createJigsawSeed);
  const [pieceStatuses, setPieceStatuses] = useState<
    Record<ZeroPieceId, SnapPieceStatus>
  >({ upper: "loose", lower: "loose" });
  const layout = area ? createNotFoundJigsawLayout(area, jigsawSeed) : null;

  function changePieceStatus(id: ZeroPieceId, status: SnapPieceStatus) {
    setPieceStatuses((current) => ({ ...current, [id]: status }));
  }

  // 領域の高さは利用可能な高さとして測るため、盤面は領域を押し広げない絶対配置にし、足りない分は縦スクロールで見せる。
  return (
    <section ref={areaRef} className="relative flex-1 overflow-x-clip">
      {layout && (
        <div
          className="absolute inset-x-0 top-0 bg-background"
          style={{ height: layout.height }}
        >
          <JigsawBoard
            digits={layout.digits}
            height={layout.height}
            holes={layout.zeroPieces.map((piece) => ({
              id: piece.id,
              path: piece.path,
              status: pieceStatuses[piece.id],
            }))}
            outlinePath={layout.boardOutlinePath}
            width={layout.width}
          />
          {/* 見出しは盤面に印刷された文字として、背景の継ぎ目の上・前面の継ぎ目の下に描く。 */}
          <h1
            className="absolute inset-x-0 -translate-y-1/2 px-4 text-center text-screen-title text-foreground/80"
            style={{
              fontSize: `calc(var(--text-screen-title) * ${layout.textScale})`,
              lineHeight: `calc(var(--text-screen-title--line-height) * ${layout.textScale})`,
              top: layout.headingCenterY,
            }}
          >
            ページが見つかりません
          </h1>
          <JigsawSeamOverlay
            height={layout.height}
            outlinePath={layout.boardOutlinePath}
            width={layout.width}
          />

          {layout.zeroPieces.map((piece) => (
            <LoosePuzzlePiece
              key={piece.id}
              label={`${zeroPieceOrdinals[piece.id]}の0のピースをドラッグして戻す`}
              placedLabel={`${zeroPieceOrdinals[piece.id]}の0のピースがはまりました`}
              onStatusChange={(status) => changePieceStatus(piece.id, status)}
              path={piece.path}
              pieceSize={layout.pieceSize}
              slot={piece.slot}
              snapRadius={layout.snapRadius}
              start={piece.start}
              status={pieceStatuses[piece.id]}
              tabExtent={layout.tabExtent}
            >
              <Digit404 glyphs={layout.digits} />
            </LoosePuzzlePiece>
          ))}

          <PuzzleListLinkPiece
            height={layout.linkPiece.height}
            path={layout.linkPiece.path}
            tabExtent={layout.tabExtent}
            textScale={layout.textScale}
            width={layout.linkPiece.width}
            x={layout.linkPiece.x}
            y={layout.linkPiece.y}
          />
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import { Digit404 } from "@/views/NotFoundView/MissingPageJigsaw/Digit404";
import { LoosePuzzlePiece } from "@/views/NotFoundView/MissingPageJigsaw/LoosePuzzlePiece";
import { createWholePageJigsawLayout } from "@/views/NotFoundView/MissingPageJigsaw/wholePageJigsawLayout";

type ViewportSize = {
  height: number;
  width: number;
};

const loosePadding = 14;

export function WholePageJigsaw404() {
  const containerRef = useRef<HTMLElement>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({
    height: 760,
    width: 390,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observedContainer = container;

    function updateSize() {
      setViewportSize({
        height: observedContainer.clientHeight,
        width: observedContainer.clientWidth,
      });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(observedContainer);

    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => createWholePageJigsawLayout(viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width],
  );
  const loosePieceSize = layout.pieceSize + loosePadding * 2;
  const looseStartY = layout.digitY + layout.pieceSize * 0.92;
  const looseStarts = [
    viewportSize.width / 2 - layout.pieceSize - loosePadding - 16,
    viewportSize.width / 2 + 16 - loosePadding,
  ];
  const contentTop = Math.min(
    viewportSize.height * 0.62,
    layout.digitY + layout.pieceSize * 2.65,
  );

  return (
    <section
      ref={containerRef}
      className="relative left-1/2 -my-8 min-h-[calc(100dvh-3rem-env(safe-area-inset-top))] w-screen -translate-x-1/2 overflow-hidden bg-background sm:-my-12"
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <defs>
          <mask id="whole-page-404-mask">
            <rect
              width={viewportSize.width}
              height={viewportSize.height}
              fill="white"
            />
            {layout.missingPieces.map((piece) => (
              <path
                key={`mask-${piece.row}-${piece.column}`}
                d={piece.path}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        {layout.pieces.map((piece) => (
          <path
            key={`fill-${piece.row}-${piece.column}`}
            d={piece.path}
            className="fill-background"
          />
        ))}

        <g mask="url(#whole-page-404-mask)">
          <Digit404
            colorClassName="fill-muted-foreground/35"
            fontSize={layout.digitFontSize}
            x={layout.digitX}
            y={layout.digitY}
          />
        </g>

        {layout.pieces.map((piece) => (
          <path
            key={`stroke-${piece.row}-${piece.column}`}
            d={piece.path}
            fill="none"
            className="stroke-border/65"
            strokeWidth="0.45"
          />
        ))}

        {layout.missingPieces.map((piece) => (
          <path
            key={`hole-${piece.row}-${piece.column}`}
            d={piece.path}
            className="fill-muted/20 stroke-border"
            strokeWidth="0.8"
          />
        ))}
      </svg>

      {layout.missingPieces.map((piece, index) => {
        const startX = looseStarts[index] ?? viewportSize.width / 2;
        return (
          <LoosePuzzlePiece
            key={`loose-${piece.row}-${piece.column}`}
            ariaName={`ページ版の${index + 1}つ目の0のピースをドラッグして戻す`}
            placedAriaName={`ページ版の${index + 1}つ目の0のピースがはまりました`}
            piecePath={piece.path}
            startX={startX}
            startY={looseStartY}
            targetX={piece.x - loosePadding}
            targetY={piece.y - loosePadding}
            viewBox={`${piece.x - loosePadding} ${piece.y - loosePadding} ${loosePieceSize} ${loosePieceSize}`}
            width={loosePieceSize}
            height={loosePieceSize}
            colorClassName="fill-background stroke-border"
          >
            <Digit404
              colorClassName="fill-muted-foreground/35"
              fontSize={layout.digitFontSize}
              x={layout.digitX}
              y={layout.digitY}
            />
          </LoosePuzzlePiece>
        );
      })}

      <div
        className="absolute inset-x-0 z-10 flex flex-col items-center gap-6 px-6 text-center"
        style={{ top: contentTop }}
      >
        <h1 className="text-screen-title">ページが見つかりません</h1>

        <Button asChild size="lg">
          <Link to="/">パズル一覧へ戻る</Link>
        </Button>
      </div>
    </section>
  );
}

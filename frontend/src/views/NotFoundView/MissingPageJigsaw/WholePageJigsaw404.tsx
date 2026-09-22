import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import { Digit404 } from "@/views/NotFoundView/MissingPageJigsaw/Digit404";
import { createJigsawPiecePath } from "@/views/NotFoundView/MissingPageJigsaw/jigsawGeometry";
import { LoosePuzzlePiece } from "@/views/NotFoundView/MissingPageJigsaw/LoosePuzzlePiece";

const pieceSize = 52;
const loosePieceSize = 80;
const loosePadding = 14;
const digitX = 43;
const digitY = 112;
const digitFontSize = 104;

const missingPieces = [
  {
    accessibleName: "ページ版の1つ目の0のピースをドラッグして戻す",
    placedName: "ページ版の1つ目の0のピースがはまりました",
    path: createJigsawPiecePath(128, 12, pieceSize, {
      top: "blank",
      right: "tab",
      bottom: "tab",
      left: "blank",
    }),
    pieceX: 128,
    pieceY: 12,
    startX: 66,
    startY: 146,
  },
  {
    accessibleName: "ページ版の2つ目の0のピースをドラッグして戻す",
    placedName: "ページ版の2つ目の0のピースがはまりました",
    path: createJigsawPiecePath(128, 64, pieceSize, {
      top: "blank",
      right: "blank",
      bottom: "tab",
      left: "tab",
    }),
    pieceX: 128,
    pieceY: 64,
    startX: 174,
    startY: 146,
  },
] as const;

export function WholePageJigsaw404() {
  return (
    <section className="relative left-1/2 -my-8 min-h-[calc(100dvh-3rem-env(safe-area-inset-top))] w-screen -translate-x-1/2 overflow-hidden bg-background sm:-my-12">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-border"
      >
        <defs>
          <pattern
            id="whole-page-jigsaw-pattern"
            width="88"
            height="88"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M88 0V27C88 34 70 32 70 44C70 56 88 54 88 61V88M0 88H27C34 88 32 70 44 70C56 70 54 88 61 88H88"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#whole-page-jigsaw-pattern)"
        />
      </svg>

      <div className="relative z-10 flex min-h-[calc(100dvh-3rem-env(safe-area-inset-top))] flex-col items-center justify-center gap-8 px-4 py-8 text-center sm:gap-10 sm:px-6 sm:py-12">
        <div className="relative h-56 w-80 select-none">
          <svg
            aria-hidden="true"
            viewBox="0 0 320 128"
            className="absolute inset-x-0 top-0 w-full overflow-visible"
          >
            <defs>
              <mask id="whole-page-404-mask">
                <rect width="320" height="128" fill="white" />
                {missingPieces.map((piece) => (
                  <path
                    key={piece.accessibleName}
                    d={piece.path}
                    fill="black"
                  />
                ))}
              </mask>
            </defs>

            <g mask="url(#whole-page-404-mask)">
              <Digit404
                colorClassName="fill-muted-foreground/40"
                fontSize={digitFontSize}
                x={digitX}
                y={digitY}
              />
            </g>

            {missingPieces.map((piece) => (
              <path
                key={piece.accessibleName}
                d={piece.path}
                fill="none"
                className="stroke-border"
                strokeWidth="1"
              />
            ))}
          </svg>

          {missingPieces.map((piece) => (
            <LoosePuzzlePiece
              key={piece.accessibleName}
              ariaName={piece.accessibleName}
              placedAriaName={piece.placedName}
              piecePath={piece.path}
              startX={piece.startX}
              startY={piece.startY}
              targetX={piece.pieceX - loosePadding}
              targetY={piece.pieceY - loosePadding}
              viewBox={`${piece.pieceX - loosePadding} ${piece.pieceY - loosePadding} ${loosePieceSize} ${loosePieceSize}`}
              width={loosePieceSize}
              height={loosePieceSize}
            >
              <Digit404
                colorClassName="fill-muted-foreground/40"
                fontSize={digitFontSize}
                x={digitX}
                y={digitY}
              />
            </LoosePuzzlePiece>
          ))}
        </div>

        <h1 className="text-screen-title">ページが見つかりません</h1>

        <Button asChild size="lg">
          <Link to="/">パズル一覧へ戻る</Link>
        </Button>
      </div>
    </section>
  );
}

import { createJigsawPiecePath } from "@/views/NotFoundView/MissingPageJigsaw/jigsawGeometry";
import { useSnapPiece } from "@/views/NotFoundView/MissingPageJigsaw/useSnapPiece";

const pieceSize = 92;
const boardY = 32;
const leftX = 20;
const centerX = leftX + pieceSize;
const rightX = centerX + pieceSize;
const loosePadding = 24;
const looseStart = { x: centerX - loosePadding, y: 154 };
const looseTarget = {
  x: centerX - loosePadding - looseStart.x,
  y: boardY - loosePadding - looseStart.y,
};

const leftPath = createJigsawPiecePath(leftX, boardY, pieceSize, {
  top: "tab",
  right: "blank",
  bottom: "blank",
  left: "flat",
});
const centerPath = createJigsawPiecePath(centerX, boardY, pieceSize, {
  top: "blank",
  right: "tab",
  bottom: "tab",
  left: "tab",
});
const rightPath = createJigsawPiecePath(rightX, boardY, pieceSize, {
  top: "blank",
  right: "flat",
  bottom: "tab",
  left: "blank",
});
const loosePath = createJigsawPiecePath(loosePadding, loosePadding, pieceSize, {
  top: "blank",
  right: "tab",
  bottom: "tab",
  left: "tab",
});

export function ClassicJigsaw() {
  const piece = useSnapPiece({ targetOffset: looseTarget, snapRadius: 42 });
  const offset = piece.isPlaced ? looseTarget : piece.dragOffset;
  const rotation = piece.isPlaced ? 0 : piece.isDragging ? -1 : -6;

  return (
    <div className="relative h-64 w-80 select-none">
      <svg
        aria-hidden="true"
        viewBox="0 0 320 140"
        className="absolute inset-x-0 top-0 w-full overflow-visible"
      >
        <defs>
          <filter
            id="classic-fixed-shadow"
            x="-25%"
            y="-25%"
            width="150%"
            height="170%"
          >
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="5"
              floodColor="rgb(15 23 42 / 0.12)"
            />
          </filter>
          <filter
            id="classic-paper"
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="2"
              seed="17"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.45 0 0 0 0 0.47 0 0 0 0 0.5 0 0 0 0.08 0"
              result="grain-color"
            />
            <feComposite
              in="grain-color"
              in2="SourceAlpha"
              operator="in"
              result="grain"
            />
            <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
          </filter>
        </defs>

        <g filter="url(#classic-fixed-shadow)">
          <path
            d={leftPath}
            transform="translate(0 3)"
            className="fill-muted-foreground opacity-30"
          />
          <path
            d={rightPath}
            transform="translate(0 3)"
            className="fill-muted-foreground opacity-30"
          />
          <path
            d={leftPath}
            className="fill-card stroke-border"
            strokeWidth="1.25"
            filter="url(#classic-paper)"
          />
          <path
            d={rightPath}
            className="fill-card stroke-border"
            strokeWidth="1.25"
            filter="url(#classic-paper)"
          />
          <path
            d={leftPath}
            transform="translate(0 1)"
            fill="none"
            stroke="rgb(255 255 255 / 0.72)"
            strokeWidth="0.9"
          />
          <path
            d={rightPath}
            transform="translate(0 1)"
            fill="none"
            stroke="rgb(255 255 255 / 0.72)"
            strokeWidth="0.9"
          />
        </g>

        <path
          d={centerPath}
          className={
            piece.isNearTarget
              ? "fill-accent/70 stroke-ring"
              : "fill-muted/50 stroke-border/60"
          }
          strokeWidth="1.1"
        />

        <text
          x={leftX + pieceSize / 2}
          y={boardY + 63}
          textAnchor="middle"
          className="fill-foreground text-[52px] font-bold"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          4
        </text>
        <text
          x={rightX + pieceSize / 2}
          y={boardY + 63}
          textAnchor="middle"
          className="fill-foreground text-[52px] font-bold"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          4
        </text>
      </svg>

      <button
        type="button"
        aria-label={
          piece.isPlaced
            ? "0のピースがはまりました"
            : "0のピースをドラッグして戻す"
        }
        aria-pressed={piece.isPlaced}
        disabled={piece.isPlaced}
        onKeyDown={piece.handleKeyDown}
        onPointerCancel={piece.handlePointerCancel}
        onPointerDown={piece.handlePointerDown}
        onPointerMove={piece.handlePointerMove}
        onPointerUp={piece.handlePointerUp}
        className={`absolute h-35 w-35 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 ${
          piece.isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          left: looseStart.x,
          top: looseStart.y,
          transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
          transition: piece.isDragging
            ? undefined
            : "transform var(--duration-slow) var(--ease-enter)",
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 140 140"
          className="h-full w-full overflow-visible"
        >
          <defs>
            <filter
              id="classic-loose-shadow"
              x="-40%"
              y="-40%"
              width="180%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="9"
                stdDeviation="7"
                floodColor="rgb(15 23 42 / 0.22)"
              />
            </filter>
            <filter
              id="classic-loose-paper"
              x="-15%"
              y="-15%"
              width="130%"
              height="130%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="2"
                seed="17"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0.45 0 0 0 0 0.47 0 0 0 0 0.5 0 0 0 0.08 0"
                result="grain"
              />
              <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
            </filter>
          </defs>
          <g filter="url(#classic-loose-shadow)">
            <path
              d={loosePath}
              transform="translate(0 4)"
              className="fill-muted-foreground opacity-40"
            />
            <path
              d={loosePath}
              className="fill-card stroke-border"
              strokeWidth="1.25"
              filter="url(#classic-loose-paper)"
            />
            <path
              d={loosePath}
              transform="translate(0 1)"
              fill="none"
              stroke="rgb(255 255 255 / 0.78)"
              strokeWidth="0.9"
            />
            <text
              x="70"
              y="88"
              textAnchor="middle"
              className="fill-foreground text-[52px] font-bold"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              0
            </text>
          </g>
        </svg>
      </button>

      <span className="sr-only" aria-live="polite">
        {piece.isPlaced ? "404が完成しました" : ""}
      </span>
    </div>
  );
}

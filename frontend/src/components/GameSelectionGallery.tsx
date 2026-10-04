import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { GamePictogram } from "@/components/GamePictogram";
import type { Path } from "@/router";

type GameSelectionGame = {
  name: string;
  pictogramSvg: string;
  to: Path;
};

type PieceEdge = -1 | 0 | 1;

type PieceEdges = {
  top: PieceEdge;
  right: PieceEdge;
  bottom: PieceEdge;
  left: PieceEdge;
};

// ピースは 100x100 の座標系で描き、凸(1)・凹(-1)・平ら(0)を辺ごとに指定する。
const PIECE_SIZE = 100;
const KNOB_RADIUS = 9;
const KNOB_NECK = 5.5;

// 隣同士の左右がかみ合い、上下の凹凸が交互になるジグソーの一列として並べる。
function pieceEdges(index: number, count: number): PieceEdges {
  const isOdd = index % 2 === 1;

  return {
    top: isOdd ? -1 : 1,
    right: index < count - 1 ? 1 : 0,
    bottom: isOdd ? 1 : -1,
    left: index > 0 ? -1 : 0,
  };
}

function piecePath({ top, right, bottom, left }: PieceEdges) {
  const size = PIECE_SIZE;
  const center = size / 2;
  const knob = (edge: PieceEdge, x: number, y: number) =>
    `A${KNOB_RADIUS},${KNOB_RADIUS} 0 1 ${edge > 0 ? 1 : 0} ${x},${y}`;

  return [
    "M0,0",
    top
      ? `H${center - KNOB_NECK} ${knob(top, center + KNOB_NECK, 0)} H${size}`
      : `H${size}`,
    right
      ? `V${center - KNOB_NECK} ${knob(right, size, center + KNOB_NECK)} V${size}`
      : `V${size}`,
    bottom
      ? `H${center + KNOB_NECK} ${knob(bottom, center - KNOB_NECK, size)} H0`
      : "H0",
    left ? `V${center + KNOB_NECK} ${knob(left, 0, center - KNOB_NECK)}` : "",
    "Z",
  ].join(" ");
}

type GameSelectionGalleryProps = {
  games: readonly GameSelectionGame[];
  recordsTo: Path;
};

export function GameSelectionGallery({
  games,
  recordsTo,
}: GameSelectionGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedGame = games[selectedIndex] ?? games[0];
  const listRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const [scrollbar, setScrollbar] = useState({ size: 1, offset: 0 });

  const updateOverflow = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const maxScrollLeft = list.scrollWidth - list.clientWidth;
    const start = list.scrollLeft > 1;
    const end = list.scrollLeft < maxScrollLeft - 1;
    setOverflow((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
    setScrollbar({
      size: list.clientWidth / list.scrollWidth,
      offset: list.scrollLeft / list.scrollWidth,
    });
  }, []);

  useEffect(() => {
    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, [updateOverflow]);

  if (!selectedGame) {
    return null;
  }

  return (
    <section className="grid min-h-[calc(100dvh-3rem-env(safe-area-inset-top))] grid-rows-[29.375rem_minmax(0,1fr)] bg-background sm:grid-rows-[minmax(0,1fr)_14.375rem]">
      <div className="relative min-h-0 bg-muted/30">
        <h1 className="absolute inset-x-0 top-0 z-10 flex h-[4.5rem] items-center justify-center border-b-(length:--border-width-normal) bg-background text-screen-title sm:h-20">
          パズル選択
        </h1>
        <Link
          to={recordsTo}
          className="absolute top-0 right-3 z-20 flex h-[4.5rem] items-center px-2 text-supporting font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:h-20"
        >
          記録
        </Link>

        <Link
          to={selectedGame.to}
          aria-label={`${selectedGame.name}を遊ぶ`}
          className="flex h-full flex-col items-center justify-center transition-colors duration-(--duration-slow) hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="size-[10.625rem] p-4 sm:size-[14.0625rem] sm:p-6">
            <GamePictogram svg={selectedGame.pictogramSvg} />
          </span>
          <span className="mt-2 text-heading sm:mt-3">{selectedGame.name}</span>
        </Link>
      </div>

      <nav
        aria-label="パズル一覧"
        className="min-h-0 overflow-hidden border-t-(length:--border-width-normal) bg-background pt-4 sm:flex sm:items-center sm:px-[max(calc(var(--spacing)*6),calc((100vw-73.75rem)/2))] sm:py-6"
      >
        <div className="w-full">
          <div
            ref={listRef}
            onScroll={updateOverflow}
            data-overflow-start={overflow.start}
            data-overflow-end={overflow.end}
            style={{
              maskImage: `linear-gradient(to right, ${
                overflow.start ? "transparent, black 1.5rem" : "black, black"
              }, ${overflow.end ? "black calc(100% - 1.5rem), transparent" : "black, black"})`,
            }}
            className="flex w-full scroll-px-4 snap-x snap-proximity overflow-x-auto px-4 py-[1.125rem] [scrollbar-width:none] sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {games.map((game, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={game.to}
                  type="button"
                  aria-label={`${game.name}を選択`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedIndex(index)}
                  className={`group relative size-[4.875rem] shrink-0 snap-start focus-visible:outline-none sm:size-[6.25rem] ${isSelected ? "z-10" : ""}`}
                >
                  <svg
                    viewBox={`0 0 ${PIECE_SIZE} ${PIECE_SIZE}`}
                    aria-hidden="true"
                    className="absolute inset-0 size-full overflow-visible"
                  >
                    <path
                      d={piecePath(pieceEdges(index, games.length))}
                      vectorEffect="non-scaling-stroke"
                      className={`fill-background transition-colors group-focus-visible:stroke-ring ${
                        isSelected
                          ? "stroke-ring stroke-3"
                          : "stroke-border stroke-[1.5] group-hover:fill-accent"
                      }`}
                    />
                  </svg>
                  <span className="absolute inset-[10%]">
                    <GamePictogram svg={game.pictogramSvg} />
                  </span>
                </button>
              );
            })}
          </div>
          {scrollbar.size < 1 && (
            <div
              aria-hidden="true"
              className="mx-4 h-1 overflow-hidden rounded-full bg-muted sm:mx-0"
            >
              <div
                className="h-full rounded-full bg-muted-foreground/50"
                style={{
                  width: `${scrollbar.size * 100}%`,
                  transform: `translateX(${(scrollbar.offset / scrollbar.size) * 100}%)`,
                }}
              />
            </div>
          )}
        </div>
      </nav>
    </section>
  );
}

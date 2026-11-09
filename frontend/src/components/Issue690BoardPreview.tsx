import type { CSSProperties } from "react";
import type { Issue690BoardSnapshot } from "@/games/issue690-board-snapshot";

type Issue690BoardPreviewProps = {
  snapshot?: Issue690BoardSnapshot;
  emphasis: "complete" | "trace";
};

export function Issue690BoardPreview({
  snapshot,
  emphasis,
}: Issue690BoardPreviewProps) {
  if (!snapshot) {
    return (
      <div className="i690-board i690-board--missing" aria-hidden="true" />
    );
  }

  if (snapshot.gameId === "water-sort") {
    const isTrace = emphasis === "trace" && !snapshot.reconstructed;
    const columns = Math.min(
      6,
      Math.max(3, Math.ceil(snapshot.bottles.length / 2)),
    );
    const bottleViews = snapshot.bottles.map((bottle, index) => ({
      id: `bottle-${index}`,
      index,
      layers: bottle.map((color, layer) => ({
        id: `layer-${layer}`,
        color,
        layer,
      })),
    }));
    return (
      <div
        className="i690-board i690-board--water"
        data-reconstructed={snapshot.reconstructed}
      >
        <div
          className="i690-water-board"
          style={{ "--board-columns": columns } as CSSProperties}
        >
          {bottleViews.map(({ id, index, layers }) => (
            <div
              key={id}
              className={`i690-water-bottle ${
                !snapshot.reconstructed &&
                index === snapshot.lastMove?.destinationBottleIndex
                  ? "is-final"
                  : ""
              } ${
                isTrace && index === snapshot.lastMove?.destinationBottleIndex
                  ? "is-traced"
                  : ""
              }`}
              style={{ "--bottle-index": index } as CSSProperties}
            >
              <span className="i690-water-bottle-rim" />
              {layers.map(({ id: layerId, color, layer }) => (
                <span
                  key={layerId}
                  className="i690-water-bottle-layer"
                  style={{
                    bottom: `${layer * 25}%`,
                    backgroundColor: snapshot.palette[color],
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cells = snapshot.board.map((value, index) => ({
    id: `cell-${index}`,
    index,
    value,
  }));
  return (
    <div
      className="i690-board i690-board--sudoku"
      data-reconstructed={snapshot.reconstructed}
    >
      <div className="i690-sudoku-board">
        {cells.map(({ id, value, index: cellIndex }) => (
          <span
            key={id}
            className={`i690-sudoku-cell ${
              cellIndex % 9 === 2 || cellIndex % 9 === 5 ? "is-right-heavy" : ""
            } ${
              Math.floor(cellIndex / 9) === 2 || Math.floor(cellIndex / 9) === 5
                ? "is-bottom-heavy"
                : ""
            } ${
              !snapshot.reconstructed && cellIndex === snapshot.lastCellIndex
                ? "is-last"
                : ""
            } ${snapshot.clues[cellIndex] !== null ? "is-clue" : ""}`}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

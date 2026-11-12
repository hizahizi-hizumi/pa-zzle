import { render } from "@testing-library/react";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { HITOFUDE_PUZZLE_PATH_WIDTH } from "@/games/hitofude-puzzle/ui/hitofude-puzzle-tone";

const board = { size: 4, start: 4, holes: [0] };

function renderFigure(path: number[], solved = false, isDeadEnd = false) {
  return render(
    <HitofudePuzzleFigure
      board={board}
      path={path}
      solved={solved}
      isDeadEnd={isDeadEnd}
    />,
  ).container;
}

test("未通過のマスに格子と点を残し、通った領域の境界を沈めること", () => {
  const figure = renderFigure([4, 5, 6]);
  const cells = figure.querySelectorAll("[data-cell-surfaces] rect");
  const visited = Array.from(cells).filter((cell) =>
    cell.getAttribute("class")?.includes("stroke-transparent"),
  );

  expect(visited).toHaveLength(3);
  expect(figure.querySelectorAll("[data-unvisited-node]")).toHaveLength(12);
  expect(figure.querySelector("[data-outline]")).not.toBeNull();
  expect(figure.querySelector("[data-circuit-network]")).toBeNull();
});

test("本番画面でも一本の線が曲がり角から最後まで同じ太さになること", () => {
  const figure = renderFigure([4, 5, 6, 10, 9]);
  const track = figure.querySelector("[data-continuous-track]");

  expect(track?.getAttribute("points")).toBe(
    "0.5,1.5 1.5,1.5 2.5,1.5 2.5,2.5 1.5,2.5",
  );
  expect(Number(track?.getAttribute("stroke-width"))).toBe(
    HITOFUDE_PUZZLE_PATH_WIDTH,
  );
  expect(track?.getAttribute("stroke-linejoin")).toBe("round");
  expect(figure.querySelector("[data-thread-track]")).toBeNull();
  expect(figure.querySelector("[data-drag-stretch]")).toBeNull();
  expect(figure.querySelector("[data-retraction-layer]")).toBeNull();
  expect(figure.querySelector("[data-extension-layer]")).toBeNull();
  expect(figure.querySelectorAll("[data-continuous-track]")).toHaveLength(1);
});

test("線の先端は経路と同じ直径になり、太い丸で膨らませないこと", () => {
  const figure = renderFigure([4, 5, 6]);
  const head = figure.querySelector("[data-head] circle");
  expect(Number(head?.getAttribute("r")) * 2).toBe(HITOFUDE_PUZZLE_PATH_WIDTH);
  expect(head?.getAttribute("stroke-width")).toBeNull();
});

test("完成後も本線の太さを変えず、通過済みの点を復活させないこと", () => {
  const figure = renderFigure([4, 5, 6, 10], true);
  const track = figure.querySelector("[data-continuous-track]");
  const clear = figure.querySelector("[data-clear-trace]");

  expect(clear?.getAttribute("points")).toBe(track?.getAttribute("points"));
  expect(clear?.getAttribute("stroke-width")).toBe(
    track?.getAttribute("stroke-width"),
  );
  expect(figure.querySelectorAll("[data-path-node]")).toHaveLength(0);
  expect(figure.querySelector("[data-end-mark]")).not.toBeNull();
});

test("行き止まりでは先端を標識に変えるが本線の太さは維持すること", () => {
  const figure = renderFigure([4, 5, 6, 10], false, true);
  const deadEndHead = figure.querySelector("[data-head] circle");
  expect(figure.querySelector("[data-head] rect")).not.toBeNull();
  expect(Number(deadEndHead?.getAttribute("r")) * 2).toBe(
    HITOFUDE_PUZZLE_PATH_WIDTH,
  );
  expect(
    figure
      .querySelector("[data-continuous-track]")
      ?.getAttribute("stroke-width"),
  ).toBe(String(HITOFUDE_PUZZLE_PATH_WIDTH));
});

test("残り一マスだけになっても経路を太くせず、未通過の点だけ知らせること", () => {
  const otherBoard = { size: 3, start: 0, holes: [] };
  const { container } = render(
    <HitofudePuzzleFigure
      board={otherBoard}
      path={[0, 1, 2, 5, 4, 3, 6, 7]}
      isDeadEnd={false}
      solved={false}
    />,
  );
  const unvisited = container.querySelectorAll("[data-unvisited-node]");
  expect(unvisited).toHaveLength(1);
  expect(unvisited[0]?.getAttribute("r")).toBe("0.155");
  expect(
    container
      .querySelector("[data-continuous-track]")
      ?.getAttribute("stroke-width"),
  ).toBe(String(HITOFUDE_PUZZLE_PATH_WIDTH));
});

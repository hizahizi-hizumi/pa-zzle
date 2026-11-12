import { updateDragFeedback } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard/update-drag-feedback";

const namespace = "http://www.w3.org/2000/svg";
const board = { size: 3, start: 4, holes: [0, 2] };

function createFigure(points = "1.5,1.5"): SVGSVGElement {
  const figure = document.createElementNS(namespace, "svg");
  figure.innerHTML = `<polyline data-continuous-track="" data-track-points="${points}" points="${points}"/><g data-head=""/>`;
  return figure;
}

function trackPoints(figure: SVGSVGElement) {
  return figure
    .querySelector("[data-continuous-track]")
    ?.getAttribute("points");
}

afterEach(() => vi.unstubAllGlobals());

test("合法な隣接マスへ指を動かすと同じ一本の線を伸ばすこと", () => {
  const figure = createFigure();
  updateDragFeedback(figure, board, [4], { x: 1.8, y: 1.54 });
  expect(trackPoints(figure)).toBe("1.5,1.5 1.8,1.5");
  updateDragFeedback(figure, board, [4], { x: 1.48, y: 1.85 });
  expect(trackPoints(figure)).toBe("1.5,1.5 1.5,1.85");
  updateDragFeedback(figure, board, [4], null);
  expect(trackPoints(figure)).toBe("1.5,1.5");
});

test("手ぶれ・斜め方向・穴・通過済み・外周には予告を出さないこと", () => {
  const figure = createFigure();
  for (const point of [
    { x: 1.53, y: 1.56 },
    { x: 1.7, y: 1.71 },
    { x: 2.5, y: 0.5 },
    { x: 99, y: 1.5 },
  ]) {
    updateDragFeedback(figure, board, [4], point);
    expect(trackPoints(figure)).toBe("1.5,1.5");
  }
});

test("指が隣接先まで飛んでも最大半マスまでの一本線に留めること", () => {
  const figure = createFigure();
  updateDragFeedback(figure, board, [4], { x: 2.99, y: 1.5 });
  expect(trackPoints(figure)).toBe("1.5,1.5 2,1.5");
});

test("引き返すと現在の線の末端だけが短くなり、戻すと元の形に復帰すること", () => {
  const figure = createFigure("1.5,1.5 2.5,1.5");
  updateDragFeedback(figure, board, [4, 5], { x: 1.8, y: 1.5 });
  expect(trackPoints(figure)).toBe("1.5,1.5 2,1.5");
  expect(figure.querySelector("[data-head]")?.getAttribute("transform")).toBe(
    "translate(-0.5 0)",
  );
  updateDragFeedback(figure, board, [4, 5], null);
  expect(trackPoints(figure)).toBe("1.5,1.5 2.5,1.5");
  expect(figure.querySelector("[data-head]")?.hasAttribute("transform")).toBe(
    false,
  );
  expect(figure.querySelectorAll("polyline")).toHaveLength(1);
});

test("動きを減らす設定では予告を出さず、確定した線を残すこと", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const figure = createFigure("1.5,1.5 2.5,1.5");
  updateDragFeedback(figure, board, [4, 5], { x: 1.8, y: 1.5 });
  expect(trackPoints(figure)).toBe("1.5,1.5 2.5,1.5");
});

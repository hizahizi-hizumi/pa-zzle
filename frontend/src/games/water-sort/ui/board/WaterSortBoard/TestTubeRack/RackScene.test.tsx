import { render } from "@testing-library/react";
import { getHeldTubeRisePx } from "@/games/water-sort/ui/board/held-tube";
import {
  TUBE_VIEW_WIDTH,
  TUBE_WALL_THICKNESS,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import { RackScene } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/RackScene";
import type { RackLayout } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/rack-layout";

type Box = { left: number; top: number; right: number; bottom: number };

type Shape = Box & { fill: string };

/** iPhone で14本を2段に並べたときの、盤面を置く入れ物と試験管の位置。 */
const twoRowLayout: RackLayout = {
  headingBottom: -36,
  footerTop: 432,
  width: 374,
  height: 424,
  tubeWidth: 46.6,
  tubeHeight: 129.3,
  left: 0,
  right: 374,
  rows: [
    { top: 77.6, bottom: 206.9 },
    { top: 236.9, bottom: 366.2 },
  ],
};

/** iPhone で6本を2段に並べたときの、盤面を置く入れ物と試験管の位置。窓を置ける壁が低い。 */
const lowHeadroomLayout: RackLayout = {
  headingBottom: -36,
  footerTop: 432,
  width: 374,
  height: 424,
  tubeWidth: 68.2,
  tubeHeight: 189.4,
  left: 66.7,
  right: 307.3,
  rows: [
    { top: 23.2, bottom: 212.6 },
    { top: 235, bottom: 424.4 },
  ],
};

/** チュートリアルで5本を1段に並べたときの、盤面を置く入れ物と試験管の位置。 */
const singleRowLayout: RackLayout = {
  headingBottom: -150,
  footerTop: 183,
  width: 366,
  height: 183,
  tubeWidth: 66,
  tubeHeight: 183,
  left: 0,
  right: 366,
  rows: [{ top: 0, bottom: 183 }],
};

const WINDOW_FILLS = ["--lab-frame", "--lab-pane", "--lab-tree"];
const CABINET_FILLS = ["--lab-seam", "--lab-handle"];

function getWallThickness(layout: RackLayout): number {
  return (layout.tubeWidth * TUBE_WALL_THICKNESS) / TUBE_VIEW_WIDTH;
}

function readFill(element: Element): string {
  const owner = element.closest("[class*='fill-']");
  return owner?.getAttribute("class")?.match(/fill-\(([^)]+)\)/)?.[1] ?? "";
}

function readRectBox(rect: Element): Box {
  const left = Number(rect.getAttribute("x"));
  const top = Number(rect.getAttribute("y"));
  return {
    left,
    top,
    right: left + Number(rect.getAttribute("width")),
    bottom: top + Number(rect.getAttribute("height")),
  };
}

function readCircleBox(circle: Element): Box {
  const cx = Number(circle.getAttribute("cx"));
  const cy = Number(circle.getAttribute("cy"));
  const r = Number(circle.getAttribute("r"));
  return { left: cx - r, top: cy - r, right: cx + r, bottom: cy + r };
}

/** 切り抜きの中に描いた形は、見える所だけの範囲にする。 */
function clipBox(container: HTMLElement, element: Element, box: Box): Box {
  const clipId = element
    .closest("[clip-path]")
    ?.getAttribute("clip-path")
    ?.match(/url\(#(.+)\)/)?.[1];
  const clipRect = clipId
    ? container.querySelector(`clipPath[id="${clipId}"] rect`)
    : null;
  if (!clipRect) {
    return box;
  }
  const clip = readRectBox(clipRect);
  return {
    left: Math.max(box.left, clip.left),
    top: Math.max(box.top, clip.top),
    right: Math.min(box.right, clip.right),
    bottom: Math.min(box.bottom, clip.bottom),
  };
}

function readShapes(container: HTMLElement): Shape[] {
  return [...container.querySelectorAll("rect, circle")]
    .filter((element) => element.closest("clipPath") === null)
    .map((element) => {
      const box =
        element.tagName === "circle"
          ? readCircleBox(element)
          : readRectBox(element);
      return {
        ...clipBox(container, element, box),
        fill: readFill(element),
      };
    });
}

function overlaps(a: Box, b: Box): boolean {
  const margin = 0.01;
  return (
    a.left < b.right - margin &&
    b.left < a.right - margin &&
    a.top < b.bottom - margin &&
    b.top < a.bottom - margin
  );
}

function getTubeArea(layout: RackLayout): Box {
  return {
    left: layout.left,
    right: layout.right,
    top: layout.rows[0]?.top ?? 0,
    bottom: layout.rows[layout.rows.length - 1]?.bottom ?? 0,
  };
}

describe("RackScene", () => {
  test.each([
    ["2段", twoRowLayout],
    ["1段", singleRowLayout],
    ["窓の無い2段", lowHeadroomLayout],
  ])(
    "%sに並べた試験管の後ろには、試験管立ての木の板だけを描くこと",
    (_, layout) => {
      const { container } = render(<RackScene layout={layout} />);

      const fills = readShapes(container)
        .filter((shape) => overlaps(shape, getTubeArea(layout)))
        .map((shape) => shape.fill);

      expect(new Set(fills)).toEqual(new Set(["--lab-wood"]));
    },
  );

  test("窓を、上の見出しの文字とボタンより下、上の段の試験管より上に描くこと", () => {
    const { container } = render(<RackScene layout={twoRowLayout} />);

    const windowShapes = readShapes(container).filter((shape) =>
      WINDOW_FILLS.includes(shape.fill),
    );

    expect({
      drawn: windowShapes.length > 0,
      belowHeading: windowShapes.every(
        (shape) => shape.top >= twoRowLayout.headingBottom,
      ),
      aboveTubes: windowShapes.every(
        (shape) => shape.bottom <= getTubeArea(twoRowLayout).top,
      ),
    }).toEqual({ drawn: true, belowHeading: true, aboveTubes: true });
  });

  test("窓台の下の端を、持ち上げた試験管と試験管ばさみの柄より上に置くこと", () => {
    const { container } = render(<RackScene layout={singleRowLayout} />);

    const windowBottom = Math.max(
      ...readShapes(container)
        .filter((shape) => WINDOW_FILLS.includes(shape.fill))
        .map((shape) => shape.bottom),
    );
    const heldTop =
      (singleRowLayout.rows[0]?.top ?? 0) -
      getHeldTubeRisePx(singleRowLayout.tubeWidth);

    expect(windowBottom).toBeLessThanOrEqual(heldTop);
  });

  test("窓の縦の桟と、流しの戸棚の戸の隙間と取っ手を、試験管の壁より太くしないこと", () => {
    const { container } = render(<RackScene layout={twoRowLayout} />);

    const lineWidths = readShapes(container)
      .filter(
        (shape) =>
          ["--lab-frame", ...CABINET_FILLS].includes(shape.fill) &&
          shape.bottom - shape.top > (shape.right - shape.left) * 3,
      )
      // 位置から幅を引き戻すときの浮動小数点の誤差を除く。
      .map((shape) => Math.round((shape.right - shape.left) * 1000) / 1000);

    expect(lineWidths.length).toBeGreaterThan(0);
    expect(Math.max(...lineWidths)).toBeLessThanOrEqual(
      Math.round(getWallThickness(twoRowLayout) * 1000) / 1000,
    );
  });

  test("戸の隙間と取っ手と框を、盤面より下の操作と文字を置く箱より上にだけ描くこと", () => {
    const { container } = render(<RackScene layout={twoRowLayout} />);

    const doorShapes = readShapes(container).filter((shape) =>
      CABINET_FILLS.includes(shape.fill),
    );

    expect(doorShapes.length).toBeGreaterThan(0);
    expect(Math.max(...doorShapes.map((shape) => shape.bottom))).toBe(
      twoRowLayout.footerTop,
    );
  });

  test.each([
    ["戸を描く高さのある", twoRowLayout],
    ["戸を描く高さの無い", lowHeadroomLayout],
  ])(
    "%s盤面でも、実験台の下を画面の下の端まで戸棚の前の面で塗ること",
    (_, layout) => {
      const { container } = render(<RackScene layout={layout} />);

      const fronts = readShapes(container).filter(
        (shape) => shape.fill === "--lab-cabinet",
      );
      const benchBottom = Math.max(
        ...readShapes(container)
          .filter((shape) => shape.fill === "--lab-bench")
          .map((shape) => shape.bottom),
      );

      expect(fronts.length).toBe(1);
      expect(fronts[0]?.top).toBeLessThanOrEqual(benchBottom);
      expect(fronts[0]?.bottom).toBeGreaterThanOrEqual(layout.height);
    },
  );

  test("実験台と盤面より下の操作と文字を置く箱の間に戸を描く高さが無ければ、戸の隙間と取っ手を描かないこと", () => {
    const { container } = render(<RackScene layout={lowHeadroomLayout} />);

    const doorShapes = readShapes(container).filter((shape) =>
      CABINET_FILLS.includes(shape.fill),
    );

    expect(doorShapes).toEqual([]);
  });

  test("窓として読める高さの壁が無い盤面には、窓を描かないこと", () => {
    const { container } = render(<RackScene layout={lowHeadroomLayout} />);

    const windowShapes = readShapes(container).filter((shape) =>
      WINDOW_FILLS.includes(shape.fill),
    );

    expect(windowShapes).toEqual([]);
  });

  test("実験台の縁を下の段の試験管より下に描くこと", () => {
    const { container } = render(<RackScene layout={twoRowLayout} />);

    const benchTop = Math.min(
      ...readShapes(container)
        .filter((shape) => shape.fill === "--lab-bench")
        .map((shape) => shape.top),
    );

    expect(benchTop).toBeGreaterThanOrEqual(getTubeArea(twoRowLayout).bottom);
  });
});

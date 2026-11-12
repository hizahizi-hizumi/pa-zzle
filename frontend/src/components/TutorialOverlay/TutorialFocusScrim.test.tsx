import { act, cleanup, render } from "@testing-library/react";

import { TutorialFocusScrim } from "@/components/TutorialOverlay/TutorialFocusScrim";
import {
  TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE,
  TUTORIAL_SPOTLIGHT_ATTRIBUTE,
} from "@/components/TutorialSpotlight";

type SpotlightBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius?: string;
};

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  cleanup();
  container.remove();
  vi.useRealTimers();
});

/** 覆いから抜く所の印を付けた要素を、画面の中の位置・大きさ・角丸で置く。 */
function addSpotlight(
  box: SpotlightBox,
  attribute = TUTORIAL_SPOTLIGHT_ATTRIBUTE,
): HTMLElement {
  const element = document.createElement("span");
  element.setAttribute(attribute, "");
  if (box.radius !== undefined) {
    element.style.borderTopLeftRadius = box.radius;
    element.style.borderTopRightRadius = box.radius;
    element.style.borderBottomRightRadius = box.radius;
    element.style.borderBottomLeftRadius = box.radius;
  }
  moveSpotlight(element, box);
  container.append(element);
  return element;
}

function moveSpotlight(element: HTMLElement, box: SpotlightBox): void {
  element.getBoundingClientRect = () =>
    new DOMRect(box.left, box.top, box.width, box.height);
}

function renderScrim(active: boolean) {
  return render(
    <TutorialFocusScrim
      active={active}
      containerRef={{ current: container }}
    />,
  );
}

function getMaskPaths(fill: "white" | "black"): string[] {
  return Array.from(
    document.querySelectorAll(`svg mask path[fill="${fill}"]`),
  ).map((path) => path.getAttribute("d") ?? "");
}

function getScrim(): SVGSVGElement | null {
  return document.querySelector("svg[data-tutorial-focus-scrim]");
}

function getHolePaths(): string[] {
  return Array.from(document.querySelectorAll("svg mask path")).map(
    (path) => path.getAttribute("d") ?? "",
  );
}

describe("TutorialFocusScrim", () => {
  describe("手を引いている場合", () => {
    beforeEach(() => {
      addSpotlight({ left: 10, top: 20, width: 40, height: 30 });
      addSpotlight({
        left: 100,
        top: 20,
        width: 40,
        height: 40,
        radius: "8px",
      });
      renderScrim(true);
    });

    test("画面全体に覆いを出し、印の付いた要素ごとに覆いを抜くこと", () => {
      const scrim = getScrim();
      const holes = getHolePaths();

      expect(scrim).not.toBeNull();
      expect(holes).toHaveLength(2);
    });

    test("角の無い物は角の無い四角で、角丸の物はその角丸で抜くこと", () => {
      const holes = getHolePaths();

      expect(holes[0]).toBe(
        "M10,20 H50 A0,0 0 0 1 50,20 V50 A0,0 0 0 1 50,50 H10 A0,0 0 0 1 10,50 V20 A0,0 0 0 1 10,20 Z",
      );
      expect(holes[1]).toBe(
        "M108,20 H132 A8,8 0 0 1 140,28 V52 A8,8 0 0 1 132,60 H108 A8,8 0 0 1 100,52 V28 A8,8 0 0 1 108,20 Z",
      );
    });
  });

  describe("抜く所が同じ形で重なった場合", () => {
    beforeEach(() => {
      addSpotlight({ left: 0, top: 0, width: 20, height: 20 });
      addSpotlight({ left: 0, top: 0, width: 20, height: 20 });
      renderScrim(true);
    });

    test("1つにまとめて抜くこと", () => {
      const holes = getHolePaths();

      expect(holes).toHaveLength(1);
    });
  });

  describe("大きさの無い要素と、短い辺の半分より大きい角丸の場合", () => {
    beforeEach(() => {
      addSpotlight({ left: 0, top: 0, width: 0, height: 0 });
      addSpotlight({ left: 0, top: 0, width: 40, height: 20, radius: "999px" });
      renderScrim(true);
    });

    test("大きさの無い要素は抜かず、角丸は短い辺の半分までにして抜くこと", () => {
      const holes = getHolePaths();

      expect(holes).toEqual([
        "M10,0 H30 A10,10 0 0 1 40,10 V10 A10,10 0 0 1 30,20 H10 A10,10 0 0 1 0,10 V10 A10,10 0 0 1 10,0 Z",
      ]);
    });
  });

  describe("抜く物が動いた場合", () => {
    let spotlight: HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
      });
      spotlight = addSpotlight({ left: 0, top: 0, width: 20, height: 20 });
      renderScrim(true);
    });

    test("次の描画で、動いた先の形に抜き直すこと", () => {
      moveSpotlight(spotlight, { left: 30, top: 0, width: 20, height: 20 });
      act(() => {
        vi.advanceTimersToNextFrame();
      });

      const holes = getHolePaths();

      expect(holes).toHaveLength(1);
      expect(holes[0]).toMatch(/^M30,0 /);
    });
  });

  describe("覆う範囲を印の付いた範囲に限った場合", () => {
    beforeEach(() => {
      addSpotlight(
        { left: 0, top: 0, width: 100, height: 100, radius: "8px" },
        TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE,
      );
      addSpotlight({ left: 10, top: 10, width: 20, height: 20 });
      render(
        <TutorialFocusScrim
          active={true}
          containerRef={{ current: container }}
          scope="area"
        />,
      );
    });

    test("画面全体ではなく、範囲の印の付いた要素の形だけを覆い、その中の抜く所を抜くこと", () => {
      const scrim = getScrim();
      const screenRects = document.querySelectorAll("svg mask rect");
      const areas = getMaskPaths("white");
      const holes = getMaskPaths("black");

      expect(scrim).not.toBeNull();
      expect(screenRects).toHaveLength(0);
      expect(areas).toEqual([
        "M8,0 H92 A8,8 0 0 1 100,8 V92 A8,8 0 0 1 92,100 H8 A8,8 0 0 1 0,92 V8 A8,8 0 0 1 8,0 Z",
      ]);
      expect(holes).toEqual([
        "M10,10 H30 A0,0 0 0 1 30,10 V30 A0,0 0 0 1 30,30 H10 A0,0 0 0 1 10,30 V10 A0,0 0 0 1 10,10 Z",
      ]);
    });
  });

  describe("覆う範囲を指定しない場合", () => {
    beforeEach(() => {
      addSpotlight(
        { left: 0, top: 0, width: 100, height: 100 },
        TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE,
      );
      addSpotlight({ left: 10, top: 10, width: 20, height: 20 });
      renderScrim(true);
    });

    test("範囲の印を読まず、画面全体を覆って抜く所だけを抜くこと", () => {
      const screenRects = document.querySelectorAll("svg mask rect");
      const areas = getMaskPaths("white");
      const holes = getMaskPaths("black");

      expect(screenRects).toHaveLength(1);
      expect(areas).toEqual([]);
      expect(holes).toHaveLength(1);
    });
  });

  describe("手を引いていない場合", () => {
    beforeEach(() => {
      addSpotlight({ left: 0, top: 0, width: 20, height: 20 });
      renderScrim(false);
    });

    test("覆いを出さず、抜く所も読まないこと", () => {
      const scrim = getScrim();
      const holes = getHolePaths();

      expect(scrim).toBeNull();
      expect(holes).toHaveLength(0);
    });
  });
});

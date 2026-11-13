import { act, cleanup, render } from "@testing-library/react";

import { TutorialFocusScrim } from "@/components/TutorialOverlay/TutorialFocusScrim";
import { TUTORIAL_SPOTLIGHT_ATTRIBUTE } from "@/components/TutorialSpotlight";

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

function addSpotlight(box: SpotlightBox): HTMLElement {
  const element = document.createElement("span");
  element.setAttribute(TUTORIAL_SPOTLIGHT_ATTRIBUTE, "");
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

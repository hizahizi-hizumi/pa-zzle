import { cleanup, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";

import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: Element["animate"] }).animate;
});

describe("IceFloorMazeBoard", () => {
  // 0 から右へ外壁まで滑って 3 で止まり、続けて右を選ぶと外壁で1マスも動けない。
  const board = parseIceFloorMazeBoard(["....", "....", "....", "...."]);
  const lastSlide: IceFloorMazeLastSlide = {
    id: 1,
    direction: "right",
    from: 0,
    to: 3,
    path: [1, 2, 3],
    crumbledRock: null,
    crackedIce: [],
    passedGoal: false,
    isClearingMove: false,
    entersTrap: false,
  };
  const blockedInput: IceFloorMazeBlockedInput = {
    id: 2,
    direction: "right",
    from: 3,
    stopper: null,
  };

  describe("滑っている間に成立しない向きを選んだ場合", () => {
    let cancelAnimation: Mock<() => void>;
    let onSlideAnimationActivityChange: Mock<(active: boolean) => void>;
    let renderBoard: (blocked: IceFloorMazeBlockedInput | null) => void;

    beforeEach(() => {
      cancelAnimation = vi.fn();
      onSlideAnimationActivityChange = vi.fn();
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: vi.fn(
          () =>
            ({
              finished: new Promise<void>(() => {}),
              cancel: cancelAnimation,
            }) as unknown as Animation,
        ),
      });
      const element = (blocked: IceFloorMazeBlockedInput | null) => (
        <IceFloorMazeBoard
          board={board}
          cells={board.cells}
          goal={15}
          position={3}
          lastSlide={lastSlide}
          blockedInput={blocked}
          clearing={false}
          onSlideAnimationActivityChange={onSlideAnimationActivityChange}
          onClearAnimationComplete={vi.fn()}
        />
      );
      const { rerender } = render(element(null));
      renderBoard = (blocked) => rerender(element(blocked));
    });

    test("直前の滑りの跡を残し、滑りを止めないこと", () => {
      renderBoard(blockedInput);

      const trails = screen
        .getByRole("img", { name: "盤面" })
        .querySelectorAll("[data-trail]");

      expect(trails).toHaveLength(1);
      expect(cancelAnimation).not.toHaveBeenCalled();
      expect(onSlideAnimationActivityChange).toHaveBeenLastCalledWith(true);
    });
  });

  describe("要素が変わった盤面の場合", () => {
    // b c x
    // 3 4 5
    // 6 7 8
    // もろい岩 0 が崩れて氷になり、薄い氷 1 が割れて水面になった。
    const elementBoard = parseIceFloorMazeBoard(["bcx", "...", "..."]);
    const cells = ["ice", "water", ...elementBoard.cells.slice(2)] as const;

    beforeEach(() => {
      render(
        <IceFloorMazeBoard
          board={elementBoard}
          cells={cells}
          goal={8}
          position={3}
          lastSlide={null}
          blockedInput={null}
          clearing={false}
          onSlideAnimationActivityChange={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />,
      );
    });

    test("初期盤面ではなく今の盤面のマスを描くこと", () => {
      const boardImage = screen.getByRole("img", { name: "盤面" });

      const drawn = {
        brittleRock: boardImage.querySelectorAll("[data-brittle-rock-cell]"),
        thinIce: boardImage.querySelectorAll("[data-thin-ice-cell]"),
        water: boardImage.querySelectorAll("[data-water-cell]"),
      };

      expect(drawn.brittleRock).toHaveLength(0);
      expect(drawn.thinIce).toHaveLength(0);
      expect(drawn.water).toHaveLength(1);
    });
  });

  describe("盤面の外がある盤面の場合", () => {
    // x . .
    // . x .
    // . . .
    // 左上の角と真ん中が盤面の外。
    const outsideBoard = parseIceFloorMazeBoard(["x..", ".x.", "..."]);

    beforeEach(() => {
      render(
        <IceFloorMazeBoard
          board={outsideBoard}
          cells={outsideBoard.cells}
          goal={8}
          position={3}
          lastSlide={null}
          blockedInput={null}
          clearing={false}
          onSlideAnimationActivityChange={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />,
      );
    });

    test("盤面の外を描かず、外壁を盤面として描くマスの形に沿わせること", () => {
      const wall = screen
        .getByRole("img", { name: "盤面" })
        .querySelector("[data-wall]");

      const wallCells = wall?.getAttribute("d")?.match(/M\d+ \d+/g);

      expect(wallCells).toEqual([
        "M1 0",
        "M2 0",
        "M0 1",
        "M2 1",
        "M0 2",
        "M1 2",
        "M2 2",
      ]);
    });
  });

  describe("要素を変えた滑りの直後の場合", () => {
    // 0  1  2  3
    // c  c  6  7
    // 8  9  10 11
    // 12 13 14 b
    const changedBoard = parseIceFloorMazeBoard([
      "....",
      "cc..",
      "....",
      "...b",
    ]);
    // 薄い氷 4 から右へ滑って 7 で止まり、出発マス 4 と通過した 5 が割れて水面になった。
    const crackingSlide: IceFloorMazeLastSlide = {
      id: 3,
      direction: "right",
      from: 4,
      to: 7,
      path: [5, 6, 7],
      crumbledRock: null,
      crackedIce: [4, 5],
      passedGoal: false,
      isClearingMove: false,
      entersTrap: false,
    };
    // 3 から下へ滑ってもろい岩 15 の手前の 11 で止まり、15 が崩れて氷になった。
    const crumblingSlide: IceFloorMazeLastSlide = {
      id: 4,
      direction: "down",
      from: 3,
      to: 11,
      path: [7, 11],
      crumbledRock: 15,
      crackedIce: [],
      passedGoal: false,
      isClearingMove: false,
      entersTrap: false,
    };
    let animate: Mock;

    function renderSlide(slide: IceFloorMazeLastSlide, reduced: boolean) {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: reduced }) as MediaQueryList),
      );
      render(
        <IceFloorMazeBoard
          board={changedBoard}
          cells={changedBoard.cells.map((cell, cellIndex) =>
            slide.crackedIce.includes(cellIndex)
              ? "water"
              : cellIndex === slide.crumbledRock
                ? "ice"
                : cell,
          )}
          goal={0}
          position={slide.to}
          lastSlide={slide}
          blockedInput={null}
          clearing={false}
          onSlideAnimationActivityChange={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />,
      );
    }

    /** 再生した動きのうち、`selector` に当たる要素の中のものと、その遅れ。 */
    function listAnimatedWithin(selector: string) {
      return animate.mock.contexts.flatMap((element, call) => {
        const container = (element as Element).closest(selector);
        const options = animate.mock.calls[call]?.[1] as
          | KeyframeAnimationOptions
          | undefined;
        return container && element !== container
          ? [{ element: element as Element, container, delay: options?.delay }]
          : [];
      });
    }

    beforeEach(() => {
      animate = vi.fn(
        () =>
          ({
            finished: new Promise<void>(() => {}),
            cancel: vi.fn(),
          }) as unknown as Animation,
      );
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: animate,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("薄い氷を割った場合", () => {
      beforeEach(() => {
        renderSlide(crackingSlide, false);
      });

      test("割れた薄い氷の破片を、駒が離れる順に遅らせて割ること", () => {
        const shards = listAnimatedWithin("[data-cracking-ice]").filter(
          ({ element }) => element.hasAttribute("data-thin-ice-shard"),
        );

        const delayByCell = Object.fromEntries(
          shards.map(({ container, delay }) => [
            container.getAttribute("data-cracking-ice"),
            delay,
          ]),
        );

        expect(shards).toHaveLength(6);
        expect(delayByCell["4"]).toBeLessThan(delayByCell["5"] as number);
      });
    });

    describe("もろい岩を崩した場合", () => {
      beforeEach(() => {
        renderSlide(crumblingSlide, false);
      });

      test("崩れたもろい岩の左右の塊を、駒が止まった時刻に崩すこと", () => {
        const halves = listAnimatedWithin("[data-crumbling-rock]").filter(
          ({ element }) => element.hasAttribute("data-brittle-half"),
        );

        expect(halves.map(({ delay }) => delay)).toEqual([109, 109]);
      });
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        renderSlide(crackingSlide, true);
      });

      test("崩れる・割れる動きを再生しないこと", () => {
        const changes = listAnimatedWithin("[data-cracking-ice]");

        expect(changes).toHaveLength(0);
      });
    });
  });

  describe("隣のもろい岩へ押した場合", () => {
    // 0 b 2
    // 3 4 5
    // 6 7 8
    // 0 から右は隣のもろい岩 1 に阻まれて1マスも動けない。
    const pushedBoard = parseIceFloorMazeBoard([".b.", "...", "..."]);
    const pushedInput: IceFloorMazeBlockedInput = {
      id: 5,
      direction: "right",
      from: 0,
      stopper: 1,
    };
    let animate: Mock;
    let renderBoard: (blocked: IceFloorMazeBlockedInput | null) => void;

    beforeEach(() => {
      animate = vi.fn();
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: animate,
      });
      const element = (blocked: IceFloorMazeBlockedInput | null) => (
        <IceFloorMazeBoard
          board={pushedBoard}
          cells={pushedBoard.cells}
          goal={8}
          position={0}
          lastSlide={null}
          blockedInput={blocked}
          clearing={false}
          onSlideAnimationActivityChange={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />
      );
      const { rerender } = render(element(null));
      renderBoard = (blocked) => rerender(element(blocked));
    });

    test("押されたもろい岩を揺らし、崩さないこと", () => {
      renderBoard(pushedInput);

      const shaken = animate.mock.contexts.map((element) =>
        (element as Element)
          .closest("[data-brittle-rock-cell]")
          ?.getAttribute("data-brittle-rock-cell"),
      );
      const brittleRocks = screen
        .getByRole("img", { name: "盤面" })
        .querySelectorAll("[data-brittle-rock-cell]");

      expect(shaken).toContain("1");
      expect(brittleRocks).toHaveLength(1);
    });
  });
});

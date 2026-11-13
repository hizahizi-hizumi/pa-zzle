import { cleanup, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";

import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  type IceFloorMazeBoard as IceFloorMazeBoardState,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import { getIceFloorMazeSlideDurationMs } from "@/games/ice-floor-maze/ui/board/slide-timing";

function listInitialCells(
  board: IceFloorMazeBoardState,
): readonly IceFloorMazeStateCell[] {
  return createIceFloorMazeInitialState(board, 0).cells;
}

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
    pushedSnow: null,
    movedBlock: null,
    stoppedOnFloor: false,
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
          cells={listInitialCells(board)}
          blocks={[]}
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

  describe("直前の滑りがある場合", () => {
    // 0 から右へ滑り、3 の岩の手前の 2 で止まる。
    const rockBoard = parseIceFloorMazeBoard(["...#", "....", "....", "...."]);
    const rockSlide: IceFloorMazeLastSlide = {
      ...lastSlide,
      to: 2,
      path: [1, 2],
    };
    const stopsWithoutImpact = [
      ["床に入って止まった", { stoppedOnFloor: true }],
      ["雪を押し出した", { pushedSnow: { from: 2, to: 3 } }],
      ["滑る氷の塊を押した", { movedBlock: { from: 2, to: 3 } }],
      ["ゴールで止まった", { isClearingMove: true }],
    ] as const;

    let onSlideAnimationActivityChange: Mock<(active: boolean) => void>;
    let onClearAnimationComplete: Mock<() => void>;

    beforeEach(() => {
      onSlideAnimationActivityChange = vi.fn();
      onClearAnimationComplete = vi.fn();
    });

    function createRockBoard(slide: IceFloorMazeLastSlide, clearing = false) {
      return (
        <IceFloorMazeBoard
          board={rockBoard}
          cells={listInitialCells(rockBoard)}
          blocks={[]}
          goal={15}
          position={slide.to}
          lastSlide={slide}
          blockedInput={null}
          clearing={clearing}
          onSlideAnimationActivityChange={onSlideAnimationActivityChange}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      );
    }

    describe("岩にぶつかって止まった滑りの場合", () => {
      beforeEach(() => {
        render(createRockBoard(rockSlide));
      });

      test("ぶつかった面に当たりの光と氷のかけらを置くこと", () => {
        const boardImage = screen.getByRole("img", { name: "盤面" });

        const drawn = {
          chips: boardImage.querySelectorAll("[data-impact-spray] [data-chip]"),
          flash: boardImage.querySelectorAll(
            "[data-impact-spray] [data-impact-flash]",
          ),
        };

        expect(drawn.chips.length).toBeGreaterThan(0);
        expect(drawn.flash).toHaveLength(1);
      });
    });

    describe("動かせる環境の場合", () => {
      const slideMs = getIceFloorMazeSlideDurationMs(rockSlide.path.length);
      let animate: Mock;

      function listAnimationTimings(selector: string) {
        return animate.mock.contexts.flatMap((element, call) => {
          const options = animate.mock.calls[call]?.[1] as
            | KeyframeAnimationOptions
            | undefined;
          return (element as Element).matches(selector)
            ? [{ delay: options?.delay, duration: options?.duration }]
            : [];
        });
      }

      beforeEach(() => {
        vi.stubGlobal(
          "matchMedia",
          vi.fn(() => ({ matches: false }) as MediaQueryList),
        );
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

      describe("岩にぶつかって止まった滑りの場合", () => {
        beforeEach(() => {
          render(createRockBoard(rockSlide));
        });

        test("滑っている間だけ駒を回すこと", () => {
          const spins = listAnimationTimings("[data-piece-spin]");

          expect(spins).toEqual([{ delay: undefined, duration: slideMs }]);
        });

        test("止まった時刻に当たりの光と氷のかけらを動かすこと", () => {
          const delays = [
            ...listAnimationTimings("[data-impact-flash]"),
            ...listAnimationTimings("[data-chip]"),
          ].map(({ delay }) => delay);

          expect(delays.length).toBeGreaterThan(1);
          expect(new Set(delays)).toEqual(new Set([slideMs]));
        });
      });

      describe("ゴールで止まって完成した場合", () => {
        beforeEach(() => {
          render(createRockBoard({ ...rockSlide, isClearingMove: true }, true));
        });

        test("止まった時刻から、明かりに続けて輪を1つずつ遅らせて広げること", () => {
          const delays = {
            glow: listAnimationTimings("[data-clear-glow]").map(
              ({ delay }) => delay,
            ),
            rings: listAnimationTimings("[data-clear-ring]").map(
              ({ delay }) => delay,
            ),
          };

          expect(delays).toEqual({
            glow: [slideMs],
            rings: [slideMs, slideMs + 80, slideMs + 160],
          });
        });
      });
    });

    describe.each(stopsWithoutImpact)("%s滑りの場合", (_, change) => {
      beforeEach(() => {
        render(createRockBoard({ ...rockSlide, ...change }));
      });

      test("氷のかけらを置かないこと", () => {
        const boardImage = screen.getByRole("img", { name: "盤面" });

        const spray = boardImage.querySelector("[data-impact-spray]");

        expect(spray).toBeNull();
      });
    });
  });

  describe("要素が変わった盤面の場合", () => {
    // b c x
    // 3 4 5
    // 6 7 8
    // もろい岩 0 が崩れて氷になり、薄い氷 1 が割れて水面になった。
    const elementBoard = parseIceFloorMazeBoard(["bcx", "...", "..."]);
    const cells: readonly IceFloorMazeStateCell[] = [
      "ice",
      "water",
      ...listInitialCells(elementBoard).slice(2),
    ];

    beforeEach(() => {
      render(
        <IceFloorMazeBoard
          board={elementBoard}
          cells={cells}
          blocks={[]}
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

  describe("床のある盤面で、床に入って止まった直後の場合", () => {
    // 0 1 o
    // 3 4 5
    // 0 から右へ滑り、床 2 に入って止まった。
    const floorBoard = parseIceFloorMazeBoard(["..o", "..."]);

    beforeEach(() => {
      render(
        <IceFloorMazeBoard
          board={floorBoard}
          cells={listInitialCells(floorBoard)}
          blocks={[]}
          goal={5}
          position={2}
          lastSlide={{
            ...lastSlide,
            to: 2,
            path: [1, 2],
            stoppedOnFloor: true,
          }}
          blockedInput={null}
          clearing={false}
          onSlideAnimationActivityChange={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />,
      );
    });

    test("床を描き、直前の滑りの跡を床の上に重ねること", () => {
      const boardImage = screen.getByRole("img", { name: "盤面" });
      const floor = boardImage.querySelector('[data-floor-cell="2"]');
      const trail = boardImage.querySelector("[data-trail]");

      expect(floor).not.toBeNull();
      expect(trail).not.toBeNull();
      expect(
        floor!.compareDocumentPosition(trail!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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
          cells={listInitialCells(outsideBoard)}
          blocks={[]}
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
      pushedSnow: null,
      movedBlock: null,
      stoppedOnFloor: false,
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
      pushedSnow: null,
      movedBlock: null,
      stoppedOnFloor: false,
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
          blocks={[]}
          cells={listInitialCells(changedBoard).map((cell, cellIndex) =>
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
          cells={listInitialCells(pushedBoard)}
          blocks={[]}
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
  describe.each([
    [
      "押し出した雪山",
      ["snow", "ice", "ice", "ice", "snow-mound", "ice", "ice", "ice", "ice"],
      [8],
      '[data-snow-mound-cell="4"]',
      false,
    ],
    [
      "押した滑る氷の塊",
      ["snow", "ice", "ice", "ice", "ice", "ice", "ice", "ice", "ice"],
      [4],
      '[data-sliding-block-cell="4"]',
      true,
    ],
  ] as const)(
    "%sがゴールをふさいだ盤面の場合",
    (_, cells, blocks, coveringSelector, drawsGoalMark) => {
      // s 1 2
      // 3 G 5
      // 6 7 8
      // 雪 0 と、ゴール 4 をふさぐ雪山か塊がある。
      const coveredBoard = parseIceFloorMazeBoard(["s..", "...", "..."]);

      beforeEach(() => {
        render(
          <IceFloorMazeBoard
            board={coveredBoard}
            cells={cells}
            blocks={blocks}
            goal={4}
            position={2}
            lastSlide={null}
            blockedInput={null}
            clearing={false}
            onSlideAnimationActivityChange={vi.fn()}
            onClearAnimationComplete={vi.fn()}
          />,
        );
      });

      test("ゴールをふさぐ要素を描き、動かせる塊の下にだけゴールの印を残すこと", () => {
        const boardImage = screen.getByRole("img", { name: "盤面" });
        const goalMark = boardImage.querySelector("[data-goal]");
        const covering = boardImage.querySelector(coveringSelector);

        expect(covering).not.toBeNull();
        expect(goalMark !== null).toBe(drawsGoalMark);
        if (goalMark !== null) {
          expect(
            goalMark.compareDocumentPosition(covering!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy();
        }
      });

      test("雪と、状態の塊のマスにある塊を描くこと", () => {
        const boardImage = screen.getByRole("img", { name: "盤面" });

        const drawnBlocks = Array.from(
          boardImage.querySelectorAll("[data-sliding-block-cell]"),
          (block) => Number(block.getAttribute("data-sliding-block-cell")),
        );
        const snow = boardImage.querySelectorAll("[data-snow-cell]");

        expect(drawnBlocks).toEqual(blocks);
        expect(snow).toHaveLength(1);
      });
    },
  );

  describe("雪を押し出し、滑る氷の塊を押した滑りの直後の場合", () => {
    // 0  1  2  3
    // 4  5  6  7
    // 0 から右へ2マス滑り、1 から塊 2 を押して 3 まで動かし、2 で止まった。
    // 4 から右へ2マス滑り、雪 6 を 7 へ押し出して雪山にし、6 で止まった。
    // どちらの滑りも2マスで 109 ミリ秒。1マス進んだ 54.5 ミリ秒に、駒が塊に触れ、雪のマスに入り始める。
    const movedBoard = parseIceFloorMazeBoard(["..m.", "..s."]);
    const blockSlide: IceFloorMazeLastSlide = {
      ...lastSlide,
      from: 0,
      to: 2,
      path: [1, 2],
      movedBlock: { from: 2, to: 3 },
    };
    const snowSlide: IceFloorMazeLastSlide = {
      ...lastSlide,
      from: 4,
      to: 6,
      path: [5, 6],
      pushedSnow: { from: 6, to: 7 },
    };
    const movedCells: readonly IceFloorMazeStateCell[] = [
      "ice",
      "ice",
      "ice",
      "ice",
      "ice",
      "ice",
      "ice",
      "snow-mound",
    ];
    let animate: Mock;

    function renderSlide(slide: IceFloorMazeLastSlide, reduced: boolean) {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: reduced }) as MediaQueryList),
      );
      render(
        <IceFloorMazeBoard
          board={movedBoard}
          cells={movedCells}
          blocks={[3]}
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

    function listAnimationTimings(selector: string) {
      return animate.mock.contexts.flatMap((element, call) => {
        const options = animate.mock.calls[call]?.[1] as
          | KeyframeAnimationOptions
          | undefined;
        return (element as Element).matches(selector)
          ? [
              {
                delay: options?.delay,
                duration: options?.duration,
                fill: options?.fill,
              },
            ]
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

    describe("雪を押し出した場合", () => {
      beforeEach(() => {
        renderSlide(snowSlide, false);
      });

      test("駒が雪のマスに入り始める時刻に押し出した雪を動かし、少し後に先のマスの雪山を盛り上げること", () => {
        const pushedSnow = listAnimationTimings("[data-snow-body]");
        const risingMound = listAnimationTimings(
          '[data-snow-mound-cell="7"] > [data-cell-body]',
        );

        expect(pushedSnow).toEqual([
          { delay: 54.5, duration: 180, fill: "both" },
        ]);
        expect(risingMound).toEqual([
          { delay: 144.5, duration: 240, fill: "backwards" },
        ]);
      });
    });

    describe("滑る氷の塊を押した場合", () => {
      beforeEach(() => {
        renderSlide(blockSlide, false);
      });

      test("駒が触れた時刻から駒と同じ速さで塊を滑らせ、止まった時刻に塊をつぶすこと", () => {
        const sliding = listAnimationTimings(
          '[data-sliding-block-cell="3"] [data-block-shift]',
        );
        const squashing = listAnimationTimings(
          '[data-sliding-block-cell="3"] [data-cell-body]',
        );

        expect(sliding).toEqual([
          { delay: 54.5, duration: 54.5, fill: "backwards" },
        ]);
        expect(squashing).toEqual([
          { delay: 109, duration: 180, fill: undefined },
        ]);
      });
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        renderSlide(blockSlide, true);
      });

      test("塊を動かさないこと", () => {
        const sliding = listAnimationTimings("[data-block-shift]");

        expect(sliding).toHaveLength(0);
      });
    });
  });

  describe("隣の滑る氷の塊へ押した場合", () => {
    // 0 m 2
    // 3 4 5
    // 0 から右は隣の塊 1 に阻まれて1マスも動けない。
    const pushedBoard = parseIceFloorMazeBoard([".m.", "..."]);
    const pushedInput: IceFloorMazeBlockedInput = {
      id: 6,
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
          cells={listInitialCells(pushedBoard)}
          blocks={[1]}
          goal={5}
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

    test("押された塊をわずかにずらして戻し、動かさないこと", () => {
      renderBoard(pushedInput);

      const nudged = animate.mock.contexts.map((element) =>
        (element as Element)
          .closest("[data-sliding-block-cell]")
          ?.getAttribute("data-sliding-block-cell"),
      );
      const blocks = Array.from(
        screen
          .getByRole("img", { name: "盤面" })
          .querySelectorAll("[data-sliding-block-cell]"),
        (block) => block.getAttribute("data-sliding-block-cell"),
      );

      expect(nudged).toContain("1");
      expect(blocks).toEqual(["1"]);
    });
  });
});

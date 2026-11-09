import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { bridgesLevelCombinations } from "@/games/bridges/difficulty";
import {
  _private,
  BRIDGES_TUTORIAL_BOARD,
} from "@/games/bridges/tutorial/tutorial";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { edgeBetween, islandAt } = _private;

/** 盤面の1マスを 100px で置いたときの、押す所。マスの左上の角を原点にしたマス単位の座標。 */
type BoardPoint = readonly [x: number, y: number];

/** 辺の線の上の、ほかの辺から離れた所。 */
const edgePoints = {
  center: [2.5, 1.5],
  rightBottom: [4.5, 3.5],
  rightTop: [4.5, 1.5],
  leftTop: [0.5, 1.5],
  leftBottom: [0.5, 3.5],
  bottom: [2.5, 4.5],
  top: [1.5, 0.5],
  topRight: [3.5, 0.5],
  middle: [1.5, 2.5],
} as const satisfies Record<string, BoardPoint>;

/** 手順ごとに押す所。2本架ける手順は2回押す。 */
const stepTaps: readonly BoardPoint[] = [
  edgePoints.center,
  edgePoints.center,
  edgePoints.rightBottom,
  edgePoints.rightBottom,
  edgePoints.rightTop,
  edgePoints.leftTop,
];

/** 手順を終えた後に残る、解の橋。 */
const remainingTaps: readonly BoardPoint[] = [
  edgePoints.bottom,
  edgePoints.top,
  edgePoints.topRight,
];

const violationReactionDelayMs = 500;
const idleHintDelayMs = 4000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

/** 場面の動きを待たずに「次へ」を続けて押し、ゴールと始まりの盤面を通って最初の手順から始める。 */
function pressNextThroughIntro(): void {
  for (
    let next = screen.queryByRole("button", { name: "次へ" });
    next;
    next = screen.queryByRole("button", { name: "次へ" })
  ) {
    fireEvent.click(next);
  }
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "ブリッジパズル盤面 5行5列" });
}

function tap([x, y]: BoardPoint): void {
  const board = getBoard();
  vi.spyOn(board, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 500, 500),
  );
  fireEvent.pointerDown(board, {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: x * 100,
    clientY: y * 100,
  });
}

/** 島の丸の中を押して、動かさずに離す。 */
function pressIsland([x, y]: BoardPoint): void {
  const board = getBoard();
  vi.spyOn(board, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 500, 500),
  );
  const point = {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: x * 100,
    clientY: y * 100,
  };
  fireEvent.pointerDown(board, point);
  fireEvent.pointerUp(board, point);
}

function tapAll(points: readonly BoardPoint[]): void {
  for (const point of points) {
    tap(point);
  }
}

/** 1始まりの行・列の島の読み上げ。 */
function getIslandLabel(row: number, column: number): string {
  return (
    within(getBoard()).getByRole("button", {
      name: new RegExp(`^${row}行${column}列の島`),
    }).textContent ?? ""
  );
}

function getEdgesWithCue(cue: "mark" | "recall" | "acknowledgement"): number[] {
  return [...getBoard().querySelectorAll(`[data-tutorial-cue="${cue}"]`)].map(
    (element) =>
      Number(element.closest("[data-cue-edge]")?.getAttribute("data-cue-edge")),
  );
}

function getSpotlit(kind: "island" | "edge"): number[] {
  return [...getBoard().querySelectorAll(`[data-spotlit-${kind}]`)]
    .map((element) => Number(element.getAttribute(`data-spotlit-${kind}`)))
    .sort((left, right) => left - right);
}

function hasFocusScrim(): boolean {
  return document.querySelector("[data-tutorial-focus-scrim]") !== null;
}

/** 鳴らした効果音の音声ファイル名。 */
function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

function sorted(values: readonly number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

describe("BridgesTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    stubReducedMotion();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "1", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <BridgesTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
    });

    test("導入でゴールの盤面を見せ、次へで橋の無い始まりの盤面へ替えること", () => {
      const goalLabel = getIslandLabel(1, 3);
      fireEvent.click(screen.getByRole("button", { name: "次へ" }));
      const startLabel = getIslandLabel(1, 3);

      expect(goalLabel).toBe("1行3列の島 数字4 橋4本 ちょうど");
      expect(startLabel).toBe("1行3列の島 数字4 橋0本");
    });

    describe("導入を終えた場合", () => {
      beforeEach(() => {
        pressNextThroughIntro();
      });

      test("操作の一言を出し、上の4と真ん中の2の間に印を付け、そこと両端の島だけを覆いから抜くこと", () => {
        const headline = screen.queryByText(/島と島の間を押すと/);
        const marked = getEdgesWithCue("mark");
        const spotlitIslands = getSpotlit("island");
        const spotlitEdges = getSpotlit("edge");

        expect(headline).not.toBeNull();
        expect(marked).toEqual([edgeBetween([1, 3], [4, 3])]);
        expect(hasFocusScrim()).toBe(true);
        expect(spotlitIslands).toEqual(
          sorted([islandAt(1, 3), islandAt(4, 3)]),
        );
        expect(spotlitEdges).toEqual([edgeBetween([1, 3], [4, 3])]);
      });

      test("印の無い所を押すと、橋を架けず音も鳴らさず、印の線を濃くし直すこと", () => {
        tap(edgePoints.bottom);

        expect(getIslandLabel(5, 1)).toBe("5行1列の島 数字1 橋0本");
        expect(getPlayedSoundNames()).toEqual([]);
        expect(getEdgesWithCue("recall")).toEqual([
          edgeBetween([1, 3], [4, 3]),
        ]);
      });

      test("印の縦の帯が横の辺と交わる所を押しても、印の辺として橋を架けること", () => {
        tap([2.5, 2.5]);

        expect(getIslandLabel(4, 3)).toBe("4行3列の島 数字2 橋1本");
      });

      test("島の丸を押して動かさずに離すと、橋を架けず、印の線を濃くし直すこと", () => {
        pressIsland([0.5, 0.5]);

        expect(getIslandLabel(1, 1)).toBe("1行1列の島 数字2 橋0本");
        expect(getEdgesWithCue("recall")).toEqual([
          edgeBetween([1, 3], [4, 3]),
        ]);
      });

      test("印の辺を押すと、本番と同じ架ける音を鳴らして応え、もう一度押す手順へ進むこと", () => {
        tap(edgePoints.center);

        expect(getIslandLabel(4, 3)).toBe("4行3列の島 数字2 橋1本");
        expect(getPlayedSoundNames()).toEqual(["bridge-placed.flac"]);
        expect(getEdgesWithCue("acknowledgement")).toEqual([
          edgeBetween([1, 3], [4, 3]),
        ]);
        expect(screen.queryByText(/もう一度押すと/)).not.toBeNull();
        expect(
          screen.queryByText(/1か所に架けられるのは\s*2本までです/),
        ).not.toBeNull();
      });

      test("交差の手順で、右の3と、交わる真ん中の縦の橋と左へ架けられない辺、2本架かった下の橋を覆いから抜くこと", () => {
        tapAll(stepTaps.slice(0, 4));

        expect(screen.queryByText(/交差できません/)).not.toBeNull();
        expect(getEdgesWithCue("mark")).toEqual([edgeBetween([1, 5], [3, 5])]);
        expect(getSpotlit("edge")).toEqual(
          sorted([
            edgeBetween([1, 5], [3, 5]),
            edgeBetween([1, 3], [4, 3]),
            edgeBetween([3, 1], [3, 5]),
            edgeBetween([3, 5], [5, 5]),
          ]),
        );
      });

      test("交差の手順で、覆いから抜いた架けられない横の辺を押すと、盤面を変えずに本番と同じく阻んだ橋を点けて阻まれた音を鳴らし、印の線を濃くし直すこと", () => {
        tapAll(stepTaps.slice(0, 4));
        vi.mocked(playSound).mockClear();
        tap(edgePoints.middle);
        const blockingLines = getBoard().querySelectorAll(
          "[data-bridges-blocking] line",
        );

        expect(getIslandLabel(3, 1)).toBe("3行1列の島 数字1 橋0本");
        expect(blockingLines).toHaveLength(1);
        expect(getPlayedSoundNames()).toEqual(["blocked.flac"]);
        expect(getEdgesWithCue("recall")).toEqual([
          edgeBetween([1, 5], [3, 5]),
        ]);
        expect(
          screen.queryByText(/橋どうしは\s*交差できません/),
        ).not.toBeNull();
      });

      describe("手順を終えた場合", () => {
        beforeEach(() => {
          tapAll(stepTaps);
          vi.mocked(playSound).mockClear();
        });

        test("覆いを外し、残りを架けさせる一言を出して、すぐには印を付けないこと", () => {
          expect(hasFocusScrim()).toBe(false);
          expect(
            screen.queryByText(/あとは残りの橋を架ければ\s*完成です/),
          ).not.toBeNull();
          expect(getEdgesWithCue("mark")).toEqual([]);
        });

        test("手が止まると、橋が要ると決まる辺に印を付けること", () => {
          advanceTime(idleHintDelayMs);

          expect(getEdgesWithCue("mark")).toHaveLength(1);
        });

        test("交わる橋に阻まれた後に手が止まると、盤面は変わっていないので手がかりの印を付けること", () => {
          tap(edgePoints.middle);
          advanceTime(idleHintDelayMs);

          expect(getEdgesWithCue("mark")).toHaveLength(1);
        });

        test("交わる橋に阻まれる所を押すと、本番と同じく阻んだ橋を点けて阻まれた音を鳴らし、続くと交差の一言を出すこと", () => {
          tap(edgePoints.middle);
          const blockingLines = getBoard().querySelectorAll(
            "[data-bridges-blocking] line",
          );
          const messageBeforeSettled = screen.queryByText(/交差するので/);
          advanceTime(violationReactionDelayMs);

          expect(blockingLines).toHaveLength(1);
          expect(getPlayedSoundNames()).toEqual(["blocked.flac"]);
          expect(messageBeforeSettled).toBeNull();
          expect(screen.queryByText(/交差するので/)).not.toBeNull();
        });

        test("数字より多く架けると、本番と同じく島を多すぎにし、続くと多すぎの一言を出すこと", () => {
          tap(edgePoints.leftTop);
          advanceTime(violationReactionDelayMs);

          expect(getIslandLabel(3, 1)).toBe("3行1列の島 数字1 橋2本 多すぎ");
          expect(screen.queryByText(/多く出ています/)).not.toBeNull();
        });

        test("1と1をつないで閉じると、続くとつながらない島ができたと伝えること", () => {
          tapAll([
            edgePoints.leftTop,
            edgePoints.leftTop,
            edgePoints.leftBottom,
          ]);
          advanceTime(violationReactionDelayMs);

          expect(
            screen.queryByText(/ほかとつながらない島が\s*できています/),
          ).not.toBeNull();
        });

        describe("残りを架けて解き終えた場合", () => {
          const smallestSize = Math.min(
            ...Object.values(bridgesLevelCombinations).map(
              ({ boardSize }) => boardSize.minimum,
            ),
          );

          beforeEach(() => {
            tapAll(remainingTaps);
          });

          test("本番と同じ完成の音を鳴らし、演出を終えてからゲームのホームで開いているレベルを遊ぶ操作を出すこと", () => {
            const buttonDuringAnimation = screen.queryByRole("button", {
              name: "レベル 1を遊ぶ",
            });
            advanceTime(2000);
            fireEvent.click(
              screen.getByRole("button", { name: "レベル 1を遊ぶ" }),
            );

            expect(buttonDuringAnimation).toBeNull();
            expect(getPlayedSoundNames()).toContain("cleared-end.flac");
            expect(playStart.onStart).toHaveBeenCalledOnce();
          });

          test("どのレベルの盤面もチュートリアルより大きいので、本番はもっと大きな盤面だと伝えること", () => {
            expect(smallestSize).toBeGreaterThan(BRIDGES_TUTORIAL_BOARD.width);
            expect(
              screen.queryByText(/本番はもっと大きな盤面で\s*遊びます/),
            ).not.toBeNull();
          });

          test("もう一度を押すと、橋の無い始めの盤面から始め直すこと", () => {
            advanceTime(2000);
            fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
            pressNextThroughIntro();

            expect(getIslandLabel(1, 3)).toBe("1行3列の島 数字4 橋0本");
            expect(getEdgesWithCue("mark")).toEqual([
              edgeBetween([1, 3], [4, 3]),
            ]);
          });
        });
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<BridgesTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
    });

    test("解き終えると、プレイ中の盤面も同じルールだと伝え、プレイに戻る操作を出すこと", () => {
      tapAll([...stepTaps, ...remainingTaps]);
      advanceTime(2000);
      const detail = screen.queryByText(
        /プレイ中の盤面も\s*同じルールで解けます/,
      );
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).not.toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

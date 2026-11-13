import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import {
  _private,
  BRIDGES_TUTORIAL_BOARD,
  bridgesTutorial,
} from "@/games/bridges/tutorial/tutorial";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";
import { BOARD_MARGIN } from "@/games/bridges/ui/board/board-geometry";
import type { TutorialMessage } from "@/games/tutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { edgeBetween, islandAt, steps } = _private;
const { intro, freePlay, completion } = bridgesTutorial;

/** 1始まりの行・列で書いた島。 */
type IslandAt = readonly [row: number, column: number];

/** 手順ごとに架ける2島と、押す回数。 */
const stepTaps: readonly (readonly (readonly [
  IslandAt,
  IslandAt,
  number,
])[])[] = [
  [[[2, 5], [4, 5], 1]],
  [[[4, 3], [4, 5], 2]],
  [
    [[1, 1], [1, 3], 2],
    [[1, 1], [3, 1], 2],
  ],
  [[[3, 1], [6, 1], 1]],
  [
    [[3, 6], [6, 6], 1],
    [[6, 3], [6, 6], 1],
  ],
];

/** 手順を終えた後に残る橋。 */
const remainingTaps: readonly (readonly [IslandAt, IslandAt, number])[] = [
  [[1, 3], [1, 6], 1],
  [[1, 3], [4, 3], 2],
  [[3, 6], [6, 6], 1],
  [[4, 3], [6, 3], 2],
];

const violationReactionDelayMs = 500;
const nextStepDelayMs = 900;

/** 手を離した後に止まっていても、手がかりを勝手に出さないことを確かめる長さ。 */
const longIdleMs = 60_000;

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

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: BRIDGES_DISPLAY_NAME });
}

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function queryShownText(text: string): HTMLElement | null {
  return within(getScreen()).queryByText(text.replaceAll("\n", " "));
}

function queryMessage(message: TutorialMessage | null | undefined) {
  return queryShownText(message?.headline ?? "");
}

function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(0);
}

function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

function getBoard(): HTMLElement {
  return within(getScreen()).getByRole("group", {
    name: `${BRIDGES_DISPLAY_NAME}盤面 6行6列`,
  });
}

/** 盤面の絵を、周りの海の余白も含めて1マス 100px で置き、マス単位の点を画面の座標にする。 */
function toPointer(x: number, y: number) {
  const board = getBoard();
  const size = (BRIDGES_TUTORIAL_BOARD.width + 2 * BOARD_MARGIN) * 100;
  vi.spyOn(board, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, size, size),
  );
  return {
    board,
    point: {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: (x + BOARD_MARGIN) * 100,
      clientY: (y + BOARD_MARGIN) * 100,
    },
  };
}

/**
 * 2島の間を押して離す。押す所は、交わる線と島の陸から離れた、2島の中心の間の 3/10 の所にする。
 * 盤面の点は、左上のマスの左上の角を原点にしたマス単位。
 */
function tapBetween(
  [fromRow, fromColumn]: IslandAt,
  [toRow, toColumn]: IslandAt,
): void {
  const { board, point } = toPointer(
    fromColumn - 0.5 + (toColumn - fromColumn) * 0.3,
    fromRow - 0.5 + (toRow - fromRow) * 0.3,
  );
  fireEvent.pointerDown(board, point);
  fireEvent.pointerUp(board, point);
}

function tapAll(
  taps: readonly (readonly [IslandAt, IslandAt, number])[],
): void {
  for (const [from, to, count] of taps) {
    for (let index = 0; index < count; index += 1) {
      tapBetween(from, to);
    }
  }
}

/** 最初の `count` 個の手順を終える。手順の間は、終えた手順を残して見せる間を待ってから次へ進める。 */
function finishSteps(count: number): void {
  stepTaps.slice(0, count).forEach((taps, index) => {
    if (index > 0) {
      advanceTime(nextStepDelayMs);
    }
    tapAll(taps);
  });
  advanceTime(nextStepDelayMs);
}

function getIslandLabel(row: number, column: number): string {
  return (
    within(getBoard()).getByRole("button", {
      name: new RegExp(`^${row}行${column}列の島`),
    }).textContent ?? ""
  );
}

function getCuedEdges(cue: "mark" | "pointer" | "recall" | "acknowledgement") {
  return [...getBoard().querySelectorAll(`[data-tutorial-cue="${cue}"]`)].map(
    (element) =>
      Number(element.closest("[data-cue-edge]")?.getAttribute("data-cue-edge")),
  );
}

function getSpotlitIslands(): number[] {
  return [...getBoard().querySelectorAll("[data-spotlit-island]")]
    .map((element) => Number(element.getAttribute("data-spotlit-island")))
    .sort((left, right) => left - right);
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

describe("BridgesTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "1", onStart: vi.fn<() => void>() };
    render(
      <BridgesTutorial open={true} playStart={playStart} onClose={onClose} />,
    );
  });

  test("入口で、何をするパズルかとゴールの一言を、印の無い解き終えた盤面と一緒に見せ、覆わないこと", () => {
    const purpose = queryShownText(intro.purpose);
    const caption = queryShownText(intro.goalCaption);
    const label = getIslandLabel(1, 1);

    expect(purpose).not.toBeNull();
    expect(caption).not.toBeNull();
    expect(label).toContain("橋4本");
    expect(getCuedEdges("pointer")).toEqual([]);
    expect(getScrim()).toBeNull();
    expect(queryHintButton()).toBeNull();
  });

  describe("始めた場合", () => {
    beforeEach(() => {
      pressStart();
    });

    test("橋の無い始めの盤面で、最初の手順の一言と、押す辺を指で指す印を見せ、決め手が無いので覆わないこと", () => {
      const headline = queryMessage(steps[0]!.message);
      const pointed = getCuedEdges("pointer");

      expect(headline).not.toBeNull();
      expect(getIslandLabel(1, 1)).toContain("橋0本");
      expect(pointed).toEqual([edgeBetween([2, 5], [4, 5])]);
      expect(getScrim()).toBeNull();
      expect(queryHintButton()).toBeNull();
    });

    test("印の無い辺を押すと、盤面を変えず、印の線を濃くし直すこと", () => {
      tapBetween([1, 1], [1, 3]);

      const recalled = getCuedEdges("recall");

      expect(getIslandLabel(1, 1)).toContain("橋0本");
      expect(recalled).toEqual([edgeBetween([2, 5], [4, 5])]);
    });

    test("印の辺を押すと1本架かり、架けた辺に応えて一言を保ち、その後で数字の手順の一言と決め手に替えること", () => {
      tapBetween([2, 5], [4, 5]);

      const acknowledged = getCuedEdges("acknowledgement");
      const keptHeadline = queryMessage(steps[0]!.message);

      expect(getIslandLabel(2, 5)).toContain("橋1本");
      expect(acknowledged).toEqual([edgeBetween([2, 5], [4, 5])]);
      expect(keptHeadline).not.toBeNull();

      advanceTime(nextStepDelayMs);

      expect(queryMessage(steps[1]!.message)).not.toBeNull();
      expect(getCuedEdges("pointer")).toEqual([]);
      expect(getSpotlitIslands()).toEqual(
        [islandAt(2, 5), islandAt(4, 3), islandAt(4, 5)].sort(
          (left, right) => left - right,
        ),
      );
      expect(getScrim()).not.toBeNull();
    });

    describe("数字の手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(1);
      });

      test("手順に無い辺を押すと、盤面を変えず、今の手順で何をするかを言うこと", () => {
        tapBetween([2, 5], [4, 5]);

        const headline = queryMessage(steps[1]!.offStepMessage);

        expect(getIslandLabel(2, 5)).toContain("橋1本");
        expect(headline).not.toBeNull();
      });

      test("交差に阻まれる辺を押すと、本番と同じく盤面を変えず、まだ伝えていない交差を違反と言わずに、今の手順で何をするかを言うこと", () => {
        const { board, point } = toPointer(3.5, 2.5);
        fireEvent.pointerDown(board, point);
        fireEvent.pointerUp(board, point);

        const headline = queryMessage(steps[1]!.offStepMessage);

        expect(headline).not.toBeNull();
        expect(queryShownText("ここに架けるとほかの橋と交差します")).toBeNull();
      });

      test("左の6への辺を1回押した途中で手順に無い辺を押しても、盤面と食い違わない、今の手順で何をするかの一言を返すこと", () => {
        tapBetween([4, 3], [4, 5]);
        tapBetween([1, 1], [1, 3]);

        const headline = queryMessage(steps[1]!.offStepMessage);

        expect(headline).not.toBeNull();
        expect(getIslandLabel(4, 5)).toContain("橋2本");
      });

      test("左の6への辺を1回押すと、もう一度押すよう途中の一言に替え、2回目で次の手順へ進むこと", () => {
        tapBetween([4, 3], [4, 5]);

        expect(queryMessage(steps[1]!.midwayMessage)).not.toBeNull();

        tapBetween([4, 3], [4, 5]);
        advanceTime(nextStepDelayMs);

        expect(getIslandLabel(4, 5)).toContain("橋3本");
        expect(queryMessage(steps[2]!.message)).not.toBeNull();
      });
    });

    describe("数字の手順で2本目を架けた直後の場合", () => {
      beforeEach(() => {
        finishSteps(1);
        tapBetween([4, 3], [4, 5]);
        tapBetween([4, 3], [4, 5]);
      });

      test("もう一度押しても、架け終えた手順の一言を保ち、その後で次の手順のルールの一言に替えること", () => {
        tapBetween([4, 3], [4, 5]);

        const keptHeadline = queryMessage(steps[1]!.message);

        expect(keptHeadline).not.toBeNull();
        expect(queryMessage(steps[1]!.midwayMessage)).toBeNull();

        advanceTime(nextStepDelayMs);

        expect(queryMessage(steps[2]!.message)).not.toBeNull();
      });
    });

    describe("読みの手順で交差に阻まれた場合", () => {
      beforeEach(() => {
        finishSteps(4);
        const { board, point } = toPointer(3.5, 2.5);
        fireEvent.pointerDown(board, point);
        fireEvent.pointerUp(board, point);
      });

      test("交差の一言に、今の手順で何をするかを添えること", () => {
        const detail = queryShownText(steps[4]!.blockedDetail ?? "");

        expect(
          queryShownText("ここに架けるとほかの橋と交差します"),
        ).not.toBeNull();
        expect(detail).not.toBeNull();
      });

      test("続けて手順に無い辺を押すと、交差の一言から、今の手順で何をするかの一言に替えること", () => {
        tapBetween([1, 3], [1, 6]);

        const headline = queryMessage(steps[4]!.offStepMessage);

        expect(headline).not.toBeNull();
        expect(queryShownText("ここに架けるとほかの橋と交差します")).toBeNull();
      });
    });

    describe("交差の手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(3);
      });

      test("右へ架けようとすると、本番と同じく盤面を変えずに、交差の一言と今の手順で何をするかを言うこと", () => {
        const { board, point } = toPointer(3.5, 2.5);
        fireEvent.pointerDown(board, point);
        fireEvent.pointerUp(board, point);

        const headline = queryShownText("ここに架けるとほかの橋と交差します");
        const detail = queryShownText(steps[3]!.blockedDetail ?? "");

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(getIslandLabel(3, 6)).toContain("橋0本");
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(stepTaps.length);
      });

      test("残りを架けることを伝え、印も覆いも出さずに、ヒントを出しておくこと", () => {
        advanceTime(longIdleMs);

        const headline = queryMessage(freePlay);

        expect(headline).not.toBeNull();
        expect(getCuedEdges("pointer")).toEqual([]);
        expect(getScrim()).toBeNull();
        expect(queryHintButton()).not.toBeNull();
      });

      test("ヒントを押すと、架ける辺に指の無い印を付け、決め手を覆いから抜いて、手がかりの一言に替え、次の手で消すこと", () => {
        fireEvent.click(queryHintButton()!);

        const marked = getCuedEdges("mark");

        expect(marked).toHaveLength(1);
        expect(getCuedEdges("pointer")).toEqual([]);
        expect(getScrim()).not.toBeNull();
        expect(queryMessage(freePlay)).toBeNull();
        expect(queryHintButton()).toBeNull();

        tapBetween([1, 3], [1, 6]);

        expect(getCuedEdges("mark")).toEqual([]);
        expect(queryMessage(freePlay)).not.toBeNull();
      });

      test("数字より多い島を作って違反が続くと、多い島と直し方を言い、直す辺に印を付けること", () => {
        tapBetween([1, 3], [1, 6]);
        tapBetween([1, 3], [1, 6]);
        advanceTime(violationReactionDelayMs);

        const headline = queryShownText(
          "1の島から橋が\n数字より多く出ています",
        );
        const detail = queryShownText("あと2回タップで1本に戻ります");

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(getCuedEdges("mark")).toEqual([edgeBetween([1, 3], [1, 6])]);
        expect(queryHintButton()).toBeNull();
      });

      describe("解き終えた場合", () => {
        beforeEach(() => {
          tapAll(remainingTaps);
          advanceTime(5000);
        });

        test("完成を伝え、覚えたルールを並べ、レベルを遊ぶ操作で本番を始めること", () => {
          const headline = queryMessage(completion.home);
          const recap = within(
            within(getScreen()).getByRole("list", { name: "覚えたルール" }),
          )
            .getAllByRole("listitem")
            .map((item) => item.textContent);

          expect(headline).not.toBeNull();
          expect(recap).toEqual([
            ...bridgesTutorial.rules.map(({ label }) => label),
            "全部の島を1つにつなぐと完成です",
          ]);

          fireEvent.click(
            within(getScreen()).getByRole("button", { name: "レベル 1を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        test("もう一度を押すと、入口を通さずに、橋の無い盤面で最初の手順から始めること", () => {
          fireEvent.click(
            within(getScreen()).getByRole("button", { name: "もう一度" }),
          );

          expect(queryMessage(steps[0]!.message)).not.toBeNull();
          expect(getIslandLabel(1, 1)).toContain("橋0本");
          expect(
            within(getScreen()).queryByRole("button", { name: "はじめる" }),
          ).toBeNull();
        });
      });
    });
  });
});

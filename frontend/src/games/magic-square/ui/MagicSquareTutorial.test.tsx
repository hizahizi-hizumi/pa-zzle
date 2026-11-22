import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { TUTORIAL_CUE_HAND_ATTRIBUTE } from "@/components/TutorialCue";
import { TUTORIAL_SPOTLIGHT_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import { magicSquareTutorial } from "@/games/magic-square/tutorial/tutorial";
import { MagicSquareTutorial } from "@/games/magic-square/ui/MagicSquareTutorial";
import type { TutorialMessage } from "@/games/tutorial";

const { intro, steps, freePlay, completion, rules } = magicSquareTutorial;

/** 決め手の列を見せてから次の手順へ替えるまでの間より長い時間。 */
const holdEnoughMs = 1_000;

/** 始めの盤面へ替える場面を終えるのに足りる時間。覆いが毎フレーム盤面を追うので、偽のタイマーで進める長さを抑える。 */
const sceneEnoughMs = 2_000;

type Entry = readonly [row: number, column: number, value: number];

const guidedEntries: readonly Entry[] = [
  [1, 1, 14],
  [1, 4, 11],
  [3, 1, 8],
  [2, 2, 2],
  [2, 3, 7],
];
const freeEntries: readonly Entry[] = [
  [3, 4, 1],
  [4, 2, 15],
  [4, 3, 10],
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: MAGIC_SQUARE_DISPLAY_NAME });
}

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function queryShownText(text: string): HTMLElement | null {
  return within(getScreen()).queryByText(text.replaceAll("\n", " "));
}

function queryMessage(
  message: TutorialMessage | undefined,
): HTMLElement | null {
  return queryShownText(message?.headline ?? "");
}

/** マスの読み上げ名は「<行>行<列>列 <数か空き>」なので、名前の頭で引く。 */
function getCell(row: number, column: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `button[aria-label^="${row}行${column}列 "]`,
  );
  if (!cell) {
    throw new Error(`cell ${row}:${column} not found`);
  }
  return cell;
}

function getValueButton(value: number): HTMLElement {
  return within(screen.getByRole("group", { name: "数の欄" })).getByText(
    String(value),
  );
}

function hasMark(element: HTMLElement): boolean {
  return element.querySelector('[data-tutorial-cue="mark"]') !== null;
}

function hasPointer(element: HTMLElement): boolean {
  return element.querySelector(`[${TUTORIAL_CUE_HAND_ATTRIBUTE}]`) !== null;
}

/** 盤面の中で覆いから抜いている所の数。 */
function countSpotlights(): number {
  return screen
    .getByRole("group", { name: `${MAGIC_SQUARE_DISPLAY_NAME}の盤面` })
    .querySelectorAll(`[${TUTORIAL_SPOTLIGHT_ATTRIBUTE}]`).length;
}

function enter([row, column, value]: Entry): void {
  fireEvent.click(getCell(row, column));
  fireEvent.click(getValueButton(value));
}

/** 手順を順に終える。決め手の列を見せる間を待ってから次へ進む。 */
function finishSteps(count: number): void {
  for (const entry of guidedEntries.slice(0, count)) {
    enter(entry);
    advanceTime(holdEnoughMs);
  }
}

describe("MagicSquareTutorial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<MagicSquareTutorial open onClose={vi.fn()} />);
  });

  describe("入口を見せる場合", () => {
    test("名前と何をするパズルか、ゴールの一言を見せ、はじめるを待つこと", () => {
      const shown = {
        purpose: queryShownText(intro.purpose) !== null,
        goalCaption: queryShownText(intro.goalCaption) !== null,
        start:
          within(getScreen()).queryByRole("button", { name: "はじめる" }) !==
          null,
      };

      expect(shown).toEqual({ purpose: true, goalCaption: true, start: true });
    });
  });

  describe("手を引く場合", () => {
    beforeEach(() => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
      advanceTime(sceneEnoughMs);
    });

    test("操作を教える手順では、印のマスに指を添え、盤面を覆わないこと", () => {
      const cell = getCell(1, 1);

      expect({
        message: queryMessage(steps[0]?.message) !== null,
        mark: hasMark(cell),
        pointer: hasPointer(cell),
        spotlights: countSpotlights(),
      }).toEqual({ message: true, mark: true, pointer: true, spotlights: 0 });
    });

    test("印の無いマスを押しても選ばず、一言を替えないこと", () => {
      fireEvent.click(getCell(1, 4));

      expect({
        pressed: getCell(1, 4).getAttribute("aria-pressed"),
        message: queryMessage(steps[0]?.message) !== null,
      }).toEqual({ pressed: "false", message: true });
    });

    test("印のマスを選ぶと、押す数に指を添えること", () => {
      fireEvent.click(getCell(1, 1));

      expect(hasPointer(getValueButton(14))).toBe(true);
    });

    test("印の数を入れると、横の列を覆いから抜き、次のマスに指の無い印を付けること", () => {
      enter([1, 1, 14]);

      expect({
        message: queryMessage(steps[1]?.message) !== null,
        mark: hasMark(getCell(1, 4)),
        pointer: hasPointer(getCell(1, 4)),
        spotlights: countSpotlights(),
      }).toEqual({ message: true, mark: true, pointer: false, spotlights: 6 });
    });

    describe("横の列の手順で違う数を入れた場合", () => {
      beforeEach(() => {
        finishSteps(1);
        enter([1, 4, 15]);
      });

      test("その列の違反を言い、入れ直し方を添えること", () => {
        const message = queryShownText("この横の列は合計が34になっていません");

        expect({
          message: message !== null,
          detail: queryShownText("別の数を押すと入れ直せます") !== null,
        }).toEqual({ message: true, detail: true });
      });

      test("まだ伝えていない縦の列の違反は出さないこと", () => {
        const column = screen.getByText(/^4列目の合計 37/);

        expect(column.textContent).toBe("4列目の合計 37");
      });

      test("答えの数に入れ直すと、横の列を見せる間を置いてから縦の列の手順へ進むこと", () => {
        fireEvent.click(getValueButton(11));
        const held = queryMessage(steps[1]?.message) !== null;
        advanceTime(holdEnoughMs);

        expect({
          held,
          next: queryMessage(steps[2]?.message) !== null,
        }).toEqual({ held: true, next: true });
      });
    });

    describe("探す手順の場合", () => {
      beforeEach(() => {
        finishSteps(4);
      });

      test("印を付けず、盤面を覆わずに、空いたマスが1つの列を探させること", () => {
        const marks = document.querySelectorAll('[data-tutorial-cue="mark"]');

        expect({
          message: queryMessage(steps[4]?.message) !== null,
          marks: marks.length,
          spotlights: countSpotlights(),
        }).toEqual({ message: true, marks: 0, spotlights: 0 });
      });

      test("空いたマスが2つ以上の列だけを通るマスを選ぶと、そのことを言い、数を押しても入れないこと", () => {
        fireEvent.click(getCell(4, 3));
        fireEvent.click(getValueButton(10));

        expect({
          message:
            queryShownText(
              "このマスを通る横の列と縦の列は\n空いたマスが2つ以上あります",
            ) !== null,
          cell: getCell(4, 3).getAttribute("aria-label"),
        }).toEqual({ message: true, cell: "4行3列 空き" });
      });

      test("空いたマスが1つの列のマスを選ぶと、その列を覆いから抜いて、その列の一言を見せること", () => {
        fireEvent.click(getCell(4, 2));

        expect({
          message: queryShownText("縦の4つの数も足すと34になります") !== null,
          spotlights: countSpotlights(),
        }).toEqual({ message: true, spotlights: 6 });
      });
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        finishSteps(guidedEntries.length);
      });

      test("残りを埋める一言とヒントを見せ、印を付けないこと", () => {
        const marks = document.querySelectorAll('[data-tutorial-cue="mark"]');

        expect({
          message: queryMessage(freePlay) !== null,
          hint:
            within(getScreen()).queryByRole("button", { name: "ヒント" }) !==
            null,
          marks: marks.length,
        }).toEqual({ message: true, hint: true, marks: 0 });
      });

      test("ヒントを押すと、空いたマスが1つの列を覆いから抜き、そのマスに印を付けること", () => {
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "ヒント" }),
        );

        expect({
          message: queryShownText("横の4つの数を足すと34になります") !== null,
          mark: hasMark(getCell(3, 4)),
          spotlights: countSpotlights(),
        }).toEqual({ message: true, mark: true, spotlights: 6 });
      });

      test("残りを埋めると、完成を伝えて覚えたルールを並べること", () => {
        for (const entry of freeEntries) {
          enter(entry);
        }
        advanceTime(sceneEnoughMs);

        expect({
          completion: queryMessage(completion.play) !== null,
          rules: rules.map(({ label }) => queryShownText(label) !== null),
        }).toEqual({ completion: true, rules: [true, true, true] });
      });
    });
  });
});

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
import {
  MAGIC_SQUARE_TUTORIAL_RECAP,
  magicSquareTutorial,
} from "@/games/magic-square/tutorial/tutorial";
import { MagicSquareTutorial } from "@/games/magic-square/ui/MagicSquareTutorial";
import type { TutorialMessage } from "@/games/tutorial";

const { intro, steps, freePlay, completion } = magicSquareTutorial;

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
  return within(
    screen.getByRole("group", { name: "盤面の下に並んだ数" }),
  ).getByText(String(value));
}

function hasMark(element: HTMLElement): boolean {
  return element.querySelector('[data-tutorial-cue="mark"]') !== null;
}

function hasPointer(element: HTMLElement): boolean {
  return element.querySelector(`[${TUTORIAL_CUE_HAND_ATTRIBUTE}]`) !== null;
}

function hasRecall(element: HTMLElement): boolean {
  return element.querySelector('[data-tutorial-cue="recall"]') !== null;
}

function hasAcknowledgement(element: HTMLElement): boolean {
  return (
    element.querySelector('[data-tutorial-cue="acknowledgement"]') !== null
  );
}

function getHintButton(): HTMLElement {
  return within(getScreen()).getByRole("button", { name: "ヒント" });
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

    test("印の付いたマスを選ぶと、押す数に指を添えること", () => {
      fireEvent.click(getCell(1, 1));

      expect(hasPointer(getValueButton(14))).toBe(true);
    });

    test.each([
      ["ほかのマスを押す", () => fireEvent.click(getCell(2, 2))],
      ["印の無い数を押す", () => fireEvent.click(getValueButton(1))],
    ])(
      "印の付いたマスを選んでから%sと、選んだマスの見え方を変えずに、押す数の指を出し直すこと",
      (_, pressElsewhere) => {
        fireEvent.click(getCell(1, 1));
        pressElsewhere();

        expect({
          selected: getCell(1, 1).getAttribute("aria-pressed"),
          cellMark: hasMark(getCell(1, 1)),
          valuePointer: hasPointer(getValueButton(14)),
          valueRecall: hasRecall(getValueButton(14)),
        }).toEqual({
          selected: "true",
          cellMark: false,
          valuePointer: true,
          valueRecall: true,
        });
      },
    );

    test("印の数を置くと、置いたマスに合図を返し、横の列を覆いから抜いて、次のマスに指の無い印を付けること", () => {
      enter([1, 1, 14]);

      expect({
        acknowledgement: hasAcknowledgement(getCell(1, 1)),
        message: queryMessage(steps[1]?.message) !== null,
        mark: hasMark(getCell(1, 4)),
        pointer: hasPointer(getCell(1, 4)),
        spotlights: countSpotlights(),
      }).toEqual({
        acknowledgement: true,
        message: true,
        mark: true,
        pointer: false,
        spotlights: 6,
      });
    });

    test("横の列の手順で印の付いたマスを選んでからほかのマスを押すと、印を出し直すこと", () => {
      finishSteps(1);
      fireEvent.click(getCell(1, 4));
      const markedWhileSelected = hasMark(getCell(1, 4));
      fireEvent.click(getCell(2, 2));

      expect({
        markedWhileSelected,
        mark: hasMark(getCell(1, 4)),
        recall: hasRecall(getCell(1, 4)),
      }).toEqual({ markedWhileSelected: false, mark: true, recall: true });
    });

    describe("横の列の手順で違う数を置いた場合", () => {
      beforeEach(() => {
        finishSteps(1);
        enter([1, 4, 15]);
      });

      test("その列の違反を言い、置き換え方を添えること", () => {
        const message = queryShownText(
          "選んだマスの横の列は\n合計が34になっていません",
        );

        expect({
          message: message !== null,
          detail: queryShownText("別の数を押すと置き換えられます") !== null,
        }).toEqual({ message: true, detail: true });
      });

      test("まだ伝えていない縦の列の違反は出さないこと", () => {
        const column = screen.getByText(/^4列目の合計 37/);

        expect(column.textContent).toBe("4列目の合計 37");
      });

      test("答えの数に置き換えると、横の列を見せる間を置いてから縦の列の手順へ進むこと", () => {
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

      test("空いたマスが2つ以上の列だけを通るマスを選ぶと、そのことを言うこと", () => {
        fireEvent.click(getCell(4, 3));

        expect(
          queryShownText(
            "選んだマスの横と縦の列には\n空いたマスが2つ以上あります",
          ),
        ).not.toBeNull();
      });

      test("空いたマスが2つ以上の列だけを通るマスに数を押すと、置かずに、まだ決まらないことを言うこと", () => {
        fireEvent.click(getCell(4, 3));
        fireEvent.click(getValueButton(10));

        expect({
          message:
            queryShownText("選んだマスに入る数はまだ決まりません") !== null,
          cell: getCell(4, 3).getAttribute("aria-label"),
        }).toEqual({ message: true, cell: "4行3列 空き" });
      });

      test("最初から置いてある数のマスを押すと、選んでそのことを言うこと", () => {
        fireEvent.click(getCell(1, 2));

        expect({
          selected: getCell(1, 2).getAttribute("aria-pressed"),
          message:
            queryShownText("選んだマスには最初から数が置いてあります") !== null,
        }).toEqual({ selected: "true", message: true });
      });

      test("空いたマスが1つだけ残った列のマスを選ぶと、その列を覆いから抜いて、その列の一言を見せること", () => {
        fireEvent.click(getCell(4, 2));

        expect({
          message:
            queryShownText("縦の列の4つの数を足すと34になります") !== null,
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

      test("ヒントを押すと、空いたマスが1つだけ残った列を覆いから抜き、そのマスに印を付けること", () => {
        fireEvent.click(getHintButton());

        expect({
          message:
            queryShownText("横の列の4つの数を足すと34になります") !== null,
          mark: hasMark(getCell(3, 4)),
          spotlights: countSpotlights(),
        }).toEqual({ message: true, mark: true, spotlights: 6 });
      });

      test("ヒントで示したマスを選んでも手がかりを残し、数を置くと消すこと", () => {
        fireEvent.click(getHintButton());
        fireEvent.click(getCell(3, 4));
        const kept = {
          message:
            queryShownText("横の列の4つの数を足すと34になります") !== null,
          spotlights: countSpotlights(),
        };
        fireEvent.click(getValueButton(1));

        expect({
          kept,
          message:
            queryShownText("横の列の4つの数を足すと34になります") !== null,
          spotlights: countSpotlights(),
        }).toEqual({
          kept: { message: true, spotlights: 6 },
          message: false,
          spotlights: 0,
        });
      });

      test("同じ違反になった横の列と縦の列を、どちらも言うこと", () => {
        enter([3, 4, 10]);

        expect(
          queryShownText("選んだマスの横と縦の列は\n合計が34になっていません"),
        ).not.toBeNull();
      });

      test("違反を残したまま別のマスを選ぶと、印の付いたマスから違反の列を言うこと", () => {
        enter([3, 4, 10]);
        fireEvent.click(getCell(4, 3));

        expect({
          message:
            queryShownText(
              "印の付いたマスの横と縦の列は\n合計が34になっていません",
            ) !== null,
          mark: hasMark(getCell(3, 4)),
        }).toEqual({ message: true, mark: true });
      });

      describe("違反にならない違う数を置いてヒントを押した場合", () => {
        beforeEach(() => {
          // 2行3列の数を外して3列目の空いたマスを2つにし、4行3列に違う数の1を置く。
          enter([2, 3, 7]);
          enter([4, 3, 1]);
          fireEvent.click(getHintButton());
        });

        test("そのマスを選んだままなら、印を付けずに、選んだマスの数が違うと言うこと", () => {
          expect({
            message: queryShownText("選んだマスの数が違います") !== null,
            mark: hasMark(getCell(4, 3)),
          }).toEqual({ message: true, mark: false });
        });

        test("ほかのマスを選ぶと、印を付けて、印の付いたマスの数が違うと言うこと", () => {
          fireEvent.click(getCell(3, 4));

          expect({
            message: queryShownText("印の付いたマスの数が違います") !== null,
            mark: hasMark(getCell(4, 3)),
          }).toEqual({ message: true, mark: true });
        });
      });

      describe("本番でも受け付けない押し方の場合", () => {
        let animate: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          animate = vi.fn();
          Object.defineProperty(Element.prototype, "animate", {
            configurable: true,
            value: animate,
          });
        });

        afterEach(() => {
          Reflect.deleteProperty(Element.prototype, "animate");
        });

        test("マスを選ばずに数を押すと、本番と同じく押した数の札を揺らすこと", () => {
          fireEvent.click(getValueButton(1));
          const shaken = animate.mock.contexts[0] as Element | undefined;

          expect({
            calls: animate.mock.calls.length,
            shaken: shaken === getValueButton(1),
          }).toEqual({ calls: 1, shaken: true });
        });

        test("最初から置いてある数のマスに数を押すと、本番と同じくそのマスを揺らすこと", () => {
          fireEvent.click(getCell(1, 2));
          fireEvent.click(getValueButton(1));
          const shaken = animate.mock.contexts[0] as Element | undefined;

          expect({
            calls: animate.mock.calls.length,
            shaken: shaken === getCell(1, 2),
          }).toEqual({ calls: 1, shaken: true });
        });
      });

      test("残りを埋めると、完成を伝えて覚えたルールを並べること", () => {
        for (const entry of freeEntries) {
          enter(entry);
        }
        advanceTime(sceneEnoughMs);

        expect({
          completion: queryMessage(completion.play) !== null,
          recap: MAGIC_SQUARE_TUTORIAL_RECAP.map(
            (label) => queryShownText(label) !== null,
          ),
        }).toEqual({
          completion: true,
          recap: MAGIC_SQUARE_TUTORIAL_RECAP.map(() => true),
        });
      });
    });
  });
});

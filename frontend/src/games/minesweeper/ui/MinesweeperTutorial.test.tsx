import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  MINESWEEPER_TUTORIAL_RECAP,
  minesweeperTutorial,
  minesweeperTutorialModeSwitchDetails,
} from "@/games/minesweeper/tutorial/tutorial";
import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";
import type { TutorialMessage } from "@/games/tutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

type CellPosition = readonly [row: number, column: number];

const { intro, steps, freePlay, completion } = minesweeperTutorial;

const stepOperations: readonly {
  operation: "reveal" | "flag";
  cells: readonly CellPosition[];
}[] = [
  { operation: "reveal", cells: [[3, 5]] },
  {
    operation: "flag",
    cells: [
      [2, 5],
      [4, 5],
    ],
  },
  {
    operation: "reveal",
    cells: [
      [5, 3],
      [5, 4],
      [5, 5],
    ],
  },
];

const remainingCells: readonly CellPosition[] = [
  [1, 5],
  [5, 1],
];

const longIdleMs = 60_000;

const clearEnoughMs = 3000;

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

async function advanceTimeInSlices(ms: number): Promise<void> {
  const sliceMs = 50;
  for (let elapsed = 0; elapsed < ms; elapsed += sliceMs) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(sliceMs);
    });
  }
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: MINESWEEPER_DISPLAY_NAME });
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

function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(0);
}

function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

function getBoard(): HTMLElement {
  return within(getScreen()).getByRole("group", {
    name: "マインスイーパー盤面",
  });
}

function getCellNumber([row, column]: CellPosition): number {
  return (row - 1) * 5 + column;
}

function getCell(position: CellPosition): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^マス ${getCellNumber(position)} `),
  });
}

function getCellLabel(position: CellPosition): string | null {
  return getCell(position).getAttribute("aria-label");
}

function getModeToggle(): HTMLElement {
  return within(getScreen()).getByRole("button", { name: "旗モード" });
}

function setMode(mode: "reveal" | "flag"): void {
  const flagMode = getModeToggle().getAttribute("aria-pressed") === "true";
  if (flagMode !== (mode === "flag")) {
    fireEvent.click(getModeToggle());
  }
}

function operate(
  operation: "reveal" | "flag",
  cells: readonly CellPosition[],
): void {
  setMode(operation);
  for (const position of cells) {
    fireEvent.click(getCell(position));
  }
}

function finishSteps(count: number): void {
  for (const { operation, cells } of stepOperations.slice(0, count)) {
    operate(operation, cells);
  }
}

function solveAll(): void {
  finishSteps(stepOperations.length);
  operate("reveal", remainingCells);
}

function getCellNumbers(selector: string): number[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector(selector))
    .map((cell) => Number(cell.getAttribute("aria-label")?.split(" ")[1]));
}

function getMarkedCellNumbers(): number[] {
  return getCellNumbers('[data-cell-cue="hint"]');
}

function getPointedCellNumbers(): number[] {
  return getCellNumbers('[data-tutorial-cue="pointer"]');
}

function getRecalledCellNumbers(): number[] {
  return getCellNumbers('[data-tutorial-cue="recall"]');
}

function getFittedCellNumbers(): number[] {
  return getCellNumbers('[data-cell-cue="fitted"]');
}

function getSpotlitCellNumbers(): number[] {
  return getCellNumbers("[data-tutorial-spotlight]");
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

function hasToggleCue(): boolean {
  return getScreen().querySelector('[data-toggle-cue="hint"]') !== null;
}

function isTogglePointed(): boolean {
  return (
    getScreen().querySelector(
      '[data-toggle-cue="hint"] [data-tutorial-cue="pointer"]',
    ) !== null
  );
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

describe("MinesweeperTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "1", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <MinesweeperTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("入口で、何をするパズルかとゴールの一言を、地雷を明かした解き終えた盤面と一緒に見せ、印も覆いも出さないこと", () => {
      const purpose = queryShownText(intro.purpose);
      const caption = queryShownText(intro.goalCaption);
      const mineLabel = getCellLabel([1, 1]);

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(mineLabel).toBe("マス 1 地雷");
      expect(getMarkedCellNumbers()).toEqual([]);
      expect(getScrim()).toBeNull();
      expect(hasToggleCue()).toBe(false);
      expect(getProgressValue()).toBe("0");
    });

    describe("はじめるを押した場合", () => {
      beforeEach(() => {
        pressStart();
      });

      test("始めの盤面に替え、開く操作の一言と、指で指す印のマスを見せ、決め手が無いので覆わないこと", () => {
        const headline = queryMessage(steps[0]?.message);
        const label = getCellLabel([3, 5]);

        expect(headline).not.toBeNull();
        expect(label).toBe("マス 15 未開示");
        expect(getMarkedCellNumbers()).toEqual([15]);
        expect(getPointedCellNumbers()).toEqual([15]);
        expect(getScrim()).toBeNull();
        expect(hasToggleCue()).toBe(false);
      });

      test("手を引いている間は、ヒントを出さないこと", () => {
        const hintButton = queryHintButton();

        expect(hintButton).toBeNull();
      });

      test("印の無いマスを押すと、盤面を変えず、印のマスの線を濃くし直すこと", () => {
        fireEvent.click(getCell([5, 5]));

        const label = getCellLabel([5, 5]);

        expect(label).toBe("マス 25 未開示");
        expect(getRecalledCellNumbers()).toEqual([15]);
      });

      describe("印のマスを開いた場合", () => {
        beforeEach(() => {
          finishSteps(1);
        });

        test("開いた2とその周りの閉じたマスだけを覆いから抜いて数字のルールを示し、押す所と操作は印を付けずに選ばせること", () => {
          const headline = queryMessage(steps[1]?.message);
          const detail = queryShownText(steps[1]?.message.detail ?? "");

          expect(headline).not.toBeNull();
          expect(detail).not.toBeNull();
          expect(getCellLabel([3, 5])).toBe("マス 15 開示済み 2");
          expect(getMarkedCellNumbers()).toEqual([]);
          expect(hasToggleCue()).toBe(false);
          expect(getScrim()).not.toBeNull();
          expect(getSpotlitCellNumbers()).toEqual([10, 15, 20]);
        });

        test("周りの外のマスを押すと、盤面を変えず、旗を置くマスに印を付けて、切り替えを指で指すこと", () => {
          fireEvent.click(getCell([5, 1]));

          const label = getCellLabel([5, 1]);
          const detail = queryShownText(
            minesweeperTutorialModeSwitchDetails.flag,
          );

          expect(label).toBe("マス 21 未開示");
          expect(detail).not.toBeNull();
          expect(getMarkedCellNumbers()).toEqual([10, 20]);
          expect(getPointedCellNumbers()).toEqual([]);
          expect(isTogglePointed()).toBe(true);
        });

        test("考えずに周りの閉じたマスを開くと、本番と同じく地雷を踏み、ミスになることと旗に切り替えることを言い、残りの地雷に印を付けること", () => {
          fireEvent.click(getCell([2, 5]));

          const label = getCellLabel([2, 5]);
          const headline = queryShownText(
            "地雷を踏みました\n本番ではミスになります",
          );
          const detail = queryShownText(
            minesweeperTutorialModeSwitchDetails.flag,
          );

          expect(label).toBe("マス 10 踏んだ地雷");
          expect(headline).not.toBeNull();
          expect(detail).not.toBeNull();
          expect(getMarkedCellNumbers()).toEqual([20]);
          expect(isTogglePointed()).toBe(true);
        });

        test("地雷を踏んだ後に、もう1つの地雷も開こうとすると、踏ませずに印の線を濃くし直すこと", () => {
          fireEvent.click(getCell([2, 5]));
          fireEvent.click(getCell([4, 5]));

          const label = getCellLabel([4, 5]);

          expect(label).toBe("マス 20 未開示");
          expect(getRecalledCellNumbers()).toEqual([20]);
        });

        test("旗に切り替えて地雷を踏んだ後は、残りの地雷を指で指すこと", () => {
          fireEvent.click(getCell([2, 5]));
          setMode("flag");

          const pointed = getPointedCellNumbers();

          expect(pointed).toEqual([20]);
          expect(hasToggleCue()).toBe(false);
        });

        test("印のマスに旗を置くと、本番と同じ旗を置く音を鳴らし、そのマスに応えること", () => {
          vi.mocked(playSound).mockClear();
          operate("flag", [[2, 5]]);

          const played = getPlayedSoundNames();

          expect(played).toEqual(["flag-placed.flac"]);
          expect(getFittedCellNumbers()).toEqual([10]);
        });

        describe("2つの印に旗を置いた場合", () => {
          beforeEach(() => {
            finishSteps(2);
          });

          test("地雷がそろった1とその周りの閉じたマスだけを覆いから抜いて示し、開くマスと操作は印を付けずに選ばせること", () => {
            const headline = queryMessage(steps[2]?.message);
            const detail = queryShownText(steps[2]?.message.detail ?? "");

            expect(headline).not.toBeNull();
            expect(detail).not.toBeNull();
            expect(getMarkedCellNumbers()).toEqual([]);
            expect(hasToggleCue()).toBe(false);
            expect(getSpotlitCellNumbers()).toEqual([19, 20, 23, 24, 25]);
          });

          test("旗のまま開くマスを押しても旗を置かず、開くマスに印を付けて、切り替えを戻させること", () => {
            fireEvent.click(getCell([5, 3]));

            const label = getCellLabel([5, 3]);
            const detail = queryShownText(
              minesweeperTutorialModeSwitchDetails.reveal,
            );

            expect(label).toBe("マス 23 未開示");
            expect(detail).not.toBeNull();
            expect(getMarkedCellNumbers()).toEqual([23, 24, 25]);
            expect(isTogglePointed()).toBe(true);
          });
        });
      });

      describe("手を離した後", () => {
        beforeEach(() => {
          finishSteps(stepOperations.length);
        });

        test("残りを開く一言にし、印も覆いも出さず、ヒントを出しておくこと", () => {
          const headline = queryMessage(freePlay);

          expect(headline).not.toBeNull();
          expect(getMarkedCellNumbers()).toEqual([]);
          expect(getScrim()).toBeNull();
          expect(hasToggleCue()).toBe(false);
          expect(queryHintButton()).not.toBeNull();
        });

        test("長く手が止まっても、手がかりを出さないこと", () => {
          advanceTime(longIdleMs);

          const marked = getMarkedCellNumbers();

          expect(marked).toEqual([]);
          expect(getScrim()).toBeNull();
        });

        test("ヒントを押すと、地雷と決まるマスに印を付けて切り替えを指で指し、決めた数字と一緒に覆いから抜き、その読みを言ってヒントを下げること", () => {
          fireEvent.click(queryHintButton() ?? getScreen());

          const headline = queryShownText(
            "この1の周りの閉じたマスは\n全部地雷です",
          );

          expect(headline).not.toBeNull();
          expect(getMarkedCellNumbers()).toEqual([1]);
          expect(isTogglePointed()).toBe(true);
          expect(getSpotlitCellNumbers()).toHaveLength(2);
          expect(getSpotlitCellNumbers()).toContain(1);
          expect(queryHintButton()).toBeNull();
        });

        test("ヒントで示した後に次の手を入れると、印と覆いを消して、またヒントを出すこと", () => {
          fireEvent.click(queryHintButton() ?? getScreen());
          operate("flag", [[1, 1]]);

          const marked = getMarkedCellNumbers();

          expect(marked).toEqual([]);
          expect(getScrim()).toBeNull();
          expect(queryHintButton()).not.toBeNull();
        });

        test("地雷を踏むと、盤面に残してミスになることを言い、ヒントは出したままにすること", () => {
          operate("reveal", [[1, 1]]);

          const label = getCellLabel([1, 1]);
          const headline = queryShownText(
            "地雷を踏みました\n本番ではミスになります",
          );

          expect(label).toBe("マス 1 踏んだ地雷");
          expect(headline).not.toBeNull();
          expect(queryHintButton()).not.toBeNull();
        });
      });

      describe("解き終えた場合", () => {
        beforeEach(async () => {
          solveAll();
          await advanceTimeInSlices(clearEnoughMs);
        });

        test("完成を伝え、覚えたルールを並べ、進み具合を満たすこと", () => {
          const headline = queryMessage(completion.home);
          const detail = queryShownText(completion.home.detail ?? "");
          const recap = within(
            within(getScreen()).getByRole("list", { name: "覚えたルール" }),
          )
            .getAllByRole("listitem")
            .map((item) => item.textContent);

          expect(headline).not.toBeNull();
          expect(detail).not.toBeNull();
          expect(recap).toEqual([...MINESWEEPER_TUTORIAL_RECAP]);
          expect(getProgressValue()).toBe("100");
        });

        test("本番と同じ完成の音を1回鳴らすこと", () => {
          const cleared = getPlayedSoundNames().filter(
            (name) => name === "cleared.flac",
          );

          expect(cleared).toHaveLength(1);
        });

        test("ゲームのホームで開いているレベルを遊ぶ操作で、本番を始めること", () => {
          fireEvent.click(
            within(getScreen()).getByRole("button", { name: "レベル 1を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        test("もう一度を押すと、入口を通さずに、始めの盤面と開く切り替えで最初の手順から始めること", () => {
          fireEvent.click(
            within(getScreen()).getByRole("button", { name: "もう一度" }),
          );

          const headline = queryMessage(steps[0]?.message);

          expect(headline).not.toBeNull();
          expect(getCellLabel([3, 5])).toBe("マス 15 未開示");
          expect(getModeToggle().getAttribute("aria-pressed")).toBe("false");
          expect(getMarkedCellNumbers()).toEqual([15]);
          expect(getProgressValue()).toBe("0");
        });
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<MinesweeperTutorial open={true} onClose={onClose} />);
      pressStart();
    });

    test("はじめるを押すと、動きを待たずに始めの盤面で最初の手順から始めること", () => {
      const headline = queryMessage(steps[0]?.message);

      expect(headline).not.toBeNull();
      expect(getMarkedCellNumbers()).toEqual([15]);
    });
  });

  describe("プレイ中に開いて解き終えた場合", () => {
    beforeEach(async () => {
      render(<MinesweeperTutorial open={true} onClose={onClose} />);
      pressStart();
      solveAll();
      await advanceTimeInSlices(clearEnoughMs);
    });

    test("プレイ中の盤面と同じルールだと伝え、プレイに戻る操作で閉じること", () => {
      const detail = queryShownText(completion.play.detail ?? "");
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "プレイに戻る" }),
      );

      expect(detail).not.toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

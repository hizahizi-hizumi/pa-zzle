import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { minesweeperDifficultyBoardRanges } from "@/games/minesweeper/difficulty";
import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

type CellPosition = readonly [row: number, column: number];

/** 手順ごとに印を付けるマスと、させる操作。 */
const stepOperations: readonly {
  operation: "reveal" | "flag";
  cells: readonly CellPosition[];
}[] = [
  { operation: "flag", cells: [[3, 3]] },
  { operation: "reveal", cells: [[4, 3]] },
  {
    operation: "reveal",
    cells: [
      [4, 5],
      [5, 1],
      [5, 5],
    ],
  },
];

/** 手順を終えた後に残る、地雷でないマス。 */
const remainingCells: readonly CellPosition[] = [
  [5, 3],
  [5, 4],
];

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const idleHintDelayMs = 10_000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installAnimate() {
  const animate = vi.fn(
    () =>
      ({
        cancel: vi.fn(),
        finished: Promise.resolve(),
      }) as unknown as Animation,
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  return animate;
}

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

/** 場面の動きと Animation の完了を待っては「次へ」を押し、導入を最後まで進める。 */
async function goThroughIntro(): Promise<void> {
  for (let press = 0; press < 3; press += 1) {
    await advanceTimeInSlices(introEnoughMs);
    const next = screen.queryByRole("button", { name: "次へ" });
    if (!next) {
      return;
    }
    fireEvent.click(next);
  }
  await advanceTimeInSlices(introEnoughMs);
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

/** 鳴らした効果音の音声ファイル名。 */
function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "マインスイーパー盤面" });
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
  return screen.getByRole("button", { name: "旗モード" });
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

function getCellNumbers(selector: string): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector(selector))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[1] ?? "");
}

/** 印か応えを重ねているマスの番号。 */
function getCuedCellNumbers(kind: "hint" | "fitted"): string[] {
  return getCellNumbers(`[data-cell-cue="${kind}"]`);
}

/** 印の線を短く濃くしているマスの番号。 */
function getRecalledCellNumbers(): string[] {
  return getCellNumbers('[data-tutorial-cue="recall"]');
}

/** 画面全体の覆いから抜いて、元の明るさで見せているマスの番号。 */
function getSpotlitCellNumbers(): string[] {
  return getCellNumbers("[data-tutorial-spotlight]");
}

/** 印や応えを重ねているマスの番号。 */
function getAnyCuedCellNumbers(): string[] {
  return getCellNumbers("[data-cell-cue]");
}

function hasFocusScrim(): boolean {
  return document.querySelector("[data-tutorial-focus-scrim]") !== null;
}

/** 盤面の中で、ルールに当たったときの赤を使っているか。 */
function usesRuleViolationColor(): boolean {
  return getBoard().querySelector('[class*="destructive"]') !== null;
}

/** 地雷の総数を、覆いから抜いて見せているか。 */
function isMineCountSpotlit(): boolean {
  return (
    screen
      .getByText("地雷")
      .parentElement?.querySelector("[data-tutorial-spotlight]") != null
  );
}

/** 切り替えを、覆いから抜いて見せているか。 */
function isToggleSpotlit(): boolean {
  return (
    getModeToggle().parentElement?.querySelector("[data-tutorial-spotlight]") !=
    null
  );
}

function hasToggleCue(): boolean {
  return document.querySelector('[data-toggle-cue="hint"]') !== null;
}

/** 切り替えの印の線を短く濃くしている合図。 */
function getToggleRecallCue(): Element | null {
  return document.querySelector(
    '[data-toggle-cue="hint"] [data-tutorial-cue="recall"]',
  );
}

function getRuleItems(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "ルール" })).getAllByRole(
    "listitem",
  );
}

function getRuleTexts(): string[] {
  return getRuleItems().map((item) => item.textContent ?? "");
}

describe("MinesweeperTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "2", onStart: vi.fn<() => void>() };
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
      pressNextThroughIntro();
    });

    test("5×5の盤面と地雷の数を出し、数字の決まりを示して、旗を置くマスと切り替えに印を付けること", () => {
      const cells = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText(/数字は、周りの8マスにある/);
      const detail = screen.getByText(
        "旗に切り替えて、印のマスを押してください",
      );
      const mineMetric = screen.getByText("地雷").parentElement?.textContent;
      const hinted = getCuedCellNumbers("hint");
      const toggleCued = hasToggleCue();
      const rules = getRuleTexts();

      expect(cells).toHaveLength(25);
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(mineMetric).toBe("地雷3");
      expect(hinted).toEqual(["13"]);
      expect(toggleCued).toBe(true);
      expect(rules).toEqual(["数字は周りの地雷の数", "まだ出ていないルール"]);
    });

    test("画面全体に覆いを重ね、旗を置くマスと決め手の1と切り替えだけを覆いから抜くこと", () => {
      const scrim = hasFocusScrim();
      const spotlit = getSpotlitCellNumbers();
      const toggleSpotlit = isToggleSpotlit();
      const mineCountSpotlit = isMineCountSpotlit();

      expect(scrim).toBe(true);
      expect(spotlit).toEqual(["7", "8", "9", "13"]);
      expect(toggleSpotlit).toBe(true);
      expect(mineCountSpotlit).toBe(false);
    });

    test("旗に切り替えると、切り替えの印を外して覆いに戻し、旗を置く一言に替えること", () => {
      fireEvent.click(getModeToggle());

      const toggleCued = hasToggleCue();
      const toggleSpotlit = isToggleSpotlit();
      const detail = screen.queryByText("印のマスを押して、旗を置いてください");

      expect(toggleCued).toBe(false);
      expect(toggleSpotlit).toBe(false);
      expect(detail).not.toBeNull();
    });

    test("印のマスに旗を置くと、そのマスに応え、次の決め手の1と置いた旗、開くマスを覆いから抜くこと", () => {
      operate("flag", [[3, 3]]);

      const label = getCellLabel([3, 3]);
      const fitted = getCuedCellNumbers("fitted");
      const spotlit = getSpotlitCellNumbers();
      const hinted = getCuedCellNumbers("hint");

      expect(label).toBe("マス 13 旗");
      expect(fitted).toEqual(["13"]);
      expect(spotlit).toEqual(["12", "13", "18"]);
      expect(hinted).toEqual(["18"]);
    });

    test("旗を置かせるマスを開こうとしても地雷を踏まず、赤を使わずに、印のマスと切り替えの印の線を濃くし直すこと", () => {
      const toggleRecallBefore = getToggleRecallCue();
      fireEvent.click(getCell([3, 3]));

      const label = getCellLabel([3, 3]);
      const recalled = getRecalledCellNumbers();
      const hinted = getCuedCellNumbers("hint");
      const toggleRecallAfter = getToggleRecallCue();
      const violationColored = usesRuleViolationColor();

      expect(label).toBe("マス 13 未開示");
      expect(recalled).toEqual(["13"]);
      expect(hinted).toEqual(["13"]);
      expect(toggleRecallBefore).toBeNull();
      expect(toggleRecallAfter).not.toBeNull();
      expect(violationColored).toBe(false);
    });

    test("印の無いマスを押すと、何もせず、押したマスではなく印のマスの線を、赤を使わずに濃くし直すこと", () => {
      operate("flag", [[4, 3]]);

      const label = getCellLabel([4, 3]);
      const recalled = getRecalledCellNumbers();
      const violationColored = usesRuleViolationColor();

      expect(label).toBe("マス 18 未開示");
      expect(recalled).toEqual(["13"]);
      expect(violationColored).toBe(false);
    });

    test("印の無いマスを続けて押すたびに、印のマスの線を濃くし直すこと", () => {
      operate("flag", [[4, 3]]);
      const firstFlash = getCell([3, 3]).querySelector(
        '[data-tutorial-cue="recall"]',
      );
      fireEvent.click(getCell([4, 4]));

      const secondFlash = getCell([3, 3]).querySelector(
        '[data-tutorial-cue="recall"]',
      );

      expect(firstFlash).not.toBeNull();
      expect(secondFlash).not.toBeNull();
      expect(secondFlash).not.toBe(firstFlash);
    });

    test("印のマスに旗を置くと、本番と同じ旗を置く音を鳴らすこと", () => {
      operate("flag", [[3, 3]]);

      const played = getPlayedSoundNames();

      expect(played).toEqual(["flag-placed.flac"]);
    });

    test("手順どおりにマスを開くと、本番と同じ開く音を鳴らすこと", () => {
      finishSteps(1);
      operate("reveal", [[4, 3]]);

      const layeredCalls = vi.mocked(playLayeredSound).mock.calls.length;

      expect(layeredCalls).toBe(1);
    });

    test("受け付けない手には、音を鳴らさないこと", () => {
      fireEvent.click(getCell([3, 3]));
      operate("flag", [[4, 3]]);

      const played = getPlayedSoundNames();
      const layeredCalls = vi.mocked(playLayeredSound).mock.calls.length;

      expect(played).toEqual([]);
      expect(layeredCalls).toBe(0);
    });

    test("印のとおりに旗を置くと、印の線を濃くし直すのを終えること", () => {
      operate("flag", [[4, 3]]);
      fireEvent.click(getCell([3, 3]));

      const recalled = getRecalledCellNumbers();

      expect(recalled).toEqual([]);
    });

    test("長押しで旗を置くと、開くままなので切り替えに触れずに、次のマスを押させること", () => {
      fireEvent.pointerDown(getCell([3, 3]), { button: 0 });
      advanceTime(450);

      const label = getCellLabel([3, 3]);
      const detail = screen.queryByText("印のマスを押してください");
      const toggleCued = hasToggleCue();

      expect(label).toBe("マス 13 旗");
      expect(detail).not.toBeNull();
      expect(toggleCued).toBe(false);
    });

    describe("旗を置いた後", () => {
      beforeEach(() => {
        finishSteps(1);
      });

      test("旗のままなら、旗から戻すことを一言と印で示し、切り替えを覆いから抜くこと", () => {
        const detail = screen.queryByText(
          "旗から戻して、印のマスを押してください",
        );
        const toggleCued = hasToggleCue();
        const toggleSpotlit = isToggleSpotlit();

        expect(detail).not.toBeNull();
        expect(toggleCued).toBe(true);
        expect(toggleSpotlit).toBe(true);
      });

      test("旗のまま印のマスを押しても旗を置かず、戻して押すと開くこと", () => {
        fireEvent.click(getCell([4, 3]));
        const labelOnFlag = getCellLabel([4, 3]);
        setMode("reveal");
        fireEvent.click(getCell([4, 3]));

        const label = getCellLabel([4, 3]);

        expect(labelOnFlag).toBe("マス 18 未開示");
        expect(label).toBe("マス 18 開示済み 3");
      });

      const revealedCellOperations = [
        ["旗のまま開いたマスを押す", () => fireEvent.click(getCell([2, 2]))],
        [
          "開いたマスを右クリックする",
          () => fireEvent.contextMenu(getCell([2, 2])),
        ],
        [
          "開いたマスを長押しする",
          () => {
            fireEvent.pointerDown(getCell([2, 2]), { button: 0 });
            advanceTime(450);
          },
        ],
      ] as const;

      test.each(revealedCellOperations)(
        "%sと、盤面を変えず、印のマスの線を濃くし直すこと",
        (_, operateRevealedCell) => {
          operateRevealedCell();

          const label = getCellLabel([2, 2]);
          const recalled = getRecalledCellNumbers();

          expect(label).toBe("マス 7 開示済み 1");
          expect(recalled).toEqual(["18"]);
        },
      );

      test("旗で数がそろった1を押すと、本番と同じく印のマスを開いてそのマスに応え、次へ進むこと", () => {
        setMode("reveal");
        fireEvent.click(getCell([3, 2]));

        const label = getCellLabel([4, 3]);
        const fitted = getCuedCellNumbers("fitted");
        const headline = screen.queryByText(/地雷は全部で3つ。/);

        expect(label).toBe("マス 18 開示済み 3");
        expect(fitted).toEqual(["18"]);
        expect(headline).not.toBeNull();
      });
    });

    test("3を開くと地雷の総数のルールを示し、上の地雷の数と旗と3、3から離れた3マスを覆いから抜いて、3マスに印を付けること", () => {
      finishSteps(2);

      const headline = screen.queryByText(/地雷は全部で3つ。/);
      const rules = getRuleTexts();
      const mineCountSpotlit = isMineCountSpotlit();
      const spotlit = getSpotlitCellNumbers();
      const hinted = getCuedCellNumbers("hint");

      expect(headline).not.toBeNull();
      expect(rules).toEqual(["数字は周りの地雷の数", "地雷の総数は上に出る"]);
      expect(mineCountSpotlit).toBe(true);
      expect(spotlit).toEqual(["13", "18", "20", "21", "25"]);
      expect(hinted).toEqual(["20", "21", "25"]);
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        finishSteps(stepOperations.length);
      });

      test("覆いを外し、どのマスも覆いから抜かないこと", () => {
        const scrim = hasFocusScrim();
        const spotlit = getSpotlitCellNumbers();
        const mineCountSpotlit = isMineCountSpotlit();

        expect(scrim).toBe(false);
        expect(spotlit).toEqual([]);
        expect(mineCountSpotlit).toBe(false);
      });

      test("開いても旗を置いても、本番に無い合図を重ねないこと", () => {
        operate("flag", [[5, 2]]);
        operate("reveal", [[5, 3]]);

        const cued = getAnyCuedCellNumbers();

        expect(cued).toEqual([]);
      });

      test("考えている間は印を付けず、長く手が止まると地雷でないと決まるマスを示すこと", () => {
        advanceTime(idleHintDelayMs - 1);
        const hintedWhileThinking = getCuedCellNumbers("hint");
        advanceTime(1);

        const headline = screen.queryByText(/すべて開くと完成です/);
        const hinted = getCuedCellNumbers("hint");

        expect(headline).not.toBeNull();
        expect(hintedWhileThinking).toEqual([]);
        expect(hinted).toHaveLength(1);
      });

      test("地雷でないマスに旗を置いて止まっても、手がかりの印は開けるマスに付けること", () => {
        operate("flag", [[5, 3]]);
        setMode("reveal");
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCellNumbers("hint");
        const toggleCued = hasToggleCue();

        expect(hinted).toEqual(["24"]);
        expect(toggleCued).toBe(false);
      });

      test("旗のまま止まると、開けるマスと一緒に切り替えにも印を付けること", () => {
        setMode("flag");
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCellNumbers("hint");
        const toggleCued = hasToggleCue();

        expect(hinted).toHaveLength(1);
        expect(toggleCued).toBe(true);
      });

      test("決まるマスにすべて旗を置いて開くに戻して止まると、旗のマスと切り替えに印を付けること", () => {
        operate("flag", [
          [5, 3],
          [5, 4],
        ]);
        setMode("reveal");
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCellNumbers("hint");
        const toggleCued = hasToggleCue();

        expect(hinted).toHaveLength(1);
        expect(toggleCued).toBe(true);
      });

      test("決まるマスにすべて旗を置いたまま止まると、旗のマスにだけ印を付けること", () => {
        operate("flag", [
          [5, 3],
          [5, 4],
        ]);
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCellNumbers("hint");
        const toggleCued = hasToggleCue();

        expect(hinted).toHaveLength(1);
        expect(toggleCued).toBe(false);
      });

      test("開いたマスを押しても、印の線を濃くし直さないこと", () => {
        operate("reveal", [[1, 1]]);

        const recalled = getRecalledCellNumbers();

        expect(recalled).toEqual([]);
      });

      test("地雷を踏むと盤面に残して一言で知らせ、そのまま解き切れること", () => {
        setMode("reveal");
        fireEvent.click(getCell([4, 4]));
        const message = screen.queryByText("地雷を踏みました");
        const label = getCellLabel([4, 4]);
        operate("reveal", remainingCells);

        const completed = screen.queryByText("完成です");

        expect(message).not.toBeNull();
        expect(label).toBe("マス 19 踏んだ地雷");
        expect(completed).not.toBeNull();
      });
    });

    test("解き終えると地雷を明かし、本番で地雷を踏んだときのことを伝え、演出を終えてからゲームのホームで開いているレベルを遊ぶ操作を出すこと", async () => {
      installAnimate();
      solveAll();
      const buttonDuringAnimation = screen.queryByRole("button", {
        name: "レベル 2を遊ぶ",
      });
      await advanceTimeInSlices(1000);
      const mineLabel = getCellLabel([5, 2]);
      const detail = screen.queryByText(/ミスに数えて続けられます/);
      fireEvent.click(screen.getByRole("button", { name: "レベル 2を遊ぶ" }));

      expect(buttonDuringAnimation).toBeNull();
      expect(mineLabel).toBe("マス 22 地雷");
      expect(detail).not.toBeNull();
      expect(playStart.onStart).toHaveBeenCalledOnce();
    });

    test("解き終えると、本番と同じ完成の音を1回鳴らすこと", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);

      const clearedCalls = getPlayedSoundNames().filter(
        (name) => name === "cleared.flac",
      );

      expect(clearedCalls).toHaveLength(1);
    });

    describe("解き終えた場合", () => {
      const levelBoardSizes = Object.values(
        minesweeperDifficultyBoardRanges,
      ).flatMap(({ sizes }) => sizes);
      const smallestRows = Math.min(...levelBoardSizes.map(({ rows }) => rows));
      const smallestColumns = Math.min(
        ...levelBoardSizes.map(({ columns }) => columns),
      );

      beforeEach(async () => {
        installAnimate();
        solveAll();
        await advanceTimeInSlices(1000);
      });

      test("どのレベルの盤面にも当てはまる、いちばん小さい盤面の大きさを伝えること", () => {
        const sizeMessage = screen.queryByText(
          new RegExp(
            `どのレベルも${smallestRows}×${smallestColumns}以上の盤面です`,
          ),
        );

        expect(sizeMessage).not.toBeNull();
      });
    });

    describe("解き終えて旗に切り替えた場合", () => {
      beforeEach(async () => {
        installAnimate();
        solveAll();
        setMode("flag");
        await advanceTimeInSlices(1000);
      });

      test("もう一度を押すと、始めの盤面と開く切り替えに戻すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        pressNextThroughIntro();

        const label = getCellLabel([4, 3]);
        const flagMode = getModeToggle().getAttribute("aria-pressed");

        expect(label).toBe("マス 18 未開示");
        expect(flagMode).toBe("false");
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(<MinesweeperTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
    });

    test("解き終えると、本番で地雷を踏んだときのことを伝え、プレイに戻る操作を出すこと", async () => {
      solveAll();
      await advanceTimeInSlices(1000);
      const detail = screen.queryByText(
        "地雷を踏んでも、ミスに数えて続けられます",
      );
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      const closeCalls = onClose.mock.calls.length;

      expect(detail).not.toBeNull();
      expect(closeCalls).toBe(1);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(
        <MinesweeperTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("ゴールの盤面を見せたまま待ち、次へで始まりの盤面へ進めてから最初の手順を始めること", async () => {
      await advanceTimeInSlices(introEnoughMs);
      const goalLabel = getCellLabel([5, 2]);
      const startCaption = screen.queryByText(
        "最初から一部のマスが開いています",
      );
      await goThroughIntro();

      const label = getCellLabel([5, 2]);
      const hinted = getCuedCellNumbers("hint");

      expect(goalLabel).toBe("マス 22 地雷");
      expect(startCaption).toBeNull();
      expect(label).toBe("マス 22 未開示");
      expect(hinted).toEqual(["13"]);
    });

    test("印の無いマスを押すと、動きを減らす設定でも印のマスの線を濃くし直すこと", async () => {
      await goThroughIntro();
      operate("flag", [[4, 3]]);

      const recalled = getRecalledCellNumbers();

      expect(recalled).toEqual(["13"]);
    });
  });
});

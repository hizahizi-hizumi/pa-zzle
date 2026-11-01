import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";

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

/** 手順どおりに操作してから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 900;

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
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

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "マインスイーパー盤面" });
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBoard());
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

/** 合図を重ねているマスの番号。 */
function getCuedCellNumbers(kind: "hint" | "fitted" | "reason"): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector(`[data-cell-cue="${kind}"]`))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[1] ?? "");
}

function hasToggleCue(): boolean {
  return document.querySelector('[data-toggle-cue="hint"]') !== null;
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
  let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    onStartPlay = vi.fn<() => void>();
  });

  describe("難易度選択から開いた場合", () => {
    beforeEach(() => {
      render(
        <MinesweeperTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      skipIntro();
    });

    test("5×5の盤面と地雷の数を出し、数字の決まりと旗を置くマス、旗への切り替えを示すこと", () => {
      const cells = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText(/数字は、周りの8マスにある/);
      const mineMetric = screen.getByText("地雷").parentElement?.textContent;

      expect(cells).toHaveLength(25);
      expect(headline).toBeTruthy();
      expect(mineMetric).toBe("地雷3");
      expect(getCuedCellNumbers("hint")).toEqual(["13"]);
      expect(hasToggleCue()).toBe(true);
      expect(getRuleTexts()).toEqual(["数字は周りの地雷の数", "？"]);
    });

    test("旗に切り替えると切り替えの印を外し、印のマスを押すと旗を置いて決め手の1を光らせること", () => {
      fireEvent.click(getModeToggle());
      const toggleCuedAfterSwitch = hasToggleCue();
      fireEvent.click(getCell([3, 3]));

      expect(toggleCuedAfterSwitch).toBe(false);
      expect(getCellLabel([3, 3])).toBe("マス 13 旗");
      expect(getCuedCellNumbers("fitted")).toEqual(["13"]);
      expect(getCuedCellNumbers("reason")).toEqual(["7", "8", "9"]);
    });

    test("旗を置かせるマスを開こうとしても地雷を踏まず、印を付け直すこと", () => {
      const cueBefore = getCell([3, 3]).querySelector('[data-cell-cue="hint"]');
      fireEvent.click(getCell([3, 3]));

      const cueAfter = getCell([3, 3]).querySelector('[data-cell-cue="hint"]');

      expect(getCellLabel([3, 3])).toBe("マス 13 未開示");
      expect(cueAfter).not.toBe(cueBefore);
    });

    test("長押しでも、印のマスに旗を置けること", () => {
      fireEvent.pointerDown(getCell([3, 3]), { button: 0 });
      advanceTime(450);

      expect(getCellLabel([3, 3])).toBe("マス 13 旗");
    });

    describe("旗を置いた後", () => {
      beforeEach(() => {
        finishSteps(1);
      });

      test("決め手が光った後に、開くマスと、切り替えを戻すことを示すこと", () => {
        const hintedRightAfter = getCuedCellNumbers("hint");
        advanceTime(nextStepCueDelayMs);

        expect(hintedRightAfter).toEqual([]);
        expect(getCuedCellNumbers("hint")).toEqual(["18"]);
        expect(hasToggleCue()).toBe(true);
      });

      test("旗のまま印のマスを押しても旗を置かず、戻して押すと開くこと", () => {
        fireEvent.click(getCell([4, 3]));
        const labelOnFlag = getCellLabel([4, 3]);
        setMode("reveal");
        fireEvent.click(getCell([4, 3]));

        expect(labelOnFlag).toBe("マス 18 未開示");
        expect(getCellLabel([4, 3])).toBe("マス 18 開示済み 3");
      });
    });

    test("3を開くと地雷の総数のルールを示し、3から離れた3マスに印を付けること", () => {
      finishSteps(2);
      advanceTime(nextStepCueDelayMs);

      expect(screen.getByText(/地雷は全部で3つ。/)).toBeTruthy();
      expect(getRuleTexts()).toEqual([
        "数字は周りの地雷の数",
        "地雷の総数は上に出る",
      ]);
      expect(getCuedCellNumbers("hint")).toEqual(["20", "21", "25"]);
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        finishSteps(stepOperations.length);
      });

      test("印を付けず、手が止まると地雷でないと決まるマスを示すこと", () => {
        const hintedRightAfter = getCuedCellNumbers("hint");
        advanceTime(idleHintDelayMs);

        expect(screen.getByText(/すべて開くと完成です/)).toBeTruthy();
        expect(hintedRightAfter).toEqual([]);
        expect(getCuedCellNumbers("hint")).toHaveLength(1);
      });

      test("地雷を踏むと盤面に残して一言で知らせ、そのまま解き切れること", () => {
        setMode("reveal");
        fireEvent.click(getCell([4, 4]));
        const message = screen.getByText("地雷を踏みました");
        operate("reveal", remainingCells);

        expect(message).toBeTruthy();
        expect(getCellLabel([4, 4])).toBe("マス 19 踏んだ地雷");
        expect(screen.getByText("完成です")).toBeTruthy();
      });
    });

    test("解き終えると地雷を明かし、演出を終えてからレベル1を遊ぶ操作を出すこと", async () => {
      installAnimate();
      solveAll();
      const buttonDuringAnimation = screen.queryByRole("button", {
        name: "レベル1を遊ぶ",
      });
      await advanceTimeInSlices(1000);
      const mineLabel = getCellLabel([5, 2]);
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(mineLabel).toBe("マス 22 地雷");
      expect(buttonDuringAnimation).toBeNull();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("もう一度を押すと、始めの盤面と旗を開く切り替えに戻すこと", async () => {
      installAnimate();
      solveAll();
      setMode("flag");
      await advanceTimeInSlices(1000);
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      skipIntro();

      expect(getCellLabel([4, 3])).toBe("マス 18 未開示");
      expect(getModeToggle().getAttribute("aria-pressed")).toBe("false");
    });
  });

  test("プレイ中に開いた場合は、解き終えるとプレイに戻る操作を出すこと", async () => {
    installAnimate();
    render(<MinesweeperTutorial open={true} onClose={onClose} />);
    skipIntro();
    solveAll();
    await advanceTimeInSlices(1000);
    const detail = screen.queryByText("プレイ中の盤面も同じルールで解けます");
    fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

    expect(detail).toBeTruthy();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("動きを減らす設定でも、ゴールと始まりの盤面を見せてから最初の手順を始めること", async () => {
    stubReducedMotion();
    render(
      <MinesweeperTutorial
        open={true}
        onStartPlay={onStartPlay}
        onClose={onClose}
      />,
    );
    const goalLabel = getCellLabel([5, 2]);
    await advanceTimeInSlices(introEnoughMs);

    expect(goalLabel).toBe("マス 22 地雷");
    expect(getCellLabel([5, 2])).toBe("マス 22 未開示");
    expect(getCuedCellNumbers("hint")).toEqual(["13"]);
  });
});

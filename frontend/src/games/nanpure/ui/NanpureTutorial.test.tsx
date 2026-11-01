import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";

type CellEntry = readonly [row: number, column: number, digit: number];

/** 手順ごとに印を付けるマスと、入れる解の数字。 */
const stepEntries: readonly CellEntry[] = [
  [6, 3, 9],
  [6, 9, 7],
  [7, 1, 2],
  [4, 9, 3],
  [3, 6, 1],
];

/** 手順を終えた後に残るマスと、その解の数字。 */
const remainingEntries: readonly CellEntry[] = [
  [2, 2, 9],
  [2, 6, 6],
  [3, 5, 8],
  [3, 9, 5],
  [4, 6, 5],
  [7, 3, 5],
  [8, 5, 4],
];

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const idleHintDelayMs = 10_000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
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

/** 盤面のマス。81マスの名前を毎回すべて計算しないよう、名前の頭で引く。 */
function getCell(row: number, column: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `button[aria-label^="${row}行${column}列、"]`,
  );
  if (!cell) {
    throw new Error(`cell ${row}:${column} not found`);
  }
  return cell;
}

function getCellLabel(row: number, column: number): string | null {
  return getCell(row, column).getAttribute("aria-label");
}

function getCellIndex(row: number, column: number): number {
  return (row - 1) * 9 + (column - 1);
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(getCell(1, 1));
}

function getDigitButton(digit: number): HTMLElement {
  const button = Array.from(
    document.querySelectorAll<HTMLElement>("fieldset button"),
  ).find((element) => element.textContent === String(digit));
  if (!button) {
    throw new Error(`digit ${digit} not found`);
  }
  return button;
}

function enter([row, column, digit]: CellEntry): void {
  fireEvent.click(getCell(row, column));
  fireEvent.click(getDigitButton(digit));
}

function finishSteps(count: number): void {
  for (const entry of stepEntries.slice(0, count)) {
    enter(entry);
  }
}

function solveAll(): void {
  finishSteps(stepEntries.length);
  for (const entry of remainingEntries) {
    enter(entry);
  }
}

/** 合図を重ねているマスの番号（0始まり）。 */
function getCuedCellIndices(kind: "hint" | "fitted" | "rejected"): number[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-cell-cue="${kind}"]`),
  ).map((element) => Number(element.dataset.cellIndex));
}

/** 合図を重ねている行・列・ブロック。 */
function getCuedUnits(kind: "clue" | "reason"): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-unit-cue="${kind}"]`),
  ).map((element) => element.dataset.unit ?? "");
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("NanpureTutorial", () => {
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
        <NanpureTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      skipIntro();
    });

    test("9×9の盤面と数字のボタンを出し、操作の一言と、数字を入れるマスの印を示すこと", () => {
      const cells = document.querySelectorAll('button[aria-label*="行"]');
      const digitPad = screen.getByRole("group", { name: "数字入力" });
      const headline = screen.queryByText("マスを選んで、下の数字を押します");
      const detail = screen.queryByText("印の付いたマスに9を入れてください");
      const hinted = getCuedCellIndices("hint");
      const digitDisabled = getDigitButton(9).hasAttribute("disabled");
      const rules = getRuleTexts();

      expect(cells).toHaveLength(81);
      expect(within(digitPad).getAllByRole("button")).toHaveLength(9);
      expect(headline).not.toBeNull();
      expect(detail).not.toBeNull();
      expect(hinted).toEqual([getCellIndex(6, 3)]);
      expect(digitDisabled).toBe(true);
      expect(rules).toEqual(["伏せたルール", "伏せたルール", "伏せたルール"]);
    });

    test("印のマスを選ぶと、押す数字のボタンにも印を付けること", () => {
      fireEvent.click(getCell(6, 3));

      const pressed = getCell(6, 3).getAttribute("aria-pressed");
      const digitCue = getDigitButton(9).querySelector(
        '[data-digit-cue="hint"]',
      );

      expect(pressed).toBe("true");
      expect(digitCue).not.toBeNull();
    });

    test("印の無いマスを押すと、選ばずに押したマスを縁取り、印を光らせ直すこと", () => {
      const hintBefore = document.querySelector('[data-cell-cue="hint"]');
      fireEvent.click(getCell(1, 1));

      const pressed = getCell(1, 1).getAttribute("aria-pressed");
      const rejected = getCuedCellIndices("rejected");
      const hintAfter = document.querySelector('[data-cell-cue="hint"]');

      expect(pressed).toBe("false");
      expect(rejected).toEqual([getCellIndex(1, 1)]);
      expect(hintAfter).not.toBe(hintBefore);
    });

    test("印のマスに数字を入れると、そのマスを光らせ、行のルールと決め手の行、次のマスを示すこと", () => {
      finishSteps(1);

      const label = getCellLabel(6, 3);
      const fitted = getCuedCellIndices("fitted");
      const headline = screen.queryByText(/どの行にも/);
      const clues = getCuedUnits("clue");
      const hinted = getCuedCellIndices("hint");
      const rules = getRuleTexts();

      expect(label).toBe("6行3列、9");
      expect(fitted).toEqual([getCellIndex(6, 3)]);
      expect(headline).not.toBeNull();
      expect(clues).toEqual(["row:5"]);
      expect(hinted).toEqual([getCellIndex(6, 9)]);
      expect(rules).toEqual(["行に1つずつ", "伏せたルール", "伏せたルール"]);
    });

    test("行で重なる数字を入れると、重なりを赤く示して一言で言い、正しい数字に入れ替えると次へ進むこと", () => {
      finishSteps(1);
      enter([6, 9, 1]);
      const invalid = getCell(6, 9).getAttribute("aria-invalid");
      const violation = screen.queryByText("この行には、もう1があります");
      fireEvent.click(getDigitButton(7));

      const headline = screen.queryByText(/どの列にも/);

      expect(invalid).toBe("true");
      expect(violation).not.toBeNull();
      expect(headline).not.toBeNull();
    });

    test("ブロックのルールでは、太線で区切ったブロックを示すこと", () => {
      finishSteps(3);

      const headline = screen.queryByText(/太線で区切ったブロックにも/);
      const clues = getCuedUnits("clue");

      expect(headline).not.toBeNull();
      expect(clues).toEqual(["block:5"]);
    });

    test("最後の手順では、印のマスの行・列・ブロックをまとめて示すこと", () => {
      finishSteps(4);

      const clues = getCuedUnits("clue");
      const hinted = getCuedCellIndices("hint");

      expect(clues).toEqual(["row:2", "column:5", "block:1"]);
      expect(hinted).toEqual([getCellIndex(3, 6)]);
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        finishSteps(stepEntries.length);
      });

      test("考えている間は印を付けず、長く手が止まると決まるマスと決め手を示すこと", () => {
        advanceTime(idleHintDelayMs - 1);
        const hintedWhileThinking = getCuedCellIndices("hint");
        advanceTime(1);

        const headline = screen.queryByText("あとは残りを埋めれば完成です");
        const hinted = getCuedCellIndices("hint");
        const clues = getCuedUnits("clue");

        expect(headline).not.toBeNull();
        expect(hintedWhileThinking).toEqual([]);
        expect(hinted).toHaveLength(1);
        expect(clues).toHaveLength(1);
      });

      test("どのマスも選べ、最初からある数字のマスでは数字のボタンを押せないこと", () => {
        fireEvent.click(getCell(1, 1));

        const pressed = getCell(1, 1).getAttribute("aria-pressed");
        const rejected = getCuedCellIndices("rejected");
        const digitDisabled = getDigitButton(6).hasAttribute("disabled");

        expect(pressed).toBe("true");
        expect(rejected).toEqual([]);
        expect(digitDisabled).toBe(true);
      });

      test("正しく入れた数字は、決め手の行・列・ブロックを光らせること", () => {
        enter([4, 6, 5]);

        const reasons = getCuedUnits("reason");

        expect(reasons).toEqual(["row:3"]);
      });

      test("前に入れた違う数字と重なる正しい数字を入れると、違う数字のマスにすぐ印を付けること", () => {
        enter([2, 2, 6]);
        enter([2, 6, 6]);

        const hinted = getCuedCellIndices("hint");
        const headline = screen.queryByText("印のマスの数字が違います");

        expect(hinted).toEqual([getCellIndex(2, 2)]);
        expect(headline).not.toBeNull();
      });

      test("違う数字を入れて止まると、そのマスを手がかりとして示すこと", () => {
        enter([4, 6, 4]);
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCellIndices("hint");

        expect(hinted).toEqual([getCellIndex(4, 6)]);
      });
    });

    test("解き終えると、演出を終えてからレベル1を遊ぶ操作を出すこと", async () => {
      installAnimate();
      solveAll();
      const buttonDuringAnimation = screen.queryByRole("button", {
        name: "レベル1を遊ぶ",
      });
      await advanceTimeInSlices(1000);
      const detail = screen.queryByText(
        "レベル1は、空いたマスがもっと多い盤面です",
      );
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      const startPlayCalls = onStartPlay.mock.calls.length;

      expect(buttonDuringAnimation).toBeNull();
      expect(detail).not.toBeNull();
      expect(startPlayCalls).toBe(1);
    });

    test("解き終えてもう一度を押すと、始めの盤面に戻すこと", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      skipIntro();

      const label = getCellLabel(6, 3);
      const hinted = getCuedCellIndices("hint");

      expect(label).toBe("6行3列、空き");
      expect(hinted).toEqual([getCellIndex(6, 3)]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(<NanpureTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("解き終えると、プレイに戻る操作を出すこと", async () => {
      solveAll();
      await advanceTimeInSlices(1000);
      const detail = screen.queryByText("プレイ中の盤面も同じルールで解けます");
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
        <NanpureTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
    });

    test("ゴールの盤面を見せたまま待ち、次へで始まりの盤面へ進めてから最初の手順を始めること", async () => {
      await advanceTimeInSlices(introEnoughMs);
      const goalLabel = getCellLabel(6, 3);
      const startCaption = screen.queryByText(
        "最初はいくつかのマスが空いています",
      );
      await goThroughIntro();

      const label = getCellLabel(6, 3);
      const hinted = getCuedCellIndices("hint");

      expect(goalLabel).toBe("6行3列、9");
      expect(startCaption).toBeNull();
      expect(label).toBe("6行3列、空き");
      expect(hinted).toEqual([getCellIndex(6, 3)]);
    });
  });
});

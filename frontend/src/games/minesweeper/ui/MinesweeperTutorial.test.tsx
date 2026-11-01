import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";

type StepOperation =
  | readonly [
      operation: "reveal" | "flag" | "chord",
      row: number,
      column: number,
    ]
  | readonly [operation: "flag-mode"];

/** 手順ごとの印のマスと操作。 */
const stepOperations: readonly StepOperation[] = [
  ["reveal", 1, 1],
  ["flag-mode"],
  ["flag", 2, 1],
  ["reveal", 3, 1],
  ["reveal", 4, 1],
  ["flag", 3, 4],
  ["chord", 4, 3],
  ["flag", 6, 4],
  ["reveal", 6, 5],
];

/** 手順を終えた後に開くマス。 */
const remainingCells: readonly (readonly [row: number, column: number])[] = [
  [6, 6],
  [4, 6],
];

/** 手を離した後、手が止まってから開けるマスを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 完成の脈打ちを動かせない環境で、終えたときの操作を出すまでの間。 */
const clearHoldMs = 900;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "マインスイーパー盤面" });
}

function getCell(row: number, column: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^マス ${(row - 1) * 6 + column} `),
  });
}

function getCellLabel(row: number, column: number): string {
  return (
    getCell(row, column)
      .getAttribute("aria-label")
      ?.replace(/^マス \d+ /, "") ?? ""
  );
}

function getModeToggle(): HTMLElement {
  return screen.getByRole("button", { name: "旗モード" });
}

function setFlagMode(flag: boolean): void {
  if ((getModeToggle().getAttribute("aria-pressed") === "true") !== flag) {
    fireEvent.click(getModeToggle());
  }
}

function operate(step: StepOperation): void {
  if (step[0] === "flag-mode") {
    setFlagMode(true);
    return;
  }
  const [operation, row, column] = step;
  setFlagMode(operation === "flag");
  fireEvent.click(getCell(row, column));
}

function finishSteps(count: number): void {
  for (const step of stepOperations.slice(0, count)) {
    operate(step);
  }
}

function solveAll(): void {
  finishSteps(stepOperations.length);
  for (const [row, column] of remainingCells) {
    operate(["reveal", row, column]);
  }
}

/** 合図を重ねているマスの番号。 */
function getCuedCells(kind: "hint" | "focus"): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector(`[data-cell-cue="${kind}"]`))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[1] ?? "");
}

function isModeCued(): boolean {
  return (
    getModeToggle().parentElement?.querySelector('[data-mode-cue="hint"]') !==
    null
  );
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("MinesweeperTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    onStartPlay = vi.fn<() => void>();
    render(
      <MinesweeperTutorial
        open={true}
        onStartPlay={onStartPlay}
        onClose={onClose}
      />,
    );
    fireEvent.pointerDown(getBoard());
  });

  test("6×6 の盤面と地雷の数を出し、開き方と最初に押すマスを示して、ルールを伏せておくこと", () => {
    const cells = within(getBoard()).getAllByRole("button");
    const headline = screen.getByText("マスを押すと開きます");
    const mineCount = screen.getByText("地雷").nextElementSibling?.textContent;
    const hinted = getCuedCells("hint");
    const rules = getRuleTexts();

    expect(cells).toHaveLength(36);
    expect(headline).toBeTruthy();
    expect(mineCount).toBe("4");
    expect(hinted).toEqual(["1"]);
    expect(rules).toEqual(["？", "？", "？", "？"]);
  });

  test("印の無いマスを押しても開かず、印を付け直すこと", () => {
    const hintBefore = getCell(1, 1).querySelector('[data-cell-cue="hint"]');
    fireEvent.click(getCell(3, 3));

    const hintAfter = getCell(1, 1).querySelector('[data-cell-cue="hint"]');

    expect(getCellLabel(3, 3)).toBe("未開示");
    expect(hintAfter).not.toBe(hintBefore);
  });

  describe("旗への切り替えを示す手順に進んだ場合", () => {
    beforeEach(() => {
      finishSteps(1);
    });

    test("旗を置くことと切り替え方を言い、切り替えのボタンだけに印を付けること", () => {
      const headline = screen.getByText("地雷のマスには旗を置きます");
      const detail = screen.getByText("盤面の右上のボタンで旗に切り替えます");

      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(isModeCued()).toBe(true);
      expect(getCuedCells("hint")).toEqual([]);
    });
  });

  describe("数字を示す手順に進んだ場合", () => {
    beforeEach(() => {
      finishSteps(2);
    });

    test("数字のルールを示し、地雷のマスに印を付けて、決め手の数字を目立たせること", () => {
      const headline = screen.getByText(/周りの8マスにある地雷の数です/);
      const focused = getCuedCells("focus");
      const hinted = getCuedCells("hint");

      expect(headline).toBeTruthy();
      expect(isModeCued()).toBe(false);
      expect(hinted).toEqual(["7"]);
      expect(focused).toEqual(["1"]);
      expect(getRuleTexts()).toEqual(["周りの地雷", "？", "？", "？"]);
    });

    test("旗を置くと、旗の数を数えて次の手順へ進むこと", () => {
      fireEvent.click(getCell(2, 1));

      const next = screen.getByText(/1の周りの地雷は旗のマスだけなので/);
      const flags = screen.getByText("旗").nextElementSibling?.textContent;

      expect(getCellLabel(2, 1)).toBe("旗");
      expect(next).toBeTruthy();
      expect(flags).toBe("1");
    });

    test("開くに戻してから長押しで旗を置いても、次の手順へ進むこと", () => {
      setFlagMode(false);
      fireEvent.contextMenu(getCell(2, 1));

      const next = screen.getByText(/1の周りの地雷は旗のマスだけなので/);

      expect(next).toBeTruthy();
    });
  });

  describe("続けて開く手順を終えた場合", () => {
    beforeEach(() => {
      finishSteps(5);
    });

    test("周りに地雷が無いマスから左下が続けて開くこと", () => {
      const labels = [getCellLabel(5, 1), getCellLabel(6, 2)];

      expect(labels).toEqual(["開示済み 空白", "開示済み 空白"]);
      expect(getRuleTexts()).toEqual(["周りの地雷", "続けて開く", "？", "？"]);
    });
  });

  describe("まとめて開く手順を終えた場合", () => {
    beforeEach(() => {
      finishSteps(7);
    });

    test("押した数字の周りの閉じたマスをまとめて開くこと", () => {
      const labels = [getCellLabel(4, 4), getCellLabel(5, 4)];

      expect(labels).toEqual(["開示済み 2", "開示済み 2"]);
    });
  });

  describe("地雷の数を示す手順で開くに戻した場合", () => {
    beforeEach(() => {
      finishSteps(8);
      setFlagMode(false);
    });

    test("地雷の数と決め手の数字を目立たせ、開くマスに印を付けること", () => {
      const focused = getCuedCells("focus");
      const mineCount = screen.getByText("地雷").parentElement;

      expect(focused).toEqual(["18"]);
      expect(mineCount?.dataset.focused).toBe("true");
      expect(getCuedCells("hint")).toEqual(["35"]);
    });
  });

  describe("手順を終えた場合", () => {
    beforeEach(() => {
      finishSteps(stepOperations.length);
    });

    test("残りを開くことを伝え、手が止まったときだけ開けるマスを示すこと", () => {
      const message = screen.getByText("残りのマスを開くと完成です");
      advanceTime(idleHintDelayMs - 1);
      const hintedBeforeIdle = getCuedCells("hint");
      advanceTime(1);

      const hinted = getCuedCells("hint");

      expect(message).toBeTruthy();
      expect(hintedBeforeIdle).toEqual([]);
      expect(hinted).toHaveLength(1);
    });

    test("地雷を開くと踏んだ地雷として残し、ミスを数えて、続けられること", () => {
      operate(["reveal", 4, 5]);

      const message = screen.getByText("地雷を踏みました");
      const mistakes = screen.getByText("ミス").nextElementSibling?.textContent;

      expect(message).toBeTruthy();
      expect(getCellLabel(4, 5)).toBe("踏んだ地雷");
      expect(mistakes).toBe("1");
    });

    test("地雷を踏んだ後に何も起きないマスを押すと、踏んだ一言を消すこと", () => {
      operate(["reveal", 4, 5]);
      operate(["reveal", 1, 3]);

      const message = screen.getByText("残りのマスを開くと完成です");

      expect(message).toBeTruthy();
    });
  });

  describe("解き終えた場合", () => {
    beforeEach(() => {
      solveAll();
      advanceTime(clearHoldMs);
    });

    test("終わりの一言を出し、レベル1を遊ぶで本番を始めること", () => {
      const message = screen.getByText("完成です");
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(message).toBeTruthy();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("もう一度で、始まりの盤面から最初の手順を始めること", () => {
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      advanceTime(introEnoughMs);

      const message = screen.getByText("マスを押すと開きます");

      expect(message).toBeTruthy();
      expect(getCellLabel(1, 1)).toBe("未開示");
    });
  });
});

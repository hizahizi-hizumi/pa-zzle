import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { ReflectionTutorial } from "@/games/reflection/ui/ReflectionTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

type Press =
  | { clue: string }
  | { stock: string }
  | { cell: readonly [row: number, column: number] };

/** 手順ごとに押す所。外周ヒントは名前の先頭、ストックは種類の名前、マスは行と列。 */
const guidedPresses: readonly Press[] = [
  { clue: "左2行" },
  { stock: "ブラックホール" },
  { cell: [3, 3] },
  { stock: "右上がりの鏡" },
  { cell: [4, 5] },
  { stock: "反射体" },
  { cell: [4, 4] },
  { stock: "横の両面鏡" },
  { cell: [2, 4] },
];

/** 手を離した後に置く所。 */
const freePresses: readonly Press[] = [
  { stock: "右下がりの鏡" },
  { cell: [3, 1] },
  { stock: "縦の両面鏡" },
  { cell: [5, 1] },
];

/** 手を離した後、手が止まってから次の手を示すまでの間。 */
const idleHintDelayMs = 10_000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

/** 完成演出を見せ終えるのに十分な間。 */
const clearEnoughMs = 3000;

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installAnimate(): void {
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          cancel: vi.fn(),
          finished: Promise.resolve(),
        }) as unknown as Animation,
    ),
  });
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
  return screen.getByRole("group", { name: "リフレクション盤面" });
}

function getClue(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${name} `) });
}

function getStock(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: /^ストック/ })).getByRole(
    "button",
    { name: new RegExp(`^${name} 残り`) },
  );
}

function getCell(row: number, column: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${row}行${column}列 `),
  });
}

function getCueKinds(element: HTMLElement): string[] {
  return Array.from(
    element.querySelectorAll<HTMLElement>("[data-cue]"),
    (cue) => cue.dataset.cue ?? "",
  );
}

function listPlacedCellLabels(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .flatMap((cell) => {
      const label = cell.getAttribute("aria-label") ?? "";
      return label.endsWith("空き") ? [] : [label];
    });
}

function press(target: Press): void {
  if ("clue" in target) {
    fireEvent.click(getClue(target.clue));
  } else if ("stock" in target) {
    fireEvent.click(getStock(target.stock));
  } else {
    fireEvent.click(getCell(target.cell[0], target.cell[1]));
  }
}

function pressAll(targets: readonly Press[]): void {
  for (const target of targets) {
    press(target);
  }
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBoard());
}

/** 一言の見出し。盤面の上の、一言を読み上げる欄にある。 */
function getMessage(): string {
  const live = document.querySelector("[aria-live='polite']");
  return live?.textContent ?? "";
}

describe("ReflectionTutorial", () => {
  const onStartPlay = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onStartPlay.mockClear();
    onClose.mockClear();
    vi.mocked(playSound).mockClear();
    vi.mocked(playLayeredSound).mockClear();
  });

  describe("難易度選択から開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <ReflectionTutorial open onStartPlay={onStartPlay} onClose={onClose} />,
      );
    });

    describe("導入", () => {
      test("何をするパズルかと、6つのピースを置き終えたゴールの盤面を見せること", async () => {
        await advanceTimeInSlices(introEnoughMs);
        const purpose = screen.queryByText(/外周の数字どおりに光が進むよう/);
        const caption = screen.queryByText("この盤面がゴールです");
        const placed = listPlacedCellLabels();

        expect(purpose).not.toBeNull();
        expect(caption).not.toBeNull();
        expect(placed).toHaveLength(6);
      });

      test("「次へ」で、ピースを1つも置いていない始めの盤面と、ストックに並んだピースを見せること", async () => {
        await advanceTimeInSlices(introEnoughMs);
        fireEvent.click(screen.getByRole("button", { name: "次へ" }));
        await advanceTimeInSlices(introEnoughMs);
        const caption = screen.queryByText(/最初は盤面が空です/);
        const placed = listPlacedCellLabels();
        const blackHole = getStock("ブラックホール").getAttribute("aria-label");

        expect(caption).not.toBeNull();
        expect(placed).toEqual([]);
        expect(blackHole).toBe("ブラックホール 残り1");
      });
    });

    describe("手を引く間", () => {
      beforeEach(() => {
        skipIntro();
      });

      test("数字のルールを示し、光を出す外周ヒントに印を付けること", () => {
        const message = getMessage();
        const currentRule = screen
          .getByRole("list", { name: "ルール" })
          .querySelector("[aria-current='step']")?.textContent;
        const cues = getCueKinds(getClue("左2行"));

        expect(message).toContain("通るマスの数");
        expect(currentRule).toBe("数字");
        expect(cues).toEqual(["hint"]);
      });

      test("印の無い外周ヒントを押すと、押した所に何も出さず、印を光らせ直して光を出さないこと", () => {
        const hintBefore = getClue("左2行").querySelector("[data-cue='hint']");
        fireEvent.click(getClue("上1列"));
        const hintAfter = getClue("左2行").querySelector("[data-cue='hint']");
        const cues = getCueKinds(getClue("上1列"));
        const pressed = getClue("上1列").getAttribute("aria-pressed");
        const message = getMessage();

        expect(hintAfter).not.toBeNull();
        expect(hintAfter).not.toBe(hintBefore);
        expect(cues).toEqual([]);
        expect(pressed).toBe("false");
        expect(message).toContain("通るマスの数");
      });

      test("印の外周ヒントを押すと光を出し、ブラックホールのルールと、選ぶ種類と、置く場所を決める外周ヒントを示すこと", () => {
        fireEvent.click(getClue("左2行"));
        const pressed = getClue("左2行").getAttribute("aria-pressed");
        const message = getMessage();
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const reasonCues = getCueKinds(getClue("上3列"));

        expect(pressed).toBe("true");
        expect(message).toContain("ブラックホールは、光を吸い込みます");
        expect(stockCues).toEqual(["hint"]);
        expect(reasonCues).toEqual(["reason"]);
      });

      test("種類を選ぶと、置くマスに印を移し、置く場所を決める外周ヒントの光を出すこと", () => {
        pressAll([{ clue: "左2行" }, { stock: "ブラックホール" }]);
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const cellCues = getCueKinds(getCell(3, 3));
        const pressed = getClue("上3列").getAttribute("aria-pressed");

        expect(stockCues).toEqual([]);
        expect(cellCues).toEqual(["hint"]);
        expect(pressed).toBe("true");
      });

      test("印の無いマスを押すと、押したマスに何も出さず、印を光らせ直して置かないこと", () => {
        pressAll([{ clue: "左2行" }, { stock: "ブラックホール" }]);
        const hintBefore = getCell(3, 3).querySelector("[data-cue='hint']");
        fireEvent.click(getCell(1, 3));
        const hintAfter = getCell(3, 3).querySelector("[data-cue='hint']");
        const label = getCell(1, 3).getAttribute("aria-label");
        const cues = getCueKinds(getCell(1, 3));

        expect(hintAfter).not.toBeNull();
        expect(hintAfter).not.toBe(hintBefore);
        expect(label).toBe("1行3列 空き");
        expect(cues).toEqual([]);
      });

      test("本番と同じく、種類を選んでも音を鳴らさず、置くと置いた音を鳴らすこと", () => {
        pressAll([{ clue: "左2行" }, { stock: "ブラックホール" }]);
        const callsAfterSelect = vi.mocked(playSound).mock.calls.length;
        press({ cell: [3, 3] });
        const callsAfterPlace = vi.mocked(playSound).mock.calls.length;

        expect(callsAfterSelect).toBe(0);
        expect(callsAfterPlace).toBe(1);
      });

      test("印のマスに置くと、そのマスを光らせ、外周ヒントが合ったことを光と地で返して、次の手順へ進むこと", () => {
        pressAll([
          { clue: "左2行" },
          { stock: "ブラックホール" },
          { cell: [3, 3] },
        ]);
        const label = getCell(3, 3).getAttribute("aria-label");
        const cues = getCueKinds(getCell(3, 3));
        const clue = getClue("上3列");
        const message = getMessage();

        expect(label).toBe("3行3列 ブラックホール");
        expect(cues).toContain("fitted");
        expect(clue.getAttribute("data-matched")).toBe("true");
        expect(clue.getAttribute("aria-pressed")).toBe("true");
        expect(message).toContain("斜め鏡は、光を直角に曲げます");
      });
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        skipIntro();
        pressAll(guidedPresses);
      });

      test("残りを置かせる一言を出し、考えている間は印を付けないこと", () => {
        advanceTime(idleHintDelayMs - 1);
        const message = getMessage();
        const cues = getCueKinds(getStock("右下がりの鏡"));

        expect(message).toContain("残りのピースも置きましょう");
        expect(cues).toEqual([]);
      });

      test("長く手が止まると、次に選ぶ種類と、それを決める外周ヒントを示すこと", () => {
        advanceTime(idleHintDelayMs);
        const stockCues = getCueKinds(getStock("右下がりの鏡"));
        const reasonCues = getCueKinds(getClue("左3行"));

        expect(stockCues).toEqual(["hint"]);
        expect(reasonCues).toEqual(["reason"]);
      });

      test("最後の手順の結果として、最初に出した光が両面鏡に沿って通る様子を見せ、押すと本番と同じく閉じること", () => {
        const shownBefore = getClue("左2行").getAttribute("aria-pressed");
        fireEvent.click(getClue("左2行"));
        const shownAfter = getClue("左2行").getAttribute("aria-pressed");

        expect(shownBefore).toBe("true");
        expect(shownAfter).toBe("false");
      });

      test("本番と同じく、数字キーでストックの種類を選び、Esc で選んだものを解除すること", () => {
        fireEvent.keyDown(window, { key: "2" });
        const selected = getStock("右下がりの鏡").getAttribute("aria-pressed");
        fireEvent.keyDown(window, { key: "Escape" });
        const released = getStock("右下がりの鏡").getAttribute("aria-pressed");

        expect(selected).toBe("true");
        expect(released).toBe("false");
        expect(onClose).not.toHaveBeenCalled();
      });

      test("印の無い所を押しても縁取らず、本番と同じく置けること", () => {
        pressAll([{ stock: "右下がりの鏡" }, { cell: [1, 1] }]);
        const label = getCell(1, 1).getAttribute("aria-label");
        const cues = getCueKinds(getCell(1, 1));

        expect(label).toBe("1行1列 右下がりの鏡");
        expect(cues).toEqual([]);
      });

      test("残りを置いて解くと、完成演出の後に、レベル1を遊ぶ操作を出すこと", async () => {
        pressAll(freePresses);
        const message = getMessage();
        await advanceTimeInSlices(clearEnoughMs);
        fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

        expect(message).toContain("完成です");
        expect(playLayeredSound).toHaveBeenCalledOnce();
        expect(onStartPlay).toHaveBeenCalledOnce();
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      installAnimate();
      render(
        <ReflectionTutorial open onStartPlay={onStartPlay} onClose={onClose} />,
      );
    });

    test("ゴールと始めの盤面を「次へ」で順に見せて、最初の手順を始めること", async () => {
      await advanceTimeInSlices(2000);
      const goalCaption = screen.queryByText("この盤面がゴールです");
      fireEvent.click(screen.getByRole("button", { name: "次へ" }));
      await advanceTimeInSlices(500);
      const startCaption = screen.queryByText(/最初は盤面が空です/);
      fireEvent.click(screen.getByRole("button", { name: "次へ" }));
      await advanceTimeInSlices(500);
      const message = getMessage();
      const cues = getCueKinds(getClue("左2行"));

      expect(goalCaption).not.toBeNull();
      expect(startCaption).not.toBeNull();
      expect(message).toContain("通るマスの数");
      expect(cues).toEqual(["hint"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(<ReflectionTutorial open onClose={onClose} />);
      skipIntro();
      pressAll(guidedPresses);
    });

    test("解き終えると、プレイに戻る操作を出すこと", async () => {
      pressAll(freePresses);
      await advanceTimeInSlices(clearEnoughMs);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

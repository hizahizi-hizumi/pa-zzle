import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
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

/** 数字のルールの手順で押す所。最初の光と、その光が出た先。 */
const numberPresses: readonly Press[] = [{ clue: "左2行" }, { clue: "右2行" }];

/** 手順ごとに押す所。外周ヒントは名前の先頭、ストックは種類の名前、マスは行と列。 */
const guidedPresses: readonly Press[] = [
  ...numberPresses,
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

/** 印（`mark`）・印の押し直し（`recall`）・応え（`acknowledgement`）のうち、重ねているもの。 */
function getCueKinds(element: HTMLElement): string[] {
  return Array.from(
    element.querySelectorAll<HTMLElement>("[data-tutorial-cue]"),
    (cue) => cue.dataset.tutorialCue ?? "",
  );
}

/** 画面全体の覆いから抜いて、元の明るさで見せているか。 */
function isSpotlit(element: HTMLElement): boolean {
  return element.querySelector("[data-tutorial-spotlight]") !== null;
}

/** 手を引いている間の、画面全体の覆い。 */
function getFocusScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
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

/** 一言の見出し。盤面の上の、一言を読み上げる欄にある。 */
function getMessage(): string {
  const live = document.querySelector("[aria-live='polite']");
  return live?.textContent ?? "";
}

describe("ReflectionTutorial", () => {
  const playStart: TutorialPlayStart = { difficulty: "3", onStart: vi.fn() };
  const onClose = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(playStart.onStart).mockClear();
    onClose.mockClear();
    vi.mocked(playSound).mockClear();
    vi.mocked(playLayeredSound).mockClear();
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <ReflectionTutorial open playStart={playStart} onClose={onClose} />,
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
        pressNextThroughIntro();
      });

      test("数字のルールを示し、光を出す外周ヒントに印を付けること", () => {
        const message = getMessage();
        const currentRule = screen
          .getByRole("list", { name: "ルール" })
          .querySelector("[aria-current='step']")?.textContent;
        const cues = getCueKinds(getClue("左2行"));

        expect(message).toContain("通るマスの数");
        expect(currentRule).toBe("数字");
        expect(cues).toEqual(["mark"]);
      });

      test("画面全体を覆い、印を付けた外周ヒントだけを覆いから抜くこと", () => {
        const scrim = getFocusScrim();
        const spotlit = Array.from(
          getBoard().parentElement?.querySelectorAll<HTMLElement>(
            "button:has([data-tutorial-spotlight])",
          ) ?? [],
          (button) => button.getAttribute("aria-label") ?? "",
        );

        expect(scrim).not.toBeNull();
        expect(spotlit).toHaveLength(1);
        expect(spotlit[0]).toMatch(/^左2行 /);
      });

      test("印の無い外周ヒントを押すと、押した所に何も出さず、印の線を濃くし直して光を出さないこと", () => {
        fireEvent.click(getClue("上1列"));
        const markCues = getCueKinds(getClue("左2行"));
        const cues = getCueKinds(getClue("上1列"));
        const pressed = getClue("上1列").getAttribute("aria-pressed");
        const message = getMessage();

        expect(markCues).toEqual(["mark", "recall"]);
        expect(cues).toEqual([]);
        expect(pressed).toBe("false");
        expect(message).toContain("通るマスの数");
      });

      test("印の外周ヒントを押すと光を出し、光が出た先の外周ヒントに印を移して、出した光の外周ヒントと光の通るマスを覆いから抜いたまま見せること", () => {
        fireEvent.click(getClue("左2行"));
        const pressed = getClue("左2行").getAttribute("aria-pressed");
        const message = getMessage();
        const currentRule = screen
          .getByRole("list", { name: "ルール" })
          .querySelector("[aria-current='step']")?.textContent;
        const exitCues = getCueKinds(getClue("右2行"));
        const entrySpotlit = isSpotlit(getClue("左2行"));
        const litRowSpotlit = [1, 2, 3, 4, 5].map((column) =>
          isSpotlit(getCell(2, column)),
        );

        expect(pressed).toBe("true");
        expect(message).toContain("出た先にも同じ数字があります");
        expect(currentRule).toBe("数字");
        expect(exitCues).toEqual(["mark"]);
        expect(entrySpotlit).toBe(true);
        expect(litRowSpotlit).toEqual([true, true, true, true, true]);
      });

      test("光が出た先の外周ヒントを押すとそこから光を出し、ブラックホールのルールと、選ぶ種類の印を示して、選ぶ種類と置く場所を決める外周ヒントだけを覆いから抜くこと", () => {
        pressAll(numberPresses);
        const pressed = getClue("右2行").getAttribute("aria-pressed");
        const message = getMessage();
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const reasonCues = getCueKinds(getClue("上3列"));
        const stockSpotlit = isSpotlit(getStock("ブラックホール"));
        const reasonSpotlit = isSpotlit(getClue("上3列"));
        const litRowSpotlit = [1, 2, 3, 4, 5].map((column) =>
          isSpotlit(getCell(2, column)),
        );
        const otherCellSpotlit = isSpotlit(getCell(3, 3));

        expect(pressed).toBe("true");
        expect(message).toContain("ブラックホールは光を吸い込みます");
        expect(stockCues).toEqual(["mark"]);
        expect(reasonCues).toEqual([]);
        expect(stockSpotlit).toBe(true);
        expect(reasonSpotlit).toBe(true);
        expect(litRowSpotlit).toEqual([false, false, false, false, false]);
        expect(otherCellSpotlit).toBe(false);
      });

      test("種類を選ぶと、置くマスに印を移し、置く場所を決める外周ヒントの光を出すこと", () => {
        pressAll([...numberPresses, { stock: "ブラックホール" }]);
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const cellCues = getCueKinds(getCell(3, 3));
        const pressed = getClue("上3列").getAttribute("aria-pressed");

        expect(stockCues).toEqual([]);
        expect(cellCues).toEqual(["mark"]);
        expect(pressed).toBe("true");
      });

      test("印の無いマスを押すと、押したマスに何も出さず、印の線を濃くし直して置かないこと", () => {
        pressAll([...numberPresses, { stock: "ブラックホール" }]);
        fireEvent.click(getCell(1, 3));
        const markCues = getCueKinds(getCell(3, 3));
        const label = getCell(1, 3).getAttribute("aria-label");
        const cues = getCueKinds(getCell(1, 3));

        expect(markCues).toEqual(["mark", "recall"]);
        expect(label).toBe("1行3列 空き");
        expect(cues).toEqual([]);
      });

      test("本番と同じく、種類を選んでも音を鳴らさず、置くと置いた音を鳴らすこと", () => {
        pressAll([...numberPresses, { stock: "ブラックホール" }]);
        const callsAfterSelect = vi.mocked(playSound).mock.calls.length;
        press({ cell: [3, 3] });
        const callsAfterPlace = vi.mocked(playSound).mock.calls.length;

        expect(callsAfterSelect).toBe(0);
        expect(callsAfterPlace).toBe(1);
      });

      test("印のマスに置くと、そのマスに応え、外周ヒントが合ったことを光と地で返して、次の手順へ進むこと", () => {
        pressAll([
          ...numberPresses,
          { stock: "ブラックホール" },
          { cell: [3, 3] },
        ]);
        const label = getCell(3, 3).getAttribute("aria-label");
        const cues = getCueKinds(getCell(3, 3));
        const clue = getClue("上3列");
        const message = getMessage();

        expect(label).toBe("3行3列 ブラックホール");
        expect(cues).toEqual(["acknowledgement"]);
        expect(clue.getAttribute("data-matched")).toBe("true");
        expect(clue.getAttribute("aria-pressed")).toBe("true");
        expect(message).toContain("斜め鏡は光を直角に曲げます");
      });
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        pressNextThroughIntro();
        pressAll(guidedPresses);
      });

      test("残りを置かせる一言を出し、画面全体の覆いを消して、考えている間は印を付けないこと", () => {
        advanceTime(idleHintDelayMs - 1);
        const message = getMessage();
        const scrim = getFocusScrim();
        const cues = getCueKinds(getStock("右下がりの鏡"));

        expect(message).toContain("すべての数字が緑になれば完成です");
        expect(scrim).toBeNull();
        expect(cues).toEqual([]);
      });

      test("長く手が止まると、次に選ぶ種類だけに印を付けること", () => {
        advanceTime(idleHintDelayMs);
        const stockCues = getCueKinds(getStock("右下がりの鏡"));
        const reasonCues = getCueKinds(getClue("左3行"));

        expect(stockCues).toEqual(["mark"]);
        expect(reasonCues).toEqual([]);
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

      test("残りを置いて解くと、完成演出の後に、ゲームのホームで開いているレベルを遊ぶ操作を出すこと", async () => {
        pressAll(freePresses);
        const message = getMessage();
        await advanceTimeInSlices(clearEnoughMs);
        fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

        expect(message).toContain("完成です");
        expect(playLayeredSound).toHaveBeenCalledOnce();
        expect(playStart.onStart).toHaveBeenCalledOnce();
      });
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      // 場面の動きを終えないままにして、押したときに今の段の動きを終えて見せることを確かめる。
      // 光路は SVG に描くので、SVG の要素も動かせる環境にする。
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: vi.fn(
          () =>
            ({
              cancel: vi.fn(),
              finished: new Promise<void>(() => {}),
            }) as unknown as Animation,
        ),
      });
      render(
        <ReflectionTutorial open playStart={playStart} onClose={onClose} />,
      );
    });

    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    test("ゴールの全光路を伸ばす間に盤面を押すと、手順へ飛ばずに、全光路を出したゴールの盤面で次へを待つこと", async () => {
      await advanceTimeInSlices(800);
      fireEvent.pointerDown(getBoard());
      const caption = screen.queryByText("この盤面がゴールです");
      const nextButton = screen.queryByRole("button", { name: "次へ" });
      const lightPaths = screen
        .getByRole("main")
        .querySelectorAll("[data-clear-light-step]");
      const placed = listPlacedCellLabels();

      expect(caption).not.toBeNull();
      expect(nextButton).not.toBeNull();
      expect(lightPaths.length).toBeGreaterThan(0);
      expect(placed).toHaveLength(6);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      installAnimate();
      render(
        <ReflectionTutorial open playStart={playStart} onClose={onClose} />,
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
      expect(cues).toEqual(["mark"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(<ReflectionTutorial open onClose={onClose} />);
      pressNextThroughIntro();
      pressAll(guidedPresses);
    });

    test("解き終えると、プレイ中の盤面も同じルールだと伝えること", async () => {
      pressAll(freePresses);
      await advanceTimeInSlices(clearEnoughMs);
      const detail = screen.queryByText("プレイ中の盤面も同じルールです");

      expect(detail).not.toBeNull();
    });

    test("解き終えると、プレイに戻る操作を出すこと", async () => {
      pressAll(freePresses);
      await advanceTimeInSlices(clearEnoughMs);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

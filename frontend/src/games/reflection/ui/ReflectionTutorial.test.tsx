import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { reflectionTutorial } from "@/games/reflection/tutorial/tutorial";
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

/** 手順ごとに押す所。ストックは種類の名前、マスは行と列。 */
const guidedPresses: readonly (readonly Press[])[] = [
  [{ stock: "ブラックホール" }, { cell: [4, 5] }],
  [{ cell: [2, 1] }],
  [{ stock: "右下がりの鏡" }, { cell: [1, 2] }],
  [{ stock: "反射鏡" }, { cell: [3, 4] }],
  [{ stock: "横の両面鏡" }, { cell: [1, 5] }],
  [{ stock: "右上がりの鏡" }, { cell: [3, 3] }],
];

/** 手を離した後に置く所。 */
const freePresses: readonly Press[] = [
  { stock: "ブラックホール" },
  { cell: [4, 2] },
  { stock: "右下がりの鏡" },
  { cell: [5, 2] },
];

/** 手順を終えてから次の手順の一言と印に替わるまでに十分な間。 */
const nextStepEnoughMs = 1500;

/** 入口の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 3000;

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

/** 印（`mark`）・指（`pointer`）・印の押し直し（`recall`）・応え（`acknowledgement`）のうち、重ねているもの。 */
function getCueKinds(element: HTMLElement): string[] {
  return Array.from(
    element.querySelectorAll<HTMLElement>("[data-tutorial-cue]"),
    (cue) => cue.dataset.tutorialCue ?? "",
  );
}

/** 盤面の覆いから抜いて、元の明るさで見せているか。 */
function isSpotlit(element: HTMLElement): boolean {
  return element.querySelector("[data-tutorial-spotlight]") !== null;
}

/** 盤面の中だけを薄く覆う覆い。 */
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

/** 最初の `count` 個の手順を、手順ごとに置いた結果を見せ終えるまで待ちながら終える。 */
function finishSteps(count: number): void {
  for (const presses of guidedPresses.slice(0, count)) {
    pressAll(presses);
    advanceTime(nextStepEnoughMs);
  }
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: REFLECTION_DISPLAY_NAME });
}

function queryStartButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "はじめる" });
}

function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

/** 入口の「はじめる」を押し、始めの盤面へ替える場面を終えて、最初の手順から始める。 */
async function pressStart(): Promise<void> {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  await advanceTimeInSlices(introEnoughMs);
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

/** 完成のときに並べる、覚えたルール。 */
function listRecap(): (string | null)[] {
  return within(within(getScreen()).getByRole("list", { name: "覚えたルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

/** 一言。盤面の下の、一言を読み上げる欄にある。 */
function getMessage(): string {
  const live = document.querySelector("[aria-live='polite']");
  return live?.textContent ?? "";
}

describe("ReflectionTutorial", () => {
  const playStart: TutorialPlayStart = { difficulty: "1", onStart: vi.fn() };
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

    describe("入口", () => {
      test("何をするパズルかと全光路を伸ばしたゴールの盤面を見せ進み具合を空にしておくこと", async () => {
        await advanceTimeInSlices(introEnoughMs);
        const purpose = screen.queryByText(/数字と記号に合わせ光が進むように/);
        const caption = screen.queryByText(
          reflectionTutorial.intro.goalCaption,
        );
        const placed = listPlacedCellLabels();
        const lightPaths = screen
          .getByRole("main")
          .querySelectorAll("[data-clear-light-step]");

        expect(purpose).not.toBeNull();
        expect(caption).not.toBeNull();
        expect(placed).toHaveLength(8);
        expect(lightPaths.length).toBeGreaterThan(0);
        expect(getProgressValue()).toBe("0");
      });

      test("はじめるでピースを1つも置いていない始めの盤面に替えること", async () => {
        await pressStart();
        const placed = listPlacedCellLabels();
        const blackHole = getStock("ブラックホール").getAttribute("aria-label");

        expect(placed).toEqual([]);
        expect(blackHole).toBe("ブラックホール 残り3");
        expect(queryStartButton()).toBeNull();
      });
    });

    describe("手を引く間", () => {
      beforeEach(async () => {
        await pressStart();
      });

      test("操作を教える手順は置くピースを指で指し置くマスを輪郭で示して盤面を覆わないこと", () => {
        const message = getMessage();
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const cellCues = getCueKinds(getCell(4, 5));

        expect(message).toContain("置くピースをタップして選択します");
        expect(stockCues).toEqual(["mark", "pointer"]);
        expect(cellCues).toEqual(["mark"]);
        expect(getFocusScrim()).toBeNull();
      });

      test("印の無い所を押すと押した所に何も出さず印の線を濃くし直して置かないこと", () => {
        fireEvent.click(getStock("反射鏡"));
        const markCues = getCueKinds(getStock("ブラックホール"));
        const cues = getCueKinds(getStock("反射鏡"));
        const pressed = getStock("反射鏡").getAttribute("aria-pressed");

        expect(markCues).toEqual(["mark", "recall", "pointer"]);
        expect(cues).toEqual([]);
        expect(pressed).toBe("false");
      });

      test("ピースを選ぶと置く操作の一言に替え置くマスは指で隠さず輪郭だけで示すこと", () => {
        press({ stock: "ブラックホール" });
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const cellCues = getCueKinds(getCell(4, 5));
        const message = getMessage();

        expect(stockCues).toEqual([]);
        expect(cellCues).toEqual(["mark"]);
        expect(message).toContain("印のマスをタップして置きます");
      });

      test("本番と同じく種類を選んでも音を鳴らさず置くと置いた音を鳴らすこと", () => {
        press({ stock: "ブラックホール" });
        const callsAfterSelect = vi.mocked(playSound).mock.calls.length;
        press({ cell: [4, 5] });
        const callsAfterPlace = vi.mocked(playSound).mock.calls.length;

        expect(callsAfterSelect).toBe(0);
        expect(callsAfterPlace).toBe(1);
      });

      test("印のマスに置くとそのマスに応え置いた結果の光と緑の地を見せ進み具合を進めること", () => {
        pressAll([{ stock: "ブラックホール" }, { cell: [4, 5] }]);
        const cues = getCueKinds(getCell(4, 5));
        const clue = getClue("下5列");

        expect(cues).toEqual(["acknowledgement"]);
        expect(clue.getAttribute("data-matched")).toBe("true");
        expect(clue.getAttribute("aria-pressed")).toBe("true");
        expect(getProgressValue()).toBe("13");
      });

      test("置いた結果を見せた後に数字のルールの一言と決め手の光に替え決め手と光の通るマスだけを覆いから抜くこと", () => {
        finishSteps(1);
        const message = getMessage();
        const reasonClue = getClue("下1列");
        const litRowSpotlit = [1, 2, 3, 4, 5].map((row) =>
          isSpotlit(getCell(row, 1)),
        );
        const otherCellSpotlit = isSpotlit(getCell(3, 3));

        expect(message).toContain("光が通るマスの数が");
        expect(reasonClue.getAttribute("aria-pressed")).toBe("true");
        expect(isSpotlit(reasonClue)).toBe(true);
        expect(litRowSpotlit).toEqual([true, true, true, true, true]);
        expect(otherCellSpotlit).toBe(false);
        expect(getFocusScrim()).not.toBeNull();
      });

      test("置くマスを選ばせる手順ではマスに印を付けないこと", () => {
        finishSteps(1);
        const cues = [1, 2, 3, 4, 5].flatMap((row) =>
          getCueKinds(getCell(row, 1)),
        );

        expect(cues).toEqual([]);
      });

      test("違うマスに置くと光が今どう進むかと直し方を言い置いたピースを直す所として示すこと", () => {
        finishSteps(1);
        press({ cell: [3, 1] });
        const message = getMessage();
        const cues = getCueKinds(getCell(3, 1));

        expect(message).toContain("光が3マス目で止まります");
        expect(message).toContain("別のマスをタップします");
        expect(cues).toEqual(["mark"]);
      });

      test("違うマスに置いたピースを正しいマスへ動かすと次の手順へ進むこと", () => {
        finishSteps(1);
        pressAll([{ cell: [3, 1] }, { cell: [3, 1] }, { cell: [2, 1] }]);
        advanceTime(nextStepEnoughMs);
        const message = getMessage();

        expect(message).toContain("斜め鏡は光を直角に曲げます");
      });

      test("前の手順で置いたピースは押しても選べないこと", () => {
        finishSteps(2);
        press({ cell: [4, 5] });
        const pressed = getCell(4, 5).getAttribute("aria-pressed");

        expect(pressed).not.toBe("true");
      });

      test("手を引く間はヒントを出さないこと", () => {
        finishSteps(3);

        expect(queryHintButton()).toBeNull();
      });
    });

    describe("手を離した後", () => {
      beforeEach(async () => {
        await pressStart();
        finishSteps(guidedPresses.length);
      });

      test("残りを置かせる一言を出し盤面の覆いを消して求められるまで印を付けないこと", () => {
        advanceTime(60_000);
        const message = getMessage();
        const cues = getCueKinds(getStock("ブラックホール"));

        expect(message).toContain(reflectionTutorial.freePlay.headline);
        expect(getFocusScrim()).toBeNull();
        expect(cues).toEqual([]);
        expect(queryHintButton()).not.toBeNull();
      });

      test("ヒントを押すと残りのピースに印を付け決め手の数字と光の通るマスを覆いから抜くこと", () => {
        fireEvent.click(queryHintButton() as HTMLElement);
        const stockCues = getCueKinds(getStock("ブラックホール"));
        const reasonClue = getClue("左4行");
        const message = getMessage();

        expect(stockCues).toEqual(["mark"]);
        expect(isSpotlit(reasonClue)).toBe(true);
        expect(reasonClue.getAttribute("aria-pressed")).toBe("true");
        expect(message).toContain("光を止めます");
        expect(queryHintButton()).toBeNull();
      });

      test("次の手で手がかりを消し1回で答えのマスまでは見せないこと", () => {
        fireEvent.click(queryHintButton() as HTMLElement);
        press({ stock: "ブラックホール" });
        const cellCues = getCueKinds(getCell(4, 2));

        expect(cellCues).toEqual([]);
        expect(getFocusScrim()).toBeNull();
        expect(queryHintButton()).not.toBeNull();
      });

      test("手持ちをすべて置いても揃わなければ緑でない数字があることを言うこと", () => {
        pressAll([
          { stock: "ブラックホール" },
          { cell: [4, 4] },
          { stock: "右下がりの鏡" },
          { cell: [5, 2] },
        ]);
        const message = getMessage();

        expect(message).toContain("緑でない数字があります");
      });

      test("本番と同じく数字キーでストックの種類を選びEscで選んだものを解除すること", () => {
        fireEvent.keyDown(window, { key: "2" });
        const selected = getStock("右下がりの鏡").getAttribute("aria-pressed");
        fireEvent.keyDown(window, { key: "Escape" });
        const released = getStock("右下がりの鏡").getAttribute("aria-pressed");

        expect(selected).toBe("true");
        expect(released).toBe("false");
        expect(onClose).not.toHaveBeenCalled();
      });

      test("残りを置いて解くと完成演出の後に覚えたルールを並べゲームのホームで開いているレベルを遊ぶ操作を出すこと", async () => {
        pressAll(freePresses);
        const message = getMessage();
        await advanceTimeInSlices(clearEnoughMs);
        const recap = listRecap();
        const progress = getProgressValue();
        fireEvent.click(screen.getByRole("button", { name: "レベル 1を遊ぶ" }));

        expect(message).toContain("完成です");
        expect(recap).toEqual(
          reflectionTutorial.rules.map(({ label }) => label),
        );
        expect(progress).toBe("100");
        expect(playLayeredSound).toHaveBeenCalledOnce();
        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("解いた後にもう一度を押すと入口を通さずに始めの盤面で最初の手順から始めること", async () => {
        pressAll(freePresses);
        await advanceTimeInSlices(clearEnoughMs);
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "もう一度" }),
        );
        const message = getMessage();
        const placed = listPlacedCellLabels();
        const cues = getCueKinds(getStock("ブラックホール"));

        expect(queryStartButton()).toBeNull();
        expect(message).toContain("置くピースをタップして選択します");
        expect(placed).toEqual([]);
        expect(cues).toEqual(["mark", "pointer"]);
        expect(getProgressValue()).toBe("0");
      });
    });
  });

  describe("入口の動きを見せる場合", () => {
    beforeEach(() => {
      // 場面の動きを終えないままにして、動きの途中で押しても入口に留まることを確かめる。
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

    test("ゴールの全光路を伸ばす間に盤面を押しても手順へ飛ばずにはじめるを待つこと", async () => {
      await advanceTimeInSlices(800);
      fireEvent.pointerDown(getBoard());
      const caption = screen.queryByText(reflectionTutorial.intro.goalCaption);
      const placed = listPlacedCellLabels();

      expect(caption).not.toBeNull();
      expect(queryStartButton()).not.toBeNull();
      expect(placed).toHaveLength(8);
    });

    test("はじめるを押すとゴールのピースを消し終えるまでは最初の手順の印を出さないこと", async () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
      await advanceTimeInSlices(500);
      const cues = getCueKinds(getStock("ブラックホール"));

      expect(cues).toEqual([]);
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

    test("ゴールの盤面を見せはじめるを押すと始めの盤面で最初の手順を始めること", async () => {
      await advanceTimeInSlices(2000);
      const goalCaption = screen.queryByText(
        reflectionTutorial.intro.goalCaption,
      );
      await pressStart();
      const message = getMessage();
      const placed = listPlacedCellLabels();
      const cues = getCueKinds(getStock("ブラックホール"));

      expect(goalCaption).not.toBeNull();
      expect(message).toContain("置くピースをタップして選択します");
      expect(placed).toEqual([]);
      expect(cues).toEqual(["mark", "pointer"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(async () => {
      installAnimate();
      render(<ReflectionTutorial open onClose={onClose} />);
      await pressStart();
      finishSteps(guidedPresses.length);
    });

    test("解き終えるとプレイ中の盤面と同じルールだと伝えること", async () => {
      pressAll(freePresses);
      await advanceTimeInSlices(clearEnoughMs);
      const detail = screen.queryByText("プレイ中の盤面と同じルールです");

      expect(detail).not.toBeNull();
    });

    test("解き終えるとプレイに戻る操作を出すこと", async () => {
      pressAll(freePresses);
      await advanceTimeInSlices(clearEnoughMs);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import {
  NANPURE_TUTORIAL_PROGRESS_STEP_COUNT,
  nanpureTutorial,
} from "@/games/nanpure/tutorial/tutorial";
import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";
import type { TutorialMessage } from "@/games/tutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { intro, rules, steps, freePlay, completion } = nanpureTutorial;

type CellEntry = readonly [row: number, column: number, digit: number];

const stepEntries: readonly CellEntry[] = [
  [3, 5, 8],
  [3, 3, 4],
  [6, 6, 4],
  [5, 3, 2],
  [6, 8, 2],
];

const remainingEntries: readonly CellEntry[] = [
  [1, 4, 7],
  [2, 2, 9],
  [2, 3, 1],
  [5, 7, 6],
  [5, 8, 4],
  [6, 4, 8],
  [6, 9, 7],
  [8, 2, 7],
  [8, 3, 3],
  [8, 8, 5],
  [9, 3, 6],
  [9, 7, 4],
  [9, 8, 3],
];

const nextStepCueDelayMs = 900;

/**
 * 手を離した後に止まっていても、手がかりを勝手に出さないことを確かめる長さ。
 * 盤面を覆っている間は覆いが毎フレーム盤面を追うので、偽のタイマーで進める長さを抑える。
 */
const longIdleMs = 3_000;

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

/** 鳴らした効果音の音声ファイル名。 */
function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

/** 81マスの名前を毎回すべて計算しないよう、名前の頭で引く。 */
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

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: NANPURE_DISPLAY_NAME });
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

function queryStartButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "はじめる" });
}

/** 入口の「はじめる」を押し、始めの盤面へ替える場面を終える。 */
function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(0);
}

/** 「ヒント」の操作。マスの読み上げ名にも「初期ヒント」が含まれるので、名前の完全一致で探す。 */
function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

function pressHint(): void {
  fireEvent.click(within(getScreen()).getByRole("button", { name: "ヒント" }));
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
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

/** 盤面のマスのうち、`selector` に当たる要素を中に持つマスの番号（0始まり）。 */
function getCellIndicesContaining(selector: string): number[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('button[aria-label*="行"]'),
  ).flatMap((cell) => {
    const [, row, column] =
      cell.getAttribute("aria-label")?.match(/^(\d)行(\d)列/) ?? [];
    return cell.querySelector(selector)
      ? [getCellIndex(Number(row), Number(column))]
      : [];
  });
}

function getCuedCellIndices(kind: "hint" | "fitted"): number[] {
  return getCellIndicesContaining(`[data-cell-cue="${kind}"]`);
}

function getRecalledCellIndices(): number[] {
  return getCellIndicesContaining('[data-tutorial-cue="recall"]');
}

/** 指を添えているマスの番号。マスには指を添えないので、いつも空になる。 */
function getPointedCellIndices(): number[] {
  return getCellIndicesContaining('[data-tutorial-cue="pointer"]');
}

/** 指が無ければ `null`。 */
function getDigitPointerPlacement(digit: number): string | null {
  return (
    getDigitButton(digit)
      .querySelector('[data-tutorial-cue="pointer"]')
      ?.getAttribute("data-placement") ?? null
  );
}

function getSpotlitCellIndices(): number[] {
  return getCellIndicesContaining("[data-tutorial-spotlight]");
}

function getSpotlitUnits(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-spotlit-unit]"),
  ).map((element) => element.dataset.spotlitUnit ?? "");
}

function isScrimShown(): boolean {
  return document.querySelector("[data-tutorial-focus-scrim]") !== null;
}

function querySpotlightArea(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-tutorial-spotlight-area]");
}

/** 盤面の中で、ルールに当たったときの赤を使っているか。 */
function usesRuleViolationColor(): boolean {
  return (
    document.querySelector(
      'main [class*="destructive"], main [class*="rose-"]',
    ) !== null
  );
}

function getRecapTexts(): string[] {
  return within(within(getScreen()).getByRole("list", { name: "覚えたルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("NanpureTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onStartPlay: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    onStartPlay = vi.fn<() => void>();
    playStart = { difficulty: "3", onStart: onStartPlay };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <NanpureTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
      pressStart();
    });

    test("9×9の盤面と数字のボタンを出し、操作の一言と、数字を入れるマスの印を示すこと", () => {
      const cells = document.querySelectorAll('button[aria-label*="行"]');
      const digitPad = screen.getByRole("group", { name: "数字入力" });
      const headline = queryMessage(steps[0]?.message);
      const detail = queryShownText(steps[0]?.message.detail ?? "");
      const hinted = getCuedCellIndices("hint");
      const digitDisabled = getDigitButton(8).hasAttribute("disabled");
      const progress = getProgressValue();

      expect(cells).toHaveLength(81);
      expect(within(digitPad).getAllByRole("button")).toHaveLength(9);
      expect(headline).not.toBeNull();
      expect(detail).not.toBeNull();
      expect(hinted).toEqual([getCellIndex(3, 5)]);
      expect(digitDisabled).toBe(true);
      expect(progress).toBe("0");
    });

    test("操作を教える手順では、決め手が無いので盤面を覆わず、印のマスにも数字のボタンにも指を添えないこと", () => {
      const scrimShown = isScrimShown();
      const spotlightArea = querySpotlightArea();
      const spotlitCells = getSpotlitCellIndices();
      const pointed = getPointedCellIndices();
      const digitPointer = getDigitPointerPlacement(8);

      expect(scrimShown).toBe(false);
      expect(spotlightArea).toBeNull();
      expect(spotlitCells).toEqual([]);
      expect(pointed).toEqual([]);
      expect(digitPointer).toBeNull();
    });

    test("手を引いている間は、手順を進めても、ヒントを出さないこと", () => {
      finishSteps(1);

      const hintButton = queryHintButton();

      expect(hintButton).toBeNull();
    });

    test("印のマスを選ぶと、印を残し、押す数字のボタンの中に指を添え、盤面を覆わないこと", () => {
      fireEvent.click(getCell(3, 5));

      const pressed = getCell(3, 5).getAttribute("aria-pressed");
      const hinted = getCuedCellIndices("hint");
      const pointed = getPointedCellIndices();
      const digitPointer = getDigitPointerPlacement(8);
      const scrimShown = isScrimShown();

      expect(pressed).toBe("true");
      expect(hinted).toEqual([getCellIndex(3, 5)]);
      expect(pointed).toEqual([]);
      expect(digitPointer).toBe("center");
      expect(scrimShown).toBe(false);
    });

    test("印の無いマスを押すと、選ばずに、押したマスではなく印のマスの印を、赤を使わずに濃くし直すこと", () => {
      fireEvent.click(getCell(1, 1));

      const pressed = getCell(1, 1).getAttribute("aria-pressed");
      const recalled = getRecalledCellIndices();
      const hinted = getCuedCellIndices("hint");
      const violationColored = usesRuleViolationColor();

      expect(pressed).toBe("false");
      expect(recalled).toEqual([getCellIndex(3, 5)]);
      expect(hinted).toEqual([getCellIndex(3, 5)]);
      expect(violationColored).toBe(false);
    });

    test("印の無いマスを続けて押すたびに、印のマスの印を濃くし直すこと", () => {
      fireEvent.click(getCell(1, 1));
      const firstRecall = document.querySelector(
        '[data-tutorial-cue="recall"]',
      );
      fireEvent.click(getCell(2, 2));

      const secondRecall = document.querySelector(
        '[data-tutorial-cue="recall"]',
      );

      expect(firstRecall).not.toBeNull();
      expect(secondRecall).not.toBeNull();
      expect(secondRecall).not.toBe(firstRecall);
    });

    test("印のマスを選んでから印の無いマスを押すと、印のマスと押す数字の印を濃くし直すこと", () => {
      fireEvent.click(getCell(3, 5));
      fireEvent.click(getCell(1, 1));

      const pressed = getCell(3, 5).getAttribute("aria-pressed");
      const recalled = getRecalledCellIndices();
      const digitRecall = getDigitButton(8).querySelector(
        '[data-tutorial-cue="recall"]',
      );

      expect(pressed).toBe("true");
      expect(recalled).toEqual([getCellIndex(3, 5)]);
      expect(digitRecall).not.toBeNull();
    });

    test("印のマスを選ぶと、濃くし直しを終えること", () => {
      fireEvent.click(getCell(1, 1));
      fireEvent.click(getCell(3, 5));

      const recalled = getRecalledCellIndices();

      expect(recalled).toEqual([]);
    });

    test("印のとおりに数字を入れると、濃くし直しを終えること", () => {
      fireEvent.click(getCell(3, 5));
      fireEvent.click(getCell(1, 1));
      fireEvent.click(getDigitButton(8));

      const recalled = getRecalledCellIndices();
      const digitRecall = document.querySelector(
        'fieldset [data-tutorial-cue="recall"]',
      );

      expect(recalled).toEqual([]);
      expect(digitRecall).toBeNull();
    });

    test("操作の手順で印の無い数字を押すと、盤面を変えず音も鳴らさず、印のマスと押す数字の印を濃くし直すこと", () => {
      fireEvent.click(getCell(3, 5));
      fireEvent.click(getDigitButton(1));

      const label = getCellLabel(3, 5);
      const played = getPlayedSoundNames();
      const recalled = getRecalledCellIndices();
      const digitRecall = getDigitButton(8).querySelector(
        '[data-tutorial-cue="recall"]',
      );

      expect(label).toBe("3行5列、空き");
      expect(played).toEqual([]);
      expect(recalled).toEqual([getCellIndex(3, 5)]);
      expect(digitRecall).not.toBeNull();
    });

    test("印のマスに数字を入れると、そのマスに応え、進み具合を1マス分進め、行のルールと、盤面を覆って決め手の行を抜き、次のマスに指の無い印を付けて示すこと", () => {
      finishSteps(1);

      const label = getCellLabel(3, 5);
      const fitted = getCuedCellIndices("fitted");
      const progress = getProgressValue();
      const headline = queryMessage(steps[1]?.message);
      const scrimShown = isScrimShown();
      const spotlitUnits = getSpotlitUnits();
      const hinted = getCuedCellIndices("hint");
      const pointed = getPointedCellIndices();

      expect(label).toBe("3行5列、8");
      expect(fitted).toEqual([getCellIndex(3, 5)]);
      expect(progress).toBe(
        String(Math.round(100 / NANPURE_TUTORIAL_PROGRESS_STEP_COUNT)),
      );
      expect(headline).not.toBeNull();
      expect(scrimShown).toBe(true);
      expect(spotlitUnits).toEqual(["row:2"]);
      expect(hinted).toEqual([getCellIndex(3, 3)]);
      expect(pointed).toEqual([]);
    });

    test("決め手を見せる間は、盤面だけを覆う範囲にし、数字のボタンは覆う範囲に入れないこと", () => {
      finishSteps(1);

      const spotlightArea = querySpotlightArea();
      const digitPad = screen.getByRole("group", { name: "数字入力" });
      const boardCovered = spotlightArea?.contains(getCell(3, 3)) ?? false;
      const digitPadCovered = spotlightArea?.contains(digitPad) ?? false;

      expect(boardCovered).toBe(true);
      expect(digitPadCovered).toBe(false);
    });

    test("行の手順で印のマスを選ぶと、マスにもどの数字にも印も指も付けないこと", () => {
      finishSteps(1);
      fireEvent.click(getCell(3, 3));

      const pointed = getPointedCellIndices();
      const digitMarks = document.querySelectorAll(
        'fieldset [data-tutorial-cue="mark"]',
      );
      const digitPointers = document.querySelectorAll(
        'fieldset [data-tutorial-cue="pointer"]',
      );

      expect(pointed).toEqual([]);
      expect(digitMarks).toHaveLength(0);
      expect(digitPointers).toHaveLength(0);
    });

    test("行で重なる数字を入れると、重なりを赤く示して一言で言い、正しい数字に入れ替えると次へ進むこと", () => {
      finishSteps(1);
      enter([3, 3, 9]);
      const invalid = getCell(3, 3).getAttribute("aria-invalid");
      const violation = queryShownText("この行にはもう9があります");
      fireEvent.click(getDigitButton(4));
      advanceTime(nextStepCueDelayMs);

      const headline = queryMessage(steps[2]?.message);

      expect(invalid).toBe("true");
      expect(violation).not.toBeNull();
      expect(headline).not.toBeNull();
    });

    test("決め手の列の外のマスと重なる数字を入れると、重なったマスも覆いから抜くこと", () => {
      finishSteps(2);
      enter([6, 6, 9]);

      const spotlitCells = getSpotlitCellIndices();
      const spotlitUnits = getSpotlitUnits();

      expect(spotlitCells).toEqual([getCellIndex(6, 3)]);
      expect(spotlitUnits).toEqual(["column:5"]);
    });

    test("決め手のある手順を終えると、入れたマスと決め手を、終えた手順の一言のまま少し残して見せてから、次の印と決め手と一言に替えること", () => {
      finishSteps(2);
      const fittedAfterMove = getCuedCellIndices("fitted");
      const spotlitUnitsAfterMove = getSpotlitUnits();
      const hintedAfterMove = getCuedCellIndices("hint");
      const headlineAfterMove = queryMessage(steps[1]?.message);
      advanceTime(nextStepCueDelayMs);

      const spotlitUnits = getSpotlitUnits();
      const hinted = getCuedCellIndices("hint");
      const headline = queryMessage(steps[2]?.message);

      expect(fittedAfterMove).toEqual([getCellIndex(3, 3)]);
      expect(spotlitUnitsAfterMove).toEqual(["row:2"]);
      expect(hintedAfterMove).toEqual([]);
      expect(headlineAfterMove).not.toBeNull();
      expect(spotlitUnits).toEqual(["column:5"]);
      expect(hinted).toEqual([getCellIndex(6, 6)]);
      expect(headline).not.toBeNull();
    });

    test("印のマスに数字を入れると、本番と同じ数字を入れる音を鳴らすこと", () => {
      finishSteps(1);

      const played = getPlayedSoundNames();

      expect(played).toEqual(["digit-entered.flac"]);
    });

    test("ルールに当たる数字を入れると、本番と同じミスの音を鳴らすこと", () => {
      finishSteps(1);
      enter([3, 3, 9]);

      const played = getPlayedSoundNames();

      expect(played).toEqual(["digit-entered.flac", "mistake-entered.flac"]);
    });

    test("マスを選ぶだけの手と、印の無いマスを押した手には、音を鳴らさないこと", () => {
      fireEvent.click(getCell(3, 5));
      fireEvent.click(getCell(1, 1));

      const played = getPlayedSoundNames();

      expect(played).toEqual([]);
    });

    test("ブロックのルールでは、太線で区切ったブロックを覆いから抜いて示すこと", () => {
      finishSteps(3);
      advanceTime(nextStepCueDelayMs);

      const headline = queryMessage(steps[3]?.message);
      const spotlitUnits = getSpotlitUnits();

      expect(headline).not.toBeNull();
      expect(spotlitUnits).toEqual(["block:3"]);
    });

    describe("置き場所を探す手順", () => {
      beforeEach(() => {
        finishSteps(4);
        advanceTime(nextStepCueDelayMs);
      });

      test("マスに印を付けず、ブロックと、ブロックの空きマスを消している2のマスを覆いから抜き、2の入るマスを探させる一言を見せること", () => {
        const hinted = getCuedCellIndices("hint");
        const pointers = document.querySelectorAll(
          '[data-tutorial-cue="pointer"]',
        );
        const spotlitUnits = getSpotlitUnits();
        const spotlitCells = getSpotlitCellIndices();
        const headline = queryMessage(steps[4]?.message);
        const detail = queryShownText(steps[4]?.message.detail ?? "");

        expect(hinted).toEqual([]);
        expect(pointers).toHaveLength(0);
        expect(spotlitUnits).toEqual(["block:5"]);
        expect(spotlitCells).toEqual([
          getCellIndex(2, 7),
          getCellIndex(5, 3),
          getCellIndex(9, 9),
        ]);
        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
      });

      test("ブロックの外のマスを押すと、選ばずに、一言を替えないこと", () => {
        fireEvent.click(getCell(1, 4));

        const pressed = getCell(1, 4).getAttribute("aria-pressed");
        const headline = queryMessage(steps[4]?.message);

        expect(pressed).toBe("false");
        expect(headline).not.toBeNull();
      });

      test("2の入らないマスを選ぶと、どの行・列にもう2があるかを言い、どの数字にも指を添えず、数字を押しても盤面を変えないこと", () => {
        fireEvent.click(getCell(5, 7));
        const rowAndColumn = queryShownText("この行と列にはもう2があります");
        fireEvent.click(getCell(6, 9));
        const column = queryShownText("この列にはもう2があります");
        fireEvent.click(getCell(5, 8));
        fireEvent.click(getDigitButton(4));

        const row = queryShownText("この行にはもう2があります");
        const detail = queryShownText("ほかのマスを選びます");
        const digitPointers = document.querySelectorAll(
          'fieldset [data-tutorial-cue="pointer"]',
        );
        const label = getCellLabel(5, 8);

        expect(rowAndColumn).not.toBeNull();
        expect(column).not.toBeNull();
        expect(row).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(digitPointers).toHaveLength(0);
        expect(label).toBe("5行8列、空き");
      });

      test("2の入るマスを選ぶと、そこが入るマスだと言い、2のボタンに指を添え、2を入れると手を離すこと", () => {
        fireEvent.click(getCell(6, 8));
        const headline = queryShownText("ここが2の入るマスです");
        const detail = queryShownText("下の2を押します");
        const digitPointer = getDigitPointerPlacement(2);
        fireEvent.click(getDigitButton(2));

        const freePlayHeadline = queryMessage(freePlay);

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(digitPointer).toBe("center");
        expect(freePlayHeadline).not.toBeNull();
      });
    });

    describe("手を離した後", () => {
      /** 6行4列に7を入れたときに、重なりを言う一言。 */
      const violationHeadline = "このブロックにはもう7があります";

      beforeEach(() => {
        finishSteps(stepEntries.length);
      });

      test("覆いを外し、長く手が止まっても印を付けず、残りを埋める一言とヒントを見せること", () => {
        advanceTime(longIdleMs);

        const scrimShown = isScrimShown();
        const spotlightArea = querySpotlightArea();
        const hinted = getCuedCellIndices("hint");
        const headline = queryMessage(freePlay);
        const hintButton = queryHintButton();

        expect(scrimShown).toBe(false);
        expect(spotlightArea).toBeNull();
        expect(hinted).toEqual([]);
        expect(headline).not.toBeNull();
        expect(hintButton).not.toBeNull();
      });

      test("ヒントを押すと、まとまりで最後に空いたマスに指の無い印を付け、そのまとまりを抜いて盤面を覆い、そのまとまりのルールを伝えた一言に替え、ヒントを下げること", () => {
        pressHint();

        const hintButton = queryHintButton();
        const hinted = getCuedCellIndices("hint");
        const pointed = getPointedCellIndices();
        const scrimShown = isScrimShown();
        const spotlitUnits = getSpotlitUnits();
        const spotlitCells = getSpotlitCellIndices();
        const headline = queryMessage(steps[1]?.message);
        const freePlayHeadline = queryMessage(freePlay);

        expect(hintButton).toBeNull();
        expect(hinted).toEqual([getCellIndex(1, 4)]);
        expect(pointed).toEqual([]);
        expect(scrimShown).toBe(true);
        expect(spotlitUnits).toEqual(["row:0"]);
        expect(spotlitCells).toEqual([]);
        expect(headline).not.toBeNull();
        expect(freePlayHeadline).toBeNull();
      });

      test("手がかりのマスに数字を入れると、覆いを外し、残りを埋める一言に戻し、またヒントを出すこと", () => {
        pressHint();
        enter([1, 4, 7]);

        const scrimShown = isScrimShown();
        const hinted = getCuedCellIndices("hint");
        const headline = queryMessage(freePlay);
        const hintButton = queryHintButton();

        expect(scrimShown).toBe(false);
        expect(hinted).toEqual([]);
        expect(headline).not.toBeNull();
        expect(hintButton).not.toBeNull();
      });

      test("まとまりで最後に空いたマスが無いままヒントを押すと、マスに印を付けず、置き場所が1つに決まるブロックと、置き場所を絞る数字のマスを抜き、置き場所を探させる一言に替えること", () => {
        enter([1, 4, 7]);
        enter([6, 4, 8]);
        enter([6, 9, 7]);
        pressHint();

        const hinted = getCuedCellIndices("hint");
        const scrimShown = isScrimShown();
        const spotlitUnits = getSpotlitUnits();
        const spotlitCells = getSpotlitCellIndices();
        const headline = queryShownText(
          "このブロックで1が入るマスを\n探します",
        );
        const detail = queryShownText("1がある行と列を除いて探します");

        expect(hinted).toEqual([]);
        expect(scrimShown).toBe(true);
        expect(spotlitUnits).toEqual(["block:0"]);
        expect(spotlitCells).toEqual([getCellIndex(9, 2)]);
        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
      });

      test("どのマスも選べ、最初からある数字のマスでは数字のボタンを押せないこと", () => {
        fireEvent.click(getCell(1, 1));

        const pressed = getCell(1, 1).getAttribute("aria-pressed");
        const recalled = getRecalledCellIndices();
        const digitDisabled = getDigitButton(6).hasAttribute("disabled");

        expect(pressed).toBe("true");
        expect(recalled).toEqual([]);
        expect(digitDisabled).toBe(true);
      });

      test("前に入れた違う数字と重なる正しい数字を入れると、違う数字のマスにすぐ印を付けること", () => {
        enter([6, 4, 7]);
        enter([1, 4, 7]);

        const hinted = getCuedCellIndices("hint");
        const headline = queryShownText("印のマスの数字が違います");

        expect(hinted).toEqual([getCellIndex(6, 4)]);
        expect(headline).not.toBeNull();
      });

      test("違う数字のマスに印を付けている間は、ヒントを出さないこと", () => {
        enter([6, 4, 7]);
        enter([1, 4, 7]);

        const hintButton = queryHintButton();

        expect(hintButton).toBeNull();
      });

      test("重なる数字を入れると、すぐ盤面を覆って重なったマスを抜き、重なりを言うこと", () => {
        enter([6, 4, 7]);

        const scrimShown = isScrimShown();
        const spotlitCells = getSpotlitCellIndices();
        const spotlitUnits = getSpotlitUnits();
        const hinted = getCuedCellIndices("hint");
        const violation = queryShownText(violationHeadline);

        expect(scrimShown).toBe(true);
        expect(spotlitCells).toEqual([getCellIndex(5, 6), getCellIndex(6, 4)]);
        expect(spotlitUnits).toEqual([]);
        expect(hinted).toEqual([]);
        expect(violation).not.toBeNull();
      });

      test("重なる数字を入れて止まっても、そのマスに印を付けないこと", () => {
        enter([6, 4, 7]);
        advanceTime(longIdleMs);

        const hinted = getCuedCellIndices("hint");

        expect(hinted).toEqual([]);
      });

      test("重なる数字を入れてヒントを押すと、そのマスを手がかりとして印を付け、重なったマスを抜いたまま、重なりを言う一言を替えないこと", () => {
        enter([6, 4, 7]);
        pressHint();

        const hinted = getCuedCellIndices("hint");
        const pointed = getPointedCellIndices();
        const scrimShown = isScrimShown();
        const spotlitCells = getSpotlitCellIndices();
        const violation = queryShownText(violationHeadline);

        expect(hinted).toEqual([getCellIndex(6, 4)]);
        expect(pointed).toEqual([]);
        expect(scrimShown).toBe(true);
        expect(spotlitCells).toEqual([getCellIndex(5, 6), getCellIndex(6, 4)]);
        expect(violation).not.toBeNull();
      });
    });

    test("解き終えると、演出を終えてから、ゲームのホームで開いているレベルを遊ぶ操作を出すこと", async () => {
      installAnimate();
      solveAll();
      const buttonDuringAnimation = screen.queryByRole("button", {
        name: "レベル 3を遊ぶ",
      });
      await advanceTimeInSlices(1000);
      const detail = queryShownText(completion.home.detail ?? "");
      fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

      const startPlayCalls = onStartPlay.mock.calls.length;

      expect(buttonDuringAnimation).toBeNull();
      expect(detail).not.toBeNull();
      expect(startPlayCalls).toBe(1);
    });

    test("解き終えると、本番と同じ完成の音を1回鳴らすこと", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);

      const clearedCalls = vi.mocked(playLayeredSound).mock.calls.length;

      expect(clearedCalls).toBe(1);
    });

    test("解き終えると、完成を伝え、覚えたルールを並べ、進み具合を満たすこと", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);

      const headline = queryMessage(completion.home);
      const recap = getRecapTexts();
      const progress = getProgressValue();

      expect(headline).not.toBeNull();
      expect(recap).toEqual(rules.map(({ label }) => label));
      expect(progress).toBe("100");
    });

    test("解き終えると、ヒントを出さないこと", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);

      const hintButton = queryHintButton();

      expect(hintButton).toBeNull();
    });

    test("解き終えてもう一度を押すと、入口を通さずに、始めの盤面で最初の手順から始めること", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "もう一度" }),
      );

      const startButton = queryStartButton();
      const headline = queryMessage(steps[0]?.message);
      const label = getCellLabel(3, 5);
      const hinted = getCuedCellIndices("hint");
      const progress = getProgressValue();

      expect(startButton).toBeNull();
      expect(headline).not.toBeNull();
      expect(label).toBe("3行5列、空き");
      expect(hinted).toEqual([getCellIndex(3, 5)]);
      expect(progress).toBe("0");
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      render(<NanpureTutorial open={true} onClose={onClose} />);
      pressStart();
    });

    test("解き終えると、プレイに戻る操作を出すこと", async () => {
      solveAll();
      await advanceTimeInSlices(1000);
      const detail = queryShownText(completion.play.detail ?? "");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      const closeCalls = onClose.mock.calls.length;

      expect(detail).not.toBeNull();
      expect(closeCalls).toBe(1);
    });
  });

  describe("入口を見せる場合", () => {
    beforeEach(() => {
      render(
        <NanpureTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
    });

    test("開くと、名前と何をするパズルか、ゴールの一言を、印の無いゴールの盤面と一緒に見せること", () => {
      const title = within(getScreen()).getByRole("heading", {
        name: NANPURE_DISPLAY_NAME,
      });
      const purpose = queryShownText(intro.purpose);
      const caption = queryShownText(intro.goalCaption);
      const label = getCellLabel(3, 5);
      const hinted = getCuedCellIndices("hint");
      const scrimShown = isScrimShown();
      const progress = getProgressValue();

      expect(title).toBeTruthy();
      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(label).toBe("3行5列、8");
      expect(hinted).toEqual([]);
      expect(scrimShown).toBe(false);
      expect(progress).toBe("0");
    });

    test("ヒントを出さないこと", () => {
      const hintButton = queryHintButton();

      expect(hintButton).toBeNull();
    });

    test("マスを押しても、手順へ飛ばずに、ゴールの盤面を見せたままはじめるを待つこと", () => {
      fireEvent.pointerDown(getCell(3, 5));
      fireEvent.click(getCell(3, 5));
      advanceTime(introEnoughMs);

      const caption = queryShownText(intro.goalCaption);
      const startButton = queryStartButton();
      const label = getCellLabel(3, 5);
      const hinted = getCuedCellIndices("hint");

      expect(caption).not.toBeNull();
      expect(startButton).not.toBeNull();
      expect(label).toBe("3行5列、8");
      expect(hinted).toEqual([]);
    });
  });

  describe("始めの盤面へ替える動きを見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <NanpureTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
    });

    test("入れた数字を消し終えてから、始めの盤面で最初の手順の印を出すこと", async () => {
      const labelWhileRewinding = getCellLabel(3, 5);
      const hintedWhileRewinding = getCuedCellIndices("hint");
      await advanceTimeInSlices(introEnoughMs);

      const label = getCellLabel(3, 5);
      const hinted = getCuedCellIndices("hint");

      expect(labelWhileRewinding).toBe("3行5列、8");
      expect(hintedWhileRewinding).toEqual([]);
      expect(label).toBe("3行5列、空き");
      expect(hinted).toEqual([getCellIndex(3, 5)]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(
        <NanpureTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
    });

    test("ゴールの盤面を見せたまま待ち、はじめるで動きを待たずに始めの盤面で最初の手順を始めること", () => {
      advanceTime(introEnoughMs);
      const goalLabel = getCellLabel(3, 5);
      pressStart();

      const label = getCellLabel(3, 5);
      const hinted = getCuedCellIndices("hint");

      expect(goalLabel).toBe("3行5列、8");
      expect(label).toBe("3行5列、空き");
      expect(hinted).toEqual([getCellIndex(3, 5)]);
    });

    test("印の無いマスを押すと、動きを減らす設定でも印のマスの印を濃くし直すこと", () => {
      pressStart();
      fireEvent.click(getCell(1, 1));

      const recalled = getRecalledCellIndices();

      expect(recalled).toEqual([getCellIndex(3, 5)]);
    });
  });
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

type CellEntry = readonly [row: number, column: number, digit: number];

const stepEntries: readonly CellEntry[] = [
  [6, 3, 9],
  [6, 9, 7],
  [7, 1, 2],
  [4, 9, 3],
  [3, 6, 1],
];

const remainingEntries: readonly CellEntry[] = [
  [2, 2, 9],
  [2, 6, 6],
  [3, 5, 8],
  [3, 9, 5],
  [4, 6, 5],
  [7, 3, 5],
  [8, 5, 4],
];

const nextStepCueDelayMs = 900;

const idleHintDelayMs = 10_000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

const hiddenRule = "まだ出ていないルール";

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

/** 導入は自動では先へ進まない。 */
function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
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

function getSpotlitCellIndices(): number[] {
  return getCellIndicesContaining("[data-tutorial-spotlight]");
}

function getSpotlitUnits(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-spotlit-unit]"),
  ).map((element) => element.dataset.spotlitUnit ?? "");
}

function getSpotlitDigits(): number[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("fieldset button"),
  ).flatMap((button) =>
    button.querySelector("[data-tutorial-spotlight]")
      ? [Number(button.textContent)]
      : [],
  );
}

function isScrimShown(): boolean {
  return document.querySelector("[data-tutorial-focus-scrim]") !== null;
}

function usesRuleViolationColor(): boolean {
  return (
    document.querySelector(
      'main [class*="destructive"], main [class*="rose-"]',
    ) !== null
  );
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
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
      pressNextThroughIntro();
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
      expect(rules).toEqual([hiddenRule, hiddenRule, hiddenRule]);
    });

    test("手を引いている間は画面全体に覆いを重ね、印のマスだけを抜き、まだ押せない数字のボタンは抜かないこと", () => {
      const scrimShown = isScrimShown();
      const spotlitCells = getSpotlitCellIndices();
      const spotlitUnits = getSpotlitUnits();
      const spotlitDigits = getSpotlitDigits();

      expect(scrimShown).toBe(true);
      expect(spotlitCells).toEqual([getCellIndex(6, 3)]);
      expect(spotlitUnits).toEqual([]);
      expect(spotlitDigits).toEqual([]);
    });

    test("印のマスを選ぶと、押す数字のボタンに印を付け、そのボタンを覆いから抜くこと", () => {
      fireEvent.click(getCell(6, 3));

      const pressed = getCell(6, 3).getAttribute("aria-pressed");
      const digitMark = getDigitButton(9).querySelector(
        '[data-tutorial-cue="mark"]',
      );
      const spotlitDigits = getSpotlitDigits();

      expect(pressed).toBe("true");
      expect(digitMark).not.toBeNull();
      expect(spotlitDigits).toEqual([9]);
    });

    test("印の無いマスを押すと、選ばずに、押したマスではなく印のマスの印を、赤を使わずに濃くし直すこと", () => {
      fireEvent.click(getCell(1, 1));

      const pressed = getCell(1, 1).getAttribute("aria-pressed");
      const recalled = getRecalledCellIndices();
      const hinted = getCuedCellIndices("hint");
      const violationColored = usesRuleViolationColor();

      expect(pressed).toBe("false");
      expect(recalled).toEqual([getCellIndex(6, 3)]);
      expect(hinted).toEqual([getCellIndex(6, 3)]);
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
      fireEvent.click(getCell(6, 3));
      fireEvent.click(getCell(1, 1));

      const pressed = getCell(6, 3).getAttribute("aria-pressed");
      const recalled = getRecalledCellIndices();
      const digitRecall = getDigitButton(9).querySelector(
        '[data-tutorial-cue="recall"]',
      );

      expect(pressed).toBe("true");
      expect(recalled).toEqual([getCellIndex(6, 3)]);
      expect(digitRecall).not.toBeNull();
    });

    test("印のマスを選ぶと、濃くし直しを終えること", () => {
      fireEvent.click(getCell(1, 1));
      fireEvent.click(getCell(6, 3));

      const recalled = getRecalledCellIndices();

      expect(recalled).toEqual([]);
    });

    test("印のとおりに数字を入れると、濃くし直しを終えること", () => {
      fireEvent.click(getCell(6, 3));
      fireEvent.click(getCell(1, 1));
      fireEvent.click(getDigitButton(9));

      const recalled = getRecalledCellIndices();
      const digitRecall = document.querySelector(
        'fieldset [data-tutorial-cue="recall"]',
      );

      expect(recalled).toEqual([]);
      expect(digitRecall).toBeNull();
    });

    test("操作の手順で印の無い数字を押すと、盤面を変えず音も鳴らさず、印のマスと押す数字の印を濃くし直すこと", () => {
      fireEvent.click(getCell(6, 3));
      fireEvent.click(getDigitButton(1));

      const label = getCellLabel(6, 3);
      const played = getPlayedSoundNames();
      const recalled = getRecalledCellIndices();
      const digitRecall = getDigitButton(9).querySelector(
        '[data-tutorial-cue="recall"]',
      );

      expect(label).toBe("6行3列、空き");
      expect(played).toEqual([]);
      expect(recalled).toEqual([getCellIndex(6, 3)]);
      expect(digitRecall).not.toBeNull();
    });

    test("印のマスに数字を入れると、そのマスに応え、行のルールと、決め手の行と次のマスを覆いから抜いて示すこと", () => {
      finishSteps(1);

      const label = getCellLabel(6, 3);
      const fitted = getCuedCellIndices("fitted");
      const headline = screen.queryByText(/どの行にも/);
      const spotlitUnits = getSpotlitUnits();
      const hinted = getCuedCellIndices("hint");
      const rules = getRuleTexts();

      expect(label).toBe("6行3列、9");
      expect(fitted).toEqual([getCellIndex(6, 3)]);
      expect(headline).not.toBeNull();
      expect(spotlitUnits).toEqual(["row:5"]);
      expect(hinted).toEqual([getCellIndex(6, 9)]);
      expect(rules).toEqual(["行に1つずつ", hiddenRule, hiddenRule]);
    });

    test("行の手順で印のマスを選ぶと、押せる数字のボタンをすべて覆いから抜き、どの数字にも印を付けないこと", () => {
      finishSteps(1);
      fireEvent.click(getCell(6, 9));

      const spotlitDigits = getSpotlitDigits();
      const digitMarks = document.querySelectorAll(
        'fieldset [data-tutorial-cue="mark"]',
      );

      expect(spotlitDigits).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(digitMarks).toHaveLength(0);
    });

    test("行で重なる数字を入れると、重なりを赤く示して一言で言い、正しい数字に入れ替えると次へ進むこと", () => {
      finishSteps(1);
      enter([6, 9, 1]);
      const invalid = getCell(6, 9).getAttribute("aria-invalid");
      const violation = screen.queryByText("この行には、もう1があります");
      fireEvent.click(getDigitButton(7));
      advanceTime(nextStepCueDelayMs);

      const headline = screen.queryByText(/どの列にも/);

      expect(invalid).toBe("true");
      expect(violation).not.toBeNull();
      expect(headline).not.toBeNull();
    });

    test("決め手の列の外のマスと重なる数字を入れると、重なったマスも覆いから抜くこと", () => {
      finishSteps(2);
      enter([7, 1, 4]);

      const spotlitCells = getSpotlitCellIndices();
      const spotlitUnits = getSpotlitUnits();

      expect(spotlitCells).toEqual([getCellIndex(7, 2)]);
      expect(spotlitUnits).toEqual(["column:0"]);
    });

    test("決め手のある手順を終えると、入れたマスと決め手を、終えた手順の一言とルールの並びのまま少し残して見せてから、次の印と決め手と一言に替えること", () => {
      finishSteps(2);
      const fittedAfterMove = getCuedCellIndices("fitted");
      const spotlitUnitsAfterMove = getSpotlitUnits();
      const hintedAfterMove = getCuedCellIndices("hint");
      const headlineAfterMove = screen.queryByText(/どの行にも/);
      const rulesAfterMove = getRuleTexts();
      advanceTime(nextStepCueDelayMs);

      const spotlitUnits = getSpotlitUnits();
      const hinted = getCuedCellIndices("hint");
      const headline = screen.queryByText(/どの列にも/);
      const rules = getRuleTexts();

      expect(fittedAfterMove).toEqual([getCellIndex(6, 9)]);
      expect(spotlitUnitsAfterMove).toEqual(["row:5"]);
      expect(hintedAfterMove).toEqual([]);
      expect(headlineAfterMove).not.toBeNull();
      expect(rulesAfterMove).toEqual(["行に1つずつ", hiddenRule, hiddenRule]);
      expect(spotlitUnits).toEqual(["column:0"]);
      expect(hinted).toEqual([getCellIndex(7, 1)]);
      expect(headline).not.toBeNull();
      expect(rules).toEqual(["行に1つずつ", "列に1つずつ", hiddenRule]);
    });

    test("印のマスに数字を入れると、本番と同じ数字を入れる音を鳴らすこと", () => {
      finishSteps(1);

      const played = getPlayedSoundNames();

      expect(played).toEqual(["digit-entered.flac"]);
    });

    test("ルールに当たる数字を入れると、本番と同じミスの音を鳴らすこと", () => {
      finishSteps(1);
      enter([6, 9, 1]);

      const played = getPlayedSoundNames();

      expect(played).toEqual(["digit-entered.flac", "mistake-entered.flac"]);
    });

    test("マスを選ぶだけの手と、印の無いマスを押した手には、音を鳴らさないこと", () => {
      fireEvent.click(getCell(6, 3));
      fireEvent.click(getCell(1, 1));

      const played = getPlayedSoundNames();

      expect(played).toEqual([]);
    });

    test("ブロックのルールでは、太線で区切ったブロックを覆いから抜いて示すこと", () => {
      finishSteps(3);
      advanceTime(nextStepCueDelayMs);

      const headline = screen.queryByText(/太線で区切ったブロックにも/);
      const spotlitUnits = getSpotlitUnits();

      expect(headline).not.toBeNull();
      expect(spotlitUnits).toEqual(["block:5"]);
    });

    test("最後の手順では、印のマスの行・列・ブロックをまとめて覆いから抜いて示すこと", () => {
      finishSteps(4);
      advanceTime(nextStepCueDelayMs);

      const spotlitUnits = getSpotlitUnits();
      const hinted = getCuedCellIndices("hint");

      expect(spotlitUnits).toEqual(["row:2", "column:5", "block:1"]);
      expect(hinted).toEqual([getCellIndex(3, 6)]);
    });

    describe("手を離した後", () => {
      beforeEach(() => {
        finishSteps(stepEntries.length);
      });

      test("覆いを外し、考えている間は印を付けず、長く手が止まると決まるマスに印を付けること", () => {
        const scrimShown = isScrimShown();
        advanceTime(idleHintDelayMs - 1);
        const hintedWhileThinking = getCuedCellIndices("hint");
        advanceTime(1);

        const headline = screen.queryByText("あとは残りを埋めれば完成です");
        const hinted = getCuedCellIndices("hint");

        expect(scrimShown).toBe(false);
        expect(headline).not.toBeNull();
        expect(hintedWhileThinking).toEqual([]);
        expect(hinted).toHaveLength(1);
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

    test("解き終えると、演出を終えてから、ゲームのホームで開いているレベルを遊ぶ操作を出すこと", async () => {
      installAnimate();
      solveAll();
      const buttonDuringAnimation = screen.queryByRole("button", {
        name: "レベル 3を遊ぶ",
      });
      await advanceTimeInSlices(1000);
      const detail = screen.queryByText("どのレベルも同じルールです");
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

    test("解き終えてもう一度を押すと、始めの盤面に戻すこと", async () => {
      installAnimate();
      solveAll();
      await advanceTimeInSlices(1000);
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      pressNextThroughIntro();

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
      pressNextThroughIntro();
    });

    test("解き終えると、プレイに戻る操作を出すこと", async () => {
      solveAll();
      await advanceTimeInSlices(1000);
      const detail = screen.queryByText("プレイ中の盤面も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      const closeCalls = onClose.mock.calls.length;

      expect(detail).not.toBeNull();
      expect(closeCalls).toBe(1);
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      // 場面の動きを終えないままにして、押したときに今の段の動きを終えて見せることを確かめる。
      Object.defineProperty(HTMLElement.prototype, "animate", {
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
        <NanpureTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
    });

    test("開くと、名前と何をするパズルか、ゴールの盤面を見せること", () => {
      const title = screen.getByRole("heading", { name: "ナンプレ" });
      const purpose = screen.getByText(
        "空いたマスに1〜9の数字を入れて 盤面を完成させるパズルです",
      );
      const label = getCellLabel(6, 3);

      expect(title).toBeTruthy();
      expect(purpose).toBeTruthy();
      expect(label).toBe("6行3列、9");
    });

    test("マスを押しても、手順へ飛ばずに、ゴールの盤面を見せたまま次へを待つこと", () => {
      fireEvent.pointerDown(getCell(6, 3));
      advanceTime(introEnoughMs);

      const caption = screen.queryByText("この盤面がゴールです");
      const nextButton = screen.queryByRole("button", { name: "次へ" });
      const label = getCellLabel(6, 3);
      const hinted = getCuedCellIndices("hint");

      expect(caption).not.toBeNull();
      expect(nextButton).not.toBeNull();
      expect(label).toBe("6行3列、9");
      expect(hinted).toEqual([]);
    });

    test("始まりの盤面でキーを押すと、数字を消す動きを終えて始めの盤面を見せ、次へを待つこと", () => {
      advanceTime(introEnoughMs);
      pressNext();
      const labelWhileRewinding = getCellLabel(6, 3);
      fireEvent.keyDown(getCell(1, 1), { key: "Enter" });

      const caption = screen.queryByText("最初はいくつかのマスが空いています");
      const nextButton = screen.queryByRole("button", { name: "次へ" });
      const label = getCellLabel(6, 3);
      const hinted = getCuedCellIndices("hint");

      expect(labelWhileRewinding).toBe("6行3列、9");
      expect(caption).not.toBeNull();
      expect(nextButton).not.toBeNull();
      expect(label).toBe("6行3列、空き");
      expect(hinted).toEqual([]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(
        <NanpureTutorial open={true} playStart={playStart} onClose={onClose} />,
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

    test("印の無いマスを押すと、動きを減らす設定でも印のマスの印を濃くし直すこと", async () => {
      await goThroughIntro();
      fireEvent.click(getCell(1, 1));

      const recalled = getRecalledCellIndices();

      expect(recalled).toEqual([getCellIndex(6, 3)]);
    });
  });
});

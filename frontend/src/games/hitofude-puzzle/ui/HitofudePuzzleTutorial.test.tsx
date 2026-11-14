import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { HitofudePuzzleTutorial } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

/**
 * 盤面のマス番号（4×4、`#` は穴、S は始点）
 * ```text
 *  0  #  2  3
 *  4  5  S  7
 *  8  9  # 11
 * 12 13 14 15
 * ```
 */
const stepCells = [
  [2, 3],
  [7, 11],
  [15, 14, 13],
  [12, 8],
] as const;

/** 手順を終えた後、自分で延ばして完成させるマス。 */
const remainingCells = [9, 5, 4, 0] as const;

/** 手順の最後のマスまで延ばしてから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 700;

const idleHintDelayMs = 4000;

const violationMessageDelayMs = 500;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

function pressNextThroughIntroWaitingForScenes(): void {
  for (let press = 0; press < 3; press += 1) {
    advanceTime(introEnoughMs);
    const next = screen.queryByRole("button", { name: "次へ" });
    if (!next) {
      return;
    }
    fireEvent.click(next);
  }
  advanceTime(introEnoughMs);
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

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "一筆パズル盤面 4行4列" });
}

function getCellName(cell: number): string {
  return `${Math.floor(cell / 4) + 1}行${(cell % 4) + 1}列`;
}

function getCell(cell: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${getCellName(cell)} `),
  });
}

function pressCells(cells: readonly number[]): void {
  for (const cell of cells) {
    fireEvent.click(getCell(cell));
  }
}

function getCellNumber(button: HTMLElement): number {
  const [, row, column] =
    /^(\d+)行(\d+)列/.exec(button.getAttribute("aria-label") ?? "") ?? [];
  return (Number(row) - 1) * 4 + (Number(column) - 1);
}

/** 道が通ったマス。始点と先端を含む。 */
function getVisitedCells(): number[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter(
      (button) =>
        !/ (未通過|穴)$/.test(button.getAttribute("aria-label") ?? ""),
    )
    .map(getCellNumber);
}

function getCuedCells(kind: "hint" | "extended" | "recall"): number[] {
  const selector =
    kind === "recall"
      ? '[data-tutorial-cue="recall"]'
      : `[data-cell-cue="${kind}"]`;
  return within(getBoard())
    .getAllByRole("button")
    .filter((button) => button.querySelector(selector))
    .map(getCellNumber);
}

function getSpotlitCells(): number[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((button) => button.querySelector("[data-tutorial-spotlight]"))
    .map(getCellNumber);
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

function playSteps(count: number): void {
  for (const cells of stepCells.slice(0, count)) {
    pressCells(cells);
    advanceTime(nextStepCueDelayMs);
  }
}

describe("HitofudePuzzleTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "3", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <HitofudePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressNextThroughIntro();
    });

    test("始点だけの道で、輪の付いたマスから印のマスまでなぞることを示し、ルールを伏せておくこと", () => {
      const headline = screen.getByText("印のマスを順になぞります");
      const visited = getVisitedCells();
      const hinted = getCuedCells("hint");
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(visited).toEqual([6]);
      expect(hinted).toEqual([2, 3]);
      expect(rules).toEqual([
        "まだ出ていないルール",
        "まだ出ていないルール",
        "まだ出ていないルール",
      ]);
    });

    test("なぞり始める先端と印のマスを、画面全体の覆いから抜くこと", () => {
      const spotlit = getSpotlitCells();

      expect(spotlit).toEqual([2, 3, 6]);
    });

    test("印の無いマスを押すと、道を延ばさず音も鳴らさずに、印のマスの線を濃くし直すこと", () => {
      pressCells([7]);

      const visited = getVisitedCells();
      const recalled = getCuedCells("recall");

      expect(visited).toEqual([6]);
      expect(recalled).toEqual([2, 3]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("先端を押しても、印のマスの線を濃くし直さないこと", () => {
      pressCells([6]);

      const recalled = getCuedCells("recall");

      expect(recalled).toEqual([]);
    });

    test("印のマスを順に延ばすと、本番と同じ音を鳴らし、延ばしたマスに応えてから次の印を付けること", () => {
      pressCells(stepCells[0]);
      const sounds = getPlayedSoundNames();
      const acknowledged = getCuedCells("extended");
      const hintedBeforeDelay = getCuedCells("hint");
      const headline = screen.getByText("同じマスは2回通れません");
      advanceTime(nextStepCueDelayMs);

      const hinted = getCuedCells("hint");

      expect(sounds).toEqual(["path-extended.flac", "path-extended.flac"]);
      expect(acknowledged).toEqual([2, 3]);
      expect(hintedBeforeDelay).toEqual([]);
      expect(headline).toBeTruthy();
      expect(hinted).toEqual([7, 11]);
    });

    describe("同じマスのルールを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(1);
      });

      test("ルールの並びに加え、先端と印のマスと、もう通った始点を覆いから抜くこと", () => {
        const rules = getRuleTexts();
        const spotlit = getSpotlitCells();

        expect(rules).toEqual([
          "1回ずつ通る",
          "まだ出ていないルール",
          "まだ出ていないルール",
        ]);
        expect(spotlit).toEqual([3, 6, 7, 11]);
      });

      test("通った道のマスを押しても、巻き戻さずに印のマスの線を濃くし直すこと", () => {
        pressCells([2]);

        const visited = getVisitedCells();
        const recalled = getCuedCells("recall");

        expect(visited).toEqual([2, 3, 6]);
        expect(recalled).toEqual([7, 11]);
      });

      test("矢印キーで通った始点へ進もうとすると、本番と同じく阻まれた音を鳴らし、阻んだ始点を覆いから抜いたまま同じマスを通れないと言うこと", () => {
        pressCells([7]);
        fireEvent.keyDown(getBoard(), { key: "ArrowLeft" });
        advanceTime(violationMessageDelayMs);

        const lastSound = getPlayedSoundNames().at(-1);
        const visited = getVisitedCells();
        const spotlit = getSpotlitCells();
        const headline = screen.getByText("同じマスは2回通れません");

        expect(lastSound).toBe("blocked.flac");
        expect(visited).toEqual([2, 3, 6, 7]);
        expect(spotlit).toContain(6);
        expect(headline).toBeTruthy();
      });
    });

    describe("穴のルールを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(2);
      });

      test("穴を決め手として覆いから抜くこと", () => {
        const headline = screen.getByText("穴は通れません");
        const spotlit = getSpotlitCells();

        expect(headline).toBeTruthy();
        expect(spotlit).toEqual([10, 11, 13, 14, 15]);
      });

      test("穴へ進もうとすると、本番と同じく阻まれた音を鳴らし、道を延ばさないこと", () => {
        pressCells([10]);

        const visited = getVisitedCells();
        const lastSound = getPlayedSoundNames().at(-1);

        expect(visited).toEqual([2, 3, 6, 7, 11]);
        expect(lastSound).toBe("blocked.flac");
      });
    });

    describe("すべてのマスのルールを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(3);
      });

      test("左下の角を今通ることを、行き先の無くなる左上の角と一緒に決め手にして伝えること", () => {
        const headline = screen.getByText(
          "すべてのマスを通ります 左下の角は、今のうちに通ります",
        );
        const detail = screen.getByText(
          "後回しにすると、左上の角まで行けません",
        );
        const spotlit = getSpotlitCells();

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(spotlit).toEqual([0, 8, 12, 13]);
      });

      test("角を通らずに上へ曲がろうとしても、道を延ばさないこと", () => {
        pressCells([9]);

        const visited = getVisitedCells();

        expect(visited).not.toContain(9);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        playSteps(stepCells.length);
      });

      test("覆いを外し、残りを通すことを伝え、手が止まったときだけ、一言は替えずに次に延ばすマスへ印を付けること", () => {
        const spotlit = getSpotlitCells();
        const hintedBeforeIdle = getCuedCells("hint");
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCells("hint");
        const headline = screen.getByText("残りのマスも通れば完成です");

        expect(spotlit).toEqual([]);
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toEqual([9]);
        expect(headline).toBeTruthy();
      });

      test("解から外れてたどり着けないマスが残ると、本番と同じく道を延ばし、少し置いてからわけと戻し方を伝えること", () => {
        pressCells([4]);
        const visited = getVisitedCells();
        advanceTime(violationMessageDelayMs);

        const headline = screen.getByText(
          "このままでは たどり着けないマスが残ります",
        );
        const detail = screen.getByText("来た道をなぞって戻れば、やり直せます");

        expect(visited).toContain(4);
        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
      });

      test("解から外れたまま止まると、違反の一言を残したまま、外れる前のマスに印を付けること", () => {
        pressCells([4]);
        advanceTime(idleHintDelayMs);

        const hinted = getCuedCells("hint");
        const headline = screen.getByText(
          "このままでは たどり着けないマスが残ります",
        );

        expect(hinted).toEqual([8]);
        expect(headline).toBeTruthy();
      });

      test("印のマスを押すと、本番と同じくそこまで戻すこと", () => {
        pressCells([4, 8]);

        const visited = getVisitedCells();

        expect(visited).not.toContain(4);
      });

      test("手順の道を戻して引き直しても、手順を終えたときの応えを出さないこと", () => {
        pressCells([13, 12, 8]);

        const acknowledged = getCuedCells("extended");

        expect(acknowledged).toEqual([]);
      });

      test("残りを通し終えると、本番と同じ完成の音を鳴らし、ゲームのホームで開いているレベルを遊ぶ操作でそのレベルを始めること", () => {
        pressCells(remainingCells);
        const clearSounds = vi.mocked(playLayeredSound).mock.calls.length;
        advanceTime(introEnoughMs);
        const detail = screen.getByText("どのレベルも、もっと広い盤面です");
        fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

        expect(clearSounds).toBe(1);
        expect(detail).toBeTruthy();
        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("通し終えた後のもう一度で、始まりの盤面を見せてから最初の手順を始めること", () => {
        pressCells(remainingCells);
        advanceTime(introEnoughMs);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const caption = screen.getByText("輪の付いたマスから 道を引きます");
        pressNextThroughIntroWaitingForScenes();

        const visited = getVisitedCells();
        const hinted = getCuedCells("hint");

        expect(caption).toBeTruthy();
        expect(visited).toEqual([6]);
        expect(hinted).toEqual([2, 3]);
      });
    });

    test("矢印キーでも、印のマスへ先端を動かせること", () => {
      fireEvent.keyDown(getBoard(), { key: "ArrowUp" });

      const visited = getVisitedCells();

      expect(visited).toEqual([2, 6]);
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      render(
        <HitofudePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("開くと、名前と何をするパズルか、全マスを通ったゴールの道を見せること", () => {
      const title = screen.getByRole("heading", { name: "一筆パズル" });
      const purpose = screen.getByText(
        "穴以外のすべてのマスを1回ずつ通る 1本の道を引くパズルです",
      );
      const visitedCount = getVisitedCells().length;

      expect(title).toBeTruthy();
      expect(purpose).toBeTruthy();
      expect(visitedCount).toBe(14);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<HitofudePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、ゴールの道をゴールの一言と一緒に見せること", () => {
      const caption = screen.getByText("この形になれば完成です");
      const visitedCount = getVisitedCells().length;

      expect(caption).toBeTruthy();
      expect(visitedCount).toBe(14);
    });

    test("ゴールで次へを押すと、始まりの一言を添えて始点だけの道を見せること", () => {
      pressNext();

      const caption = screen.getByText("輪の付いたマスから 道を引きます");
      const visited = getVisitedCells();

      expect(caption).toBeTruthy();
      expect(visited).toEqual([6]);
    });

    test("次へで最後まで進めると、最初の手順の一言と印を出すこと", () => {
      pressNext();
      pressNextThroughIntroWaitingForScenes();

      const headline = screen.getByText("印のマスを順になぞります");
      const hinted = getCuedCells("hint");

      expect(headline).toBeTruthy();
      expect(hinted).toEqual([2, 3]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<HitofudePuzzleTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
    });

    test("通し終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      pressCells([...stepCells.flat(), ...remainingCells]);
      advanceTime(introEnoughMs);
      const detail = screen.getByText("プレイ中の盤面も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
